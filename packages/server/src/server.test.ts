import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import { createApp, AppContext } from './app.js';
import {
  signWithDeviceKey,
  createIdempotencyKey,
  verifyAuditChain,
  GENESIS_HASH
} from '@aegis/core';

describe('Aegis Retail — Cloud Backend & Conflict Engine Tests', () => {
  let ctx: AppContext;
  let cashierToken: string;
  let managerToken: string;

  before(async () => {
    ctx = await createApp();

    // 1. Authenticate Cashier Device
    const timestamp = new Date().toISOString();
    const signaturePayload = `${ctx.seedData.device.id}:${timestamp}`;
    const signature = signWithDeviceKey(ctx.seedData.device.privateKey, signaturePayload);

    const deviceLoginRes = await ctx.app.inject({
      method: 'POST',
      url: '/auth/device-login',
      payload: {
        device_id: ctx.seedData.device.id,
        signature,
        timestamp
      }
    });

    assert.equal(deviceLoginRes.statusCode, 200);
    const deviceAuth = JSON.parse(deviceLoginRes.body);
    assert.ok(deviceAuth.access_token);
    assert.ok(deviceAuth.refresh_token);
    cashierToken = deviceAuth.access_token;

    // 2. Authenticate Manager
    const managerLoginRes = await ctx.app.inject({
      method: 'POST',
      url: '/auth/manager-login',
      payload: {
        email: ctx.seedData.managerUser.email,
        password: ctx.seedData.managerUser.rawPassword
      }
    });

    assert.equal(managerLoginRes.statusCode, 200);
    const managerAuth = JSON.parse(managerLoginRes.body);
    assert.ok(managerAuth.access_token);
    managerToken = managerAuth.access_token;
  });

  test('1. Multi-Tenant RLS Boundary Enforcement', async () => {
    // Create a second store (Store B)
    const storeB = await ctx.repo.createStore({ name: 'Store B - Island Branch' });
    const { product: prodB } = await ctx.repo.createProduct(
      storeB.id,
      {
        sku: 'STORE-B-ITEM',
        barcode: '9990001',
        name: 'Store B Exclusive Coconut Oil',
        unit_type: 'piece',
        units_per_bulk: 1,
        price: 5000,
        cost_price: 3500,
        is_active: true
      },
      20
    );

    // Cashier from Store A attempts to query Store B products
    const pullRes = await ctx.app.inject({
      method: 'GET',
      url: '/sync/pull?since=0',
      headers: { authorization: `Bearer ${cashierToken}` }
    });

    assert.equal(pullRes.statusCode, 200);
    const pulled = JSON.parse(pullRes.body);
    const hasStoreBProduct = pulled.delta_products.some((p: any) => p.id === prodB.id || p.store_id === storeB.id);
    assert.equal(hasStoreBProduct, false, 'Store A must never receive Store B products');
  });

  test('2. Delta Sync Push with Idempotency & Replay Defense', async () => {
    const saleId = crypto.randomUUID();
    const idempotencyKey = createIdempotencyKey(ctx.seedData.device.id);

    const salePayload = {
      id: saleId,
      device_id: ctx.seedData.device.id,
      cashier_id: crypto.randomUUID(),
      sale_number: 'SALE-2026-001',
      payment_type: 'cash',
      subtotal: 5500,
      tax: 0,
      total: 5500,
      amount_paid: 6000,
      change_due: 500,
      status: 'completed',
      client_created_at: new Date().toISOString(),
      items: [
        {
          product_id: ctx.seedData.products.riceId,
          sku: 'RICE-JASMINE-1KG',
          name: 'Jasmine Fragrant Rice (1kg)',
          quantity: 1,
          unit_price: 5500,
          total_price: 5500
        }
      ]
    };

    const pushPayload = {
      device_id: ctx.seedData.device.id,
      sync_batch_id: crypto.randomUUID(),
      operations: [
        {
          id: crypto.randomUUID(),
          device_id: ctx.seedData.device.id,
          idempotency_key: idempotencyKey,
          op: 'CREATE',
          table_name: 'sales',
          payload: salePayload,
          client_ts: new Date().toISOString()
        }
      ]
    };

    // First push (Initial sync)
    const firstPush = await ctx.app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: pushPayload
    });

    assert.equal(firstPush.statusCode, 202);
    const firstRes = JSON.parse(firstPush.body);
    assert.deepEqual(firstRes.acknowledged_keys, [idempotencyKey]);
    assert.deepEqual(firstRes.dropped_duplicate_keys, []);

    // Check inventory decrement (initial 50 - 1 = 49)
    const inv = await ctx.repo.getInventory(ctx.seedData.products.riceId, ctx.seedData.storeId);
    assert.equal(inv?.quantity, 49);

    // Replay attack / Network timeout duplicate push with identical idempotency key
    const replayPush = await ctx.app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: pushPayload
    });

    assert.equal(replayPush.statusCode, 202);
    const replayRes = JSON.parse(replayPush.body);
    assert.deepEqual(replayRes.acknowledged_keys, [idempotencyKey]);
    assert.deepEqual(replayRes.dropped_duplicate_keys, [idempotencyKey]);

    // Verify stock was NOT double decremented (remains 49)
    const invAfterReplay = await ctx.repo.getInventory(ctx.seedData.products.riceId, ctx.seedData.storeId);
    assert.equal(invAfterReplay?.quantity, 49, 'Idempotency must prevent double decrementing inventory');
  });

  test('3. Conflict Resolution Engine: Offline Sale vs Manager Write-off', async () => {
    // Current rice stock is 49.
    // Step A: Manager writes off 45 units due to water damage.
    const writeOffRes = await ctx.app.inject({
      method: 'POST',
      url: '/dashboard/inventory/write-off',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        product_id: ctx.seedData.products.riceId,
        quantity: 45,
        reason: 'Water damage during storm',
        idempotency_key: createIdempotencyKey('manager', crypto.randomUUID())
      }
    });
    assert.equal(writeOffRes.statusCode, 200);

    // Stock is now 49 - 45 = 4 units.

    // Step B: Cashier was offline and sold 10 units concurrently before receiving manager update.
    const offlineSaleId = crypto.randomUUID();
    const offlineSaleKey = createIdempotencyKey(ctx.seedData.device.id);

    const offlineSalePush = await ctx.app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        device_id: ctx.seedData.device.id,
        sync_batch_id: crypto.randomUUID(),
        operations: [
          {
            id: crypto.randomUUID(),
            device_id: ctx.seedData.device.id,
            idempotency_key: offlineSaleKey,
            op: 'CREATE',
            table_name: 'sales',
            payload: {
              id: offlineSaleId,
              device_id: ctx.seedData.device.id,
              cashier_id: crypto.randomUUID(),
              sale_number: 'SALE-OFFLINE-002',
              payment_type: 'cash',
              subtotal: 55000,
              tax: 0,
              total: 55000,
              amount_paid: 55000,
              change_due: 0,
              status: 'completed',
              client_created_at: new Date().toISOString(),
              items: [
                {
                  product_id: ctx.seedData.products.riceId,
                  sku: 'RICE-JASMINE-1KG',
                  name: 'Jasmine Fragrant Rice (1kg)',
                  quantity: 10,
                  unit_price: 5500,
                  total_price: 55000
                }
              ]
            },
            client_ts: new Date().toISOString()
          }
        ]
      }
    });

    assert.equal(offlineSalePush.statusCode, 202);

    // Check inventory state:
    // Raw calculated quantity should be 4 - 10 = -6.
    // Display quantity must be clamped to 0 for cashier safety.
    const inv = await ctx.repo.getInventory(ctx.seedData.products.riceId, ctx.seedData.storeId);
    assert.equal(inv?.quantity, -6, 'Raw inventory reflects true calculated deficit');
    assert.equal(inv?.display_quantity, 0, 'Display quantity must be clamped at 0');

    // Verify InventoryAnomaly was generated
    const anomaliesRes = await ctx.app.inject({
      method: 'GET',
      url: '/dashboard/anomalies',
      headers: { authorization: `Bearer ${managerToken}` }
    });
    assert.equal(anomaliesRes.statusCode, 200);
    const anomalies = JSON.parse(anomaliesRes.body).anomalies;
    const riceAnomaly = anomalies.find((a: any) => a.product_id === ctx.seedData.products.riceId);
    assert.ok(riceAnomaly, 'Inventory anomaly must be raised for negative stock conflict');
    assert.equal(riceAnomaly.conflict_type, 'negative_stock');
    assert.equal(riceAnomaly.calculated_stock, -6);

    // Manager reconciles anomaly by restocking and adjusting
    const resolveRes = await ctx.app.inject({
      method: 'POST',
      url: `/dashboard/anomalies/${riceAnomaly.id}/resolve`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        action: 'adjust_inventory',
        adjusted_quantity: 20,
        resolution_notes: 'Restocked from supplier warehouse batch #892'
      }
    });
    assert.equal(resolveRes.statusCode, 200);

    const reconciledInv = await ctx.repo.getInventory(ctx.seedData.products.riceId, ctx.seedData.storeId);
    assert.equal(reconciledInv?.quantity, 20);
    assert.equal(reconciledInv?.display_quantity, 20);
  });

  test('4. Bulk-to-Unit Atomic Inventory Conversion', async () => {
    // 1 carton of coffee = 100 units
    // Initial carton stock: 15 cartons
    // Initial sachet stock: 80 sachets
    const convKey = createIdempotencyKey(ctx.seedData.device.id);

    const pushRes = await ctx.app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        device_id: ctx.seedData.device.id,
        sync_batch_id: crypto.randomUUID(),
        operations: [
          {
            id: crypto.randomUUID(),
            device_id: ctx.seedData.device.id,
            idempotency_key: convKey,
            op: 'CREATE',
            table_name: 'bulk_conversion',
            payload: {
              carton_product_id: ctx.seedData.products.bulkCartonId,
              unit_product_id: ctx.seedData.products.unitPackId,
              cartons_to_convert: 2, // Break down 2 cartons
              units_yielded: 200,    // Yield 200 individual sachets
              idempotency_key: convKey,
              notes: 'Morning counter breakdown'
            },
            client_ts: new Date().toISOString()
          }
        ]
      }
    });

    assert.equal(pushRes.statusCode, 202);

    const cartonInv = await ctx.repo.getInventory(ctx.seedData.products.bulkCartonId, ctx.seedData.storeId);
    const unitInv = await ctx.repo.getInventory(ctx.seedData.products.unitPackId, ctx.seedData.storeId);

    assert.equal(cartonInv?.quantity, 13, 'Cartons must decrement by 2 (15 -> 13)');
    assert.equal(unitInv?.quantity, 280, 'Sachets must increment by 200 (80 -> 280)');
  });

  test('5. Remote Device Revocation Security Path', async () => {
    // Manager revokes Cashier Device
    const revokeRes = await ctx.app.inject({
      method: 'POST',
      url: '/auth/revoke-device',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        device_id: ctx.seedData.device.id,
        reason: 'Reported lost or stolen terminal'
      }
    });
    assert.equal(revokeRes.statusCode, 200);

    // Subsequent sync push by the revoked device must be rejected with 401 device_revoked
    const pushAttempt = await ctx.app.inject({
      method: 'POST',
      url: '/sync/push',
      headers: { authorization: `Bearer ${cashierToken}` },
      payload: {
        device_id: ctx.seedData.device.id,
        sync_batch_id: crypto.randomUUID(),
        operations: []
      }
    });
    assert.equal(pushAttempt.statusCode, 401);
    const errBody = JSON.parse(pushAttempt.body);
    assert.equal(errBody.error, 'device_revoked');
  });

  test('6. Tamper-Evident Cryptographic Audit Trail Verification', async () => {
    const auditRes = await ctx.app.inject({
      method: 'GET',
      url: '/dashboard/audit',
      headers: { authorization: `Bearer ${managerToken}` }
    });

    assert.equal(auditRes.statusCode, 200);
    const body = JSON.parse(auditRes.body);
    assert.ok(body.logs.length > 5, 'Audit log must record every mutation');
    assert.equal(body.verification.chain_valid, true, 'Cryptographic hash chain must be 100% valid');
    assert.equal(body.verification.broken_at_index, null);

    // Local programmatic verification
    const localVerification = verifyAuditChain(body.logs);
    assert.equal(localVerification.valid, true);

    // Simulate tampering of an audit payload in memory and verify failure detection
    const tamperedLogs = JSON.parse(JSON.stringify(body.logs));
    tamperedLogs[2].payload_canonical = JSON.stringify({ forged: 'malicious modification' });
    const tamperedVerification = verifyAuditChain(tamperedLogs);
    assert.equal(tamperedVerification.valid, false, 'Tampered audit trail must fail cryptographic verification');
    assert.equal(tamperedVerification.brokenAtIndex, 2);
  });
});
