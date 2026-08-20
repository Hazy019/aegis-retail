import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import { LocalStoreDB } from './db/local-db.js';
import { PosService } from './pos/pos.service.js';
import { AegisSyncClient } from './sync/sync-client.js';
import type { Product, Customer } from '@aegis/core';

describe('Aegis Retail — Cashier POS & Local-First Engine Tests', () => {
  const storeId = crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const cashierId = crypto.randomUUID();

  let db: LocalStoreDB;
  let pos: PosService;
  let syncClient: AegisSyncClient;

  // Sample Products
  const bulkCarton: Product = {
    id: crypto.randomUUID(),
    store_id: storeId,
    sku: 'COF-CARTON-100',
    barcode: '4800016550012',
    name: 'Instant 3-in-1 Coffee (100-pack Carton)',
    unit_type: 'carton',
    units_per_bulk: 100,
    price: 85000,
    cost_price: 72000,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const unitPack: Product = {
    id: crypto.randomUUID(),
    store_id: storeId,
    sku: 'COF-SACHET-1',
    barcode: '4800016550029',
    name: 'Instant 3-in-1 Coffee (Single Sachet)',
    unit_type: 'piece',
    units_per_bulk: 1,
    bulk_parent_id: bulkCarton.id,
    price: 1000, // PHP 10.00
    cost_price: 720,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const rice: Product = {
    id: crypto.randomUUID(),
    store_id: storeId,
    sku: 'RICE-1KG',
    barcode: '4800016550036',
    name: 'Fragrant Rice 1kg',
    unit_type: 'kg',
    units_per_bulk: 1,
    price: 5500,
    cost_price: 4400,
    is_active: true,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Sample Customer
  const customer: Customer = {
    id: crypto.randomUUID(),
    store_id: storeId,
    name: 'Tia Rosa Store Account',
    phone: '+639181234567',
    credit_limit: 20000, // PHP 200.00
    current_credit_balance: 5000, // PHP 50.00
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  before(() => {
    db = new LocalStoreDB(deviceId, storeId, cashierId);
    pos = new PosService(db);
    syncClient = new AegisSyncClient(db);

    // Populate initial local catalog & inventory
    db.products.set(bulkCarton.id, bulkCarton);
    db.products.set(unitPack.id, unitPack);
    db.products.set(rice.id, rice);

    db.inventory.set(bulkCarton.id, {
      id: crypto.randomUUID(),
      store_id: storeId,
      product_id: bulkCarton.id,
      quantity: 10,
      display_quantity: 10,
      reserved_quantity: 0,
      min_threshold: 2,
      last_counted_at: null,
      updated_at: new Date().toISOString()
    });

    db.inventory.set(unitPack.id, {
      id: crypto.randomUUID(),
      store_id: storeId,
      product_id: unitPack.id,
      quantity: 50,
      display_quantity: 50,
      reserved_quantity: 0,
      min_threshold: 10,
      last_counted_at: null,
      updated_at: new Date().toISOString()
    });

    db.inventory.set(rice.id, {
      id: crypto.randomUUID(),
      store_id: storeId,
      product_id: rice.id,
      quantity: 40,
      display_quantity: 40,
      reserved_quantity: 0,
      min_threshold: 5,
      last_counted_at: null,
      updated_at: new Date().toISOString()
    });

    db.customers.set(customer.id, customer);
  });

  test('1. Sub-50ms Local Write Latency on Cash Sale', async () => {
    // Scan rice by barcode
    const scanned = pos.getProductByBarcode('4800016550036');
    assert.ok(scanned);
    assert.equal(scanned.sku, 'RICE-1KG');

    // Add 2 bags of rice to cart
    pos.addToCart(scanned.id, 2);
    const totals = pos.calculateTotals();
    assert.equal(totals.total, 11000); // 2 * 5500 = PHP 110.00

    // Cash checkout with PHP 200.00
    const { sale, latencyMs } = await pos.checkoutCash(20000);

    assert.equal(sale.payment_type, 'cash');
    assert.equal(sale.change_due, 9000);
    assert.ok(latencyMs < 50, `Local write latency (${latencyMs}ms) must be < 50ms for instant feel`);

    // Verify local inventory updated immediately
    assert.equal(pos.getStock(rice.id), 38);

    // Verify queued in sync queue
    const queue = db.getPendingQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].table_name, 'sales');
  });

  test('2. Credit Sale & Credit Limit Enforcement', async () => {
    // Current credit balance: 5000, Limit: 20000. Available headroom: 15000.
    pos.addToCart(unitPack.id, 10); // 10 sachets * 1000 = 10000
    const { sale } = await pos.checkoutCredit(customer.id);
    assert.equal(sale.payment_type, 'credit');
    assert.equal(sale.total, 10000);

    // Customer balance updated locally: 5000 + 10000 = 15000
    const updatedCust = pos.getCustomer(customer.id);
    assert.equal(updatedCust?.current_credit_balance, 15000);

    // Attempt purchase that exceeds remaining 5000 headroom
    pos.addToCart(rice.id, 2); // 11000 (exceeds limit by 6000)
    await assert.rejects(
      async () => {
        await pos.checkoutCredit(customer.id);
      },
      /Credit limit exceeded/
    );
  });

  test('3. Atomic Bulk-to-Unit Conversion at POS', async () => {
    // Current carton stock: 10
    // Current sachet stock: 40 (50 - 10 from previous sale)
    const { latencyMs } = await pos.breakBulkCarton(bulkCarton.id, 1);

    assert.ok(latencyMs < 50);
    assert.equal(pos.getStock(bulkCarton.id), 9, 'Carton stock should decrement by 1');
    assert.equal(pos.getStock(unitPack.id), 140, 'Sachet stock should increment by 100 (40 + 100)');

    const queue = db.getPendingQueue();
    const convOp = queue.find((q) => q.table_name === 'bulk_conversion');
    assert.ok(convOp, 'Bulk conversion must be queued for cloud sync');
  });

  test('4. Network Simulation & Offline Escalation Status', () => {
    // Set network to offline
    syncClient.setNetworkMode('offline');
    let state = syncClient.getState();
    assert.equal(state.networkMode, 'offline');
    assert.ok(state.statusMessage.includes('Offline'));

    // Check 48h offline escalation logic
    const oldSyncTime = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(); // 50 hours ago
    db.metadata.lastSyncAt = oldSyncTime;

    state = syncClient.getState();
    assert.equal(state.health, 'escalated_warning');
    assert.equal(state.offlineHours, 50);
    assert.ok(state.statusMessage.includes('Warning: Connect device soon'));
  });
});
