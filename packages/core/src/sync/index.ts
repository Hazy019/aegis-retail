import * as crypto from 'crypto';
import type { SyncQueueItem } from '../types/index.js';

/**
 * Creates an idempotency key strictly scoped as device_id:uuid.
 * This prevents cross-device UUID collisions from flawed or cloned device images.
 */
export function createIdempotencyKey(deviceId: string, customUuid?: string): string {
  const opId = customUuid || crypto.randomUUID();
  return `${deviceId}:${opId}`;
}

/**
 * Parses an idempotency key into its device_id and operation UUID.
 */
export function parseIdempotencyKey(key: string): { deviceId: string; opId: string } {
  const parts = key.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid idempotency key format: "${key}". Expected "deviceId:uuid"`);
  }
  return { deviceId: parts[0], opId: parts[1] };
}

/**
 * Bounds sync payloads to stay under target payload size (e.g. 64KB)
 * to reliably transmit over high-latency / lossy 2G and 3G cellular connections.
 */
export function chunkSyncBatch(
  items: SyncQueueItem[],
  maxBytes: number = 60 * 1024 // 60KB default safety margin under 64KB
): SyncQueueItem[][] {
  const batches: SyncQueueItem[][] = [];
  let currentBatch: SyncQueueItem[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), 'utf8');

    if (currentBatch.length > 0 && currentBytes + itemBytes > maxBytes) {
      batches.push(currentBatch);
      currentBatch = [item];
      currentBytes = itemBytes;
    } else {
      currentBatch.push(item);
      currentBytes += itemBytes;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Lamport logical clock tick to establish causal ordering of mutations across stores and devices.
 */
export function tickLamportClock(localClock: number, remoteClock?: number): number {
  if (remoteClock !== undefined) {
    return Math.max(localClock, remoteClock) + 1;
  }
  return localClock + 1;
}

/**
 * Cache stampede protection: Round cursor timestamp to windows (e.g. 5 seconds)
 * so multiple devices from the same store querying changes share a cached result.
 */
export function getRoundedCursor(cursor: string | number, windowMs: number = 5000): string {
  const timestamp = typeof cursor === 'number' ? cursor : new Date(cursor).getTime();
  if (isNaN(timestamp)) {
    return '0';
  }
  const rounded = Math.floor(timestamp / windowMs) * windowMs;
  return rounded.toString();
}

/**
 * Evaluates the offline duration and determines the sync health status.
 */
export type SyncHealthStatus = 'synced' | 'pending' | 'escalated_warning';

export function getSyncHealth(
  lastSyncAt: string | null,
  pendingCount: number,
  nowMs: number = Date.now()
): {
  status: SyncHealthStatus;
  offlineHours: number;
  message: string;
} {
  if (!lastSyncAt) {
    return {
      status: pendingCount > 0 ? 'pending' : 'synced',
      offlineHours: 0,
      message: pendingCount > 0 ? 'Never synced, pending changes' : 'Ready'
    };
  }

  const lastSyncMs = new Date(lastSyncAt).getTime();
  const diffMs = Math.max(0, nowMs - lastSyncMs);
  const offlineHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (offlineHours >= 48) {
    return {
      status: 'escalated_warning',
      offlineHours,
      message: `Offline for ${offlineHours}h (Warning: Connect device soon to sync ledger and catalog)`
    };
  }

  if (pendingCount > 0 || diffMs > 15 * 60 * 1000) {
    return {
      status: 'pending',
      offlineHours,
      message: pendingCount > 0 ? `${pendingCount} changes queued` : 'Connecting...'
    };
  }

  return {
    status: 'synced',
    offlineHours: 0,
    message: 'All changes synced'
  };
}
