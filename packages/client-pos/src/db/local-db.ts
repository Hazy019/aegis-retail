import * as crypto from 'crypto';
import type {
  Product,
  Inventory,
  Sale,
  Customer,
  CreditLedger,
  SyncQueueItem
} from '@aegis/core';
import { createIdempotencyKey } from '@aegis/core';

export interface LocalMetadata {
  deviceId: string;
  storeId: string;
  cashierId: string;
  lastSyncAt: string | null;
  cursor: string;
}

export class LocalStoreDB {
  public products: Map<string, Product> = new Map();
  public inventory: Map<string, Inventory> = new Map();
  public sales: Map<string, Sale> = new Map();
  public customers: Map<string, Customer> = new Map();
  public creditLedger: Map<string, CreditLedger[]> = new Map();
  public syncQueue: SyncQueueItem[] = [];
  public metadata: LocalMetadata;

  constructor(deviceId: string, storeId: string, cashierId: string) {
    this.metadata = {
      deviceId,
      storeId,
      cashierId,
      lastSyncAt: null,
      cursor: '0'
    };
  }

  /**
   * Records a local sale and immediately decrements local stock atomically.
   * Benchmarks local write latency to ensure <50ms instant response.
   */
  async recordSaleLocal(saleData: Omit<Sale, 'created_at'>): Promise<{ sale: Sale; latencyMs: number }> {
    const startTime = performance.now();

    const sale: Sale = {
      ...saleData,
      created_at: new Date().toISOString()
    };

    // 1. Write sale locally
    this.sales.set(sale.id, sale);

    // 2. Decrement local inventory
    for (const item of sale.items) {
      let inv = this.inventory.get(item.product_id);
      if (!inv) {
        inv = {
          id: crypto.randomUUID(),
          store_id: this.metadata.storeId,
          product_id: item.product_id,
          quantity: 0,
          display_quantity: 0,
          reserved_quantity: 0,
          min_threshold: 5,
          last_counted_at: null,
          updated_at: new Date().toISOString()
        };
        this.inventory.set(item.product_id, inv);
      }
      inv.quantity -= item.quantity;
      inv.display_quantity = Math.max(0, inv.quantity);
      inv.updated_at = new Date().toISOString();
    }

    // 3. If credit sale, update local customer credit balance
    if (sale.payment_type === 'credit' && sale.customer_id) {
      const cust = this.customers.get(sale.customer_id);
      if (cust) {
        cust.current_credit_balance += sale.total;
        cust.updated_at = new Date().toISOString();
      }
    }

    // 4. Append to local sync queue with composite idempotency key
    const idempotencyKey = createIdempotencyKey(this.metadata.deviceId);
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      device_id: this.metadata.deviceId,
      idempotency_key: idempotencyKey,
      op: 'CREATE',
      table_name: 'sales',
      payload: sale as unknown as Record<string, unknown>,
      client_ts: sale.client_created_at,
      status: 'pending',
      retry_count: 0
    };
    this.syncQueue.push(queueItem);

    const endTime = performance.now();
    const latencyMs = Math.round((endTime - startTime) * 100) / 100;

    return { sale, latencyMs };
  }

  /**
   * Atomic Bulk-to-Unit Conversion locally.
   */
  async convertBulkToUnitsLocal(
    cartonProductId: string,
    unitProductId: string,
    cartonsToConvert: number,
    unitsYielded: number,
    notes?: string
  ): Promise<{ latencyMs: number }> {
    const startTime = performance.now();

    const cartonInv = this.inventory.get(cartonProductId);
    const unitInv = this.inventory.get(unitProductId);

    if (cartonInv) {
      cartonInv.quantity -= cartonsToConvert;
      cartonInv.display_quantity = Math.max(0, cartonInv.quantity);
      cartonInv.updated_at = new Date().toISOString();
    }

    if (unitInv) {
      unitInv.quantity += unitsYielded;
      unitInv.display_quantity = Math.max(0, unitInv.quantity);
      unitInv.updated_at = new Date().toISOString();
    }

    const idempotencyKey = createIdempotencyKey(this.metadata.deviceId);
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      device_id: this.metadata.deviceId,
      idempotency_key: idempotencyKey,
      op: 'CREATE',
      table_name: 'bulk_conversion',
      payload: {
        carton_product_id: cartonProductId,
        unit_product_id: unitProductId,
        cartons_to_convert: cartonsToConvert,
        units_yielded: unitsYielded,
        idempotency_key: idempotencyKey,
        notes
      },
      client_ts: new Date().toISOString(),
      status: 'pending',
      retry_count: 0
    };
    this.syncQueue.push(queueItem);

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    return { latencyMs };
  }

  /**
   * Gets pending operations from the local sync queue.
   */
  getPendingQueue(): SyncQueueItem[] {
    return this.syncQueue.filter((q) => q.status === 'pending' || q.status === 'failed');
  }

  /**
   * Marks operations as synced once acknowledged by the server.
   */
  markQueueItemsSynced(acknowledgedKeys: string[]): void {
    const set = new Set(acknowledgedKeys);
    this.syncQueue = this.syncQueue.filter((q) => !set.has(q.idempotency_key));
    this.metadata.lastSyncAt = new Date().toISOString();
  }

  /**
   * Applies pulled delta products and customers into local store.
   */
  applyPulledDelta(deltaProducts: Product[], deltaCustomers: Customer[], newCursor: string): void {
    for (const p of deltaProducts) {
      this.products.set(p.id, p);
    }
    for (const c of deltaCustomers) {
      this.customers.set(c.id, c);
    }
    this.metadata.cursor = newCursor;
    this.metadata.lastSyncAt = new Date().toISOString();
  }
}
