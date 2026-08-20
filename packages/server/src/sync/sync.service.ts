import type { AegisRepository } from '../db/repository.js';
import type { ConflictResolutionWorker } from '../worker/conflict.worker.js';
import type {
  SyncPushPayloadSchema,
  SyncQueueItem
} from '@aegis/core';
import {
  getRoundedCursor,
  SaleCreationSchema,
  BulkConversionSchema,
  CreditPaymentSchema
} from '@aegis/core';
import { z } from 'zod';

export interface PushResult {
  status: 'accepted';
  acknowledged_keys: string[];
  dropped_duplicate_keys: string[];
  server_timestamp: string;
}

export interface PullResult {
  delta_products: any[];
  delta_customers: any[];
  server_cursor: string;
  server_timestamp: string;
}

export class SyncService {
  private repo: AegisRepository;
  private worker: ConflictResolutionWorker;
  // Idempotency store with TTL (simulates Redis SETNX with expiration)
  private idempotencyStore: Map<string, number> = new Map();
  // Delta cache for cache stampede defense
  private pullCache: Map<string, { data: PullResult; expiresAt: number }> = new Map();

  constructor(repo: AegisRepository, worker: ConflictResolutionWorker) {
    this.repo = repo;
    this.worker = worker;
  }

  /**
   * Delta Sync Push Endpoint:
   * 1. Enforces tenant boundary (store_id from authenticated token).
   * 2. Checks composite idempotency keys (device_id:uuid).
   * 3. Ingests mutations into the event log and conflict worker.
   */
  async processPush(
    storeId: string,
    authenticatedDeviceId: string,
    payload: z.infer<typeof SyncPushPayloadSchema>
  ): Promise<PushResult> {
    const device = await this.repo.getDevice(authenticatedDeviceId);
    if (!device || device.store_id !== storeId) {
      throw new Error('Device authorization failed or store mismatch');
    }

    if (device.is_revoked) {
      throw new Error('device_revoked');
    }

    const acknowledgedKeys: string[] = [];
    const droppedDuplicateKeys: string[] = [];
    const now = Date.now();

    for (const op of payload.operations) {
      // Check idempotency (device_id:uuid)
      if (this.isIdempotentDuplicate(op.idempotency_key, now)) {
        droppedDuplicateKeys.push(op.idempotency_key);
        acknowledgedKeys.push(op.idempotency_key); // client can still mark as synced
        continue;
      }

      // Mark idempotency key as seen (valid for 7 days)
      this.idempotencyStore.set(op.idempotency_key, now + 7 * 24 * 60 * 60 * 1000);

      // Process operation based on table & action
      await this.applyOperation(storeId, authenticatedDeviceId, op);
      acknowledgedKeys.push(op.idempotency_key);
    }

    const nowIso = new Date().toISOString();
    await this.repo.updateDeviceSync(authenticatedDeviceId, nowIso);

    return {
      status: 'accepted',
      acknowledged_keys: acknowledgedKeys,
      dropped_duplicate_keys: droppedDuplicateKeys,
      server_timestamp: nowIso
    };
  }

  /**
   * Delta Sync Pull Endpoint:
   * Returns delta changes since cursor, using rounded-cursor caching to prevent cache stampedes.
   */
  async processPull(
    storeId: string,
    deviceId: string,
    sinceCursor: string
  ): Promise<PullResult> {
    const device = await this.repo.getDevice(deviceId);
    if (!device || device.store_id !== storeId) {
      throw new Error('Device authorization failed');
    }
    if (device.is_revoked) {
      throw new Error('device_revoked');
    }

    const roundedCursor = getRoundedCursor(sinceCursor, 5000);
    const cacheKey = `${storeId}:${roundedCursor}`;
    const cached = this.pullCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Pull delta products & customers
    const allProducts = await this.repo.listProducts(storeId);
    const allCustomers = await this.repo.listCustomers(storeId);

    const sinceDate = sinceCursor !== '0' ? new Date(sinceCursor) : new Date(0);

    const deltaProducts = allProducts.filter(
      (p) => new Date(p.updated_at) >= sinceDate
    );
    const deltaCustomers = allCustomers.filter(
      (c) => new Date(c.updated_at) >= sinceDate
    );

    const nowIso = new Date().toISOString();
    const result: PullResult = {
      delta_products: deltaProducts,
      delta_customers: deltaCustomers,
      server_cursor: nowIso,
      server_timestamp: nowIso
    };

    // Cache for 5 seconds
    this.pullCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 5000
    });

    await this.repo.updateSyncCursor({
      store_id: storeId,
      device_id: deviceId,
      last_server_version: Date.now(),
      last_sync_at: nowIso,
      cursor_timestamp: nowIso
    });

    return result;
  }

  private isIdempotentDuplicate(key: string, now: number): boolean {
    const expiry = this.idempotencyStore.get(key);
    if (expiry && expiry > now) {
      return true;
    }
    return false;
  }

  private async applyOperation(
    storeId: string,
    deviceId: string,
    op: SyncQueueItem
  ): Promise<void> {
    if (op.table_name === 'sales' && op.op === 'CREATE') {
      const validatedSale = SaleCreationSchema.parse(op.payload);
      // Record the sale
      const sale = await this.repo.recordSale(storeId, {
        ...validatedSale,
        store_id: storeId,
        items: validatedSale.items.map((item) => ({
          ...item,
          id: item.id || crypto.randomUUID(),
          sale_id: validatedSale.id
        }))
      });
      // Ingest inventory deductions via conflict resolution worker
      await this.worker.processSaleEvent(storeId, deviceId, sale, op.idempotency_key);
    } else if (op.table_name === 'bulk_conversion' && op.op === 'CREATE') {
      const conv = BulkConversionSchema.parse(op.payload);
      await this.worker.processBulkConversion(
        storeId,
        deviceId,
        conv.carton_product_id,
        conv.unit_product_id,
        conv.cartons_to_convert,
        conv.units_yielded,
        op.idempotency_key,
        conv.notes
      );
    } else if (op.table_name === 'credit_payment' && op.op === 'CREATE') {
      const payment = CreditPaymentSchema.parse(op.payload);
      await this.repo.recordCreditPayment(
        storeId,
        payment.customer_id,
        payment.amount,
        deviceId,
        payment.notes
      );
    }
  }
}
