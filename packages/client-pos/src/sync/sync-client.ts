import * as crypto from 'crypto';
import type { LocalStoreDB } from '../db/local-db.js';
import {
  chunkSyncBatch,
  getSyncHealth,
  type SyncHealthStatus
} from '@aegis/core';

export type NetworkMode = 'online' | '2g_slow' | '3g' | 'offline';

export interface SyncState {
  networkMode: NetworkMode;
  isSyncing: boolean;
  health: SyncHealthStatus;
  offlineHours: number;
  statusMessage: string;
  lastSyncAt: string | null;
  pendingCount: number;
}

export class AegisSyncClient {
  private localDb: LocalStoreDB;
  private apiBaseUrl: string;
  private token: string | null = null;
  private networkMode: NetworkMode = 'online';
  private isSyncing: boolean = false;
  private listeners: ((state: SyncState) => void)[] = [];

  constructor(localDb: LocalStoreDB, apiBaseUrl: string = 'http://localhost:3001') {
    this.localDb = localDb;
    this.apiBaseUrl = apiBaseUrl;
  }

  public setToken(token: string) {
    this.token = token;
  }

  public setNetworkMode(mode: NetworkMode) {
    this.networkMode = mode;
    this.notifyState();
    if (mode !== 'offline' && this.token) {
      // Auto-trigger sync when connectivity resumes
      this.syncNow().catch(() => {});
    }
  }

  public getNetworkMode(): NetworkMode {
    return this.networkMode;
  }

  public onStateChange(listener: (state: SyncState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getState(): SyncState {
    const pendingCount = this.localDb.getPendingQueue().length;
    const health = getSyncHealth(this.localDb.metadata.lastSyncAt, pendingCount);

    let message = health.message;
    if (health.status === 'escalated_warning') {
      message = health.message;
    } else if (this.networkMode === 'offline') {
      message = `Offline (${pendingCount} changes stored safely locally)`;
    } else if (this.isSyncing) {
      message = 'Syncing delta changes...';
    }

    return {
      networkMode: this.networkMode,
      isSyncing: this.isSyncing,
      health: health.status,
      offlineHours: health.offlineHours,
      statusMessage: message,
      lastSyncAt: this.localDb.metadata.lastSyncAt,
      pendingCount
    };
  }

  private notifyState() {
    const state = this.getState();
    for (const l of this.listeners) {
      l(state);
    }
  }

  /**
   * Performs delta push and pull synchronization.
   */
  public async syncNow(): Promise<{ pushedCount: number; pulledProducts: number; pulledCustomers: number }> {
    if (this.networkMode === 'offline') {
      this.notifyState();
      throw new Error('Device is in offline mode');
    }

    if (!this.token) {
      throw new Error('Not authenticated');
    }

    if (this.isSyncing) {
      return { pushedCount: 0, pulledProducts: 0, pulledCustomers: 0 };
    }

    this.isSyncing = true;
    this.notifyState();

    let totalPushed = 0;
    let pulledProducts = 0;
    let pulledCustomers = 0;

    try {
      // 1. PUSH PHASE: Bounded chunking (<60KB)
      const pendingItems = this.localDb.getPendingQueue();
      if (pendingItems.length > 0) {
        const chunks = chunkSyncBatch(pendingItems);

        for (const chunk of chunks) {
          const pushPayload = {
            device_id: this.localDb.metadata.deviceId,
            sync_batch_id: crypto.randomUUID(),
            operations: chunk
          };

          const pushRes = await fetch(`${this.apiBaseUrl}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`
            },
            body: JSON.stringify(pushPayload)
          });

          if (!pushRes.ok) {
            const err = await pushRes.json().catch(() => ({}));
            if (pushRes.status === 401 && (err as any).error === 'device_revoked') {
              throw new Error('device_revoked');
            }
            throw new Error(`Push failed with status ${pushRes.status}`);
          }

          const pushData = (await pushRes.json()) as { acknowledged_keys: string[] };
          this.localDb.markQueueItemsSynced(pushData.acknowledged_keys);
          totalPushed += chunk.length;
        }
      }

      // 2. PULL PHASE: Fetch deltas since cursor
      const pullRes = await fetch(
        `${this.apiBaseUrl}/sync/pull?since=${encodeURIComponent(this.localDb.metadata.cursor)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        }
      );

      if (pullRes.ok) {
        const pullData = (await pullRes.json()) as {
          delta_products: any[];
          delta_customers: any[];
          server_cursor: string;
        };

        this.localDb.applyPulledDelta(
          pullData.delta_products,
          pullData.delta_customers,
          pullData.server_cursor
        );

        pulledProducts = pullData.delta_products.length;
        pulledCustomers = pullData.delta_customers.length;
      }
    } finally {
      this.isSyncing = false;
      this.notifyState();
    }

    return {
      pushedCount: totalPushed,
      pulledProducts,
      pulledCustomers
    };
  }
}
