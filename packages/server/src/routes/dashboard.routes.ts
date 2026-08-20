import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AegisRepository } from '../db/repository.js';
import type { AuthService, TokenPayload } from '../auth/auth.service.js';
import type { SyncService } from '../sync/sync.service.js';
import type { ConflictResolutionWorker } from '../worker/conflict.worker.js';
import {
  DeviceLoginSchema,
  ManagerLoginSchema,
  RefreshTokenSchema,
  RevokeDeviceSchema,
  SyncPushPayloadSchema,
  SyncPullQuerySchema,
  PricingProposalSchema,
  AnomalyResolutionSchema,
  CustomerCreationSchema,
  DamageWriteOffSchema,
  verifyAuditChain,
  getSyncHealth
} from '@aegis/core';

export function registerRoutes(
  app: FastifyInstance,
  repo: AegisRepository,
  authService: AuthService,
  syncService: SyncService,
  worker: ConflictResolutionWorker
) {
  // --- AUTH HOOK / MIDDLEWARE ---
  const authenticate = async (req: FastifyRequest, reply: FastifyReply): Promise<TokenPayload | null> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing or malformed authorization header' });
      return null;
    }
    try {
      const token = authHeader.split(' ')[1];
      const payload = authService.verifyAccessToken(token);
      (req as any).user = payload;
      return payload;
    } catch {
      reply.status(401).send({ error: 'Invalid or expired token' });
      return null;
    }
  };

  // --- AUTH ROUTES ---
  app.post('/auth/device-login', async (req, reply) => {
    try {
      const body = DeviceLoginSchema.parse(req.body);
      const tokens = await authService.loginDevice(
        body.device_id,
        body.signature,
        body.timestamp,
        body.app_version
      );
      return reply.status(200).send(tokens);
    } catch (err: any) {
      if (err.message === 'device_revoked') {
        return reply.status(401).send({ error: 'device_revoked', message: 'Device authorization has been revoked' });
      }
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post('/auth/manager-login', async (req, reply) => {
    try {
      const body = ManagerLoginSchema.parse(req.body);
      const tokens = await authService.loginManager(body.email, body.password, body.totp_code);
      return reply.status(200).send(tokens);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  app.post('/auth/refresh', async (req, reply) => {
    try {
      const body = RefreshTokenSchema.parse(req.body);
      const tokens = await authService.refreshAccessToken(body.refresh_token);
      return reply.status(200).send(tokens);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  app.post('/auth/revoke-device', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    try {
      const body = RevokeDeviceSchema.parse(req.body);
      const success = await repo.revokeDevice(body.device_id, user.store_id, user.user_id || 'manager');
      if (!success) {
        return reply.status(404).send({ error: 'Device not found or not belonging to store' });
      }
      return reply.status(200).send({ status: 'revoked', device_id: body.device_id });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --- SYNC ROUTES ---
  app.post('/sync/push', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'cashier' || !user.device_id) {
      return reply.status(403).send({ error: 'Forbidden: device cashier token required' });
    }

    try {
      const payload = SyncPushPayloadSchema.parse(req.body);
      const result = await syncService.processPush(user.store_id, user.device_id, payload);
      return reply.status(202).send(result);
    } catch (err: any) {
      if (err.message === 'device_revoked') {
        return reply.status(401).send({ error: 'device_revoked' });
      }
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/sync/pull', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user) return;

    try {
      const query = SyncPullQuerySchema.parse(req.query);
      const deviceId = user.device_id || 'dashboard';
      const result = await syncService.processPull(user.store_id, deviceId, query.since);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --- DASHBOARD: STORE HEALTH & STATUS ---
  app.get('/dashboard/stores/:id/status', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    const { id } = req.params as { id: string };
    if (user.store_id !== id) {
      return reply.status(403).send({ error: 'Store boundary access violation' });
    }

    const store = await repo.getStore(id);
    const devices = await repo.listDevicesByStore(id);

    const deviceStatuses = devices.map((d) => {
      const health = getSyncHealth(d.last_sync_at, 0);
      return {
        id: d.id,
        label: d.label,
        identifier: d.device_identifier,
        is_revoked: d.is_revoked,
        last_sync_at: d.last_sync_at,
        sync_health: health.status,
        offline_hours: health.offlineHours,
        status_message: health.message
      };
    });

    return reply.status(200).send({
      store,
      devices: deviceStatuses
    });
  });

  // --- DASHBOARD: PRICING & CATALOG ---
  app.get('/dashboard/pricing', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user) return;

    const products = await repo.listProducts(user.store_id);
    const inventory = await repo.listInventory(user.store_id);
    const proposals = await repo.listPriceProposals(user.store_id);

    const enriched = products.map((p) => {
      const inv = inventory.find((i) => i.product_id === p.id);
      const pendingProposal = proposals.find((pr) => pr.product_id === p.id && pr.status === 'queued');
      return {
        ...p,
        stock_quantity: inv ? inv.quantity : 0,
        display_quantity: inv ? inv.display_quantity : 0,
        pending_price: pendingProposal ? pendingProposal.new_price : null
      };
    });

    return reply.status(200).send({ products: enriched, proposals });
  });

  app.post('/dashboard/pricing/propose', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    try {
      const body = PricingProposalSchema.parse(req.body);
      const product = await repo.getProduct(body.product_id, user.store_id);
      if (!product) return reply.status(404).send({ error: 'Product not found' });

      // In MVP, manager directly updates the master price (queued for device sync)
      const updated = await repo.updateProductPrice(
        body.product_id,
        user.store_id,
        body.new_price,
        user.user_id || 'manager'
      );

      return reply.status(200).send({ status: 'price_updated', product: updated });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --- DASHBOARD: DAMAGE WRITE-OFF ---
  app.post('/dashboard/inventory/write-off', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    try {
      const body = DamageWriteOffSchema.parse(req.body);
      const event = await worker.processDamageWriteOff(
        user.store_id,
        user.user_id || 'manager',
        body.product_id,
        body.quantity,
        body.reason,
        body.idempotency_key
      );
      return reply.status(200).send({ status: 'written_off', event });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --- DASHBOARD: ANOMALIES & CONFLICT RECONCILIATION ---
  app.get('/dashboard/anomalies', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    const anomalies = await repo.listAnomalies(user.store_id, true);
    return reply.status(200).send({ anomalies });
  });

  app.post('/dashboard/anomalies/:id/resolve', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    const { id } = req.params as { id: string };
    try {
      const body = AnomalyResolutionSchema.parse({ ...(req.body as Record<string, unknown>), anomaly_id: id });
      const resolved = await repo.resolveAnomaly(
        id,
        user.store_id,
        user.user_id || 'manager',
        body.resolution_notes,
        body.adjusted_quantity
      );
      return reply.status(200).send({ status: 'resolved', anomaly: resolved });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --- DASHBOARD: CUSTOMERS & CREDIT LEDGER ---
  app.get('/dashboard/credit', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user) return;

    const customers = await repo.listCustomers(user.store_id);
    return reply.status(200).send({ customers });
  });

  app.post('/dashboard/credit/customer', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    try {
      const body = CustomerCreationSchema.parse(req.body);
      const customer = await repo.createCustomer(user.store_id, body);
      return reply.status(201).send(customer);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get('/dashboard/credit/:customerId/history', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user) return;

    const { customerId } = req.params as { customerId: string };
    const history = await repo.getCreditHistory(customerId, user.store_id);
    return reply.status(200).send({ customer_id: customerId, history });
  });

  // --- DASHBOARD: AUDIT LOG EXPLORER WITH HASH VERIFICATION ---
  app.get('/dashboard/audit', async (req, reply) => {
    const user = await authenticate(req, reply);
    if (!user || user.role !== 'manager') return;

    const logs = await repo.listAuditLogs(user.store_id);
    const verification = verifyAuditChain(logs);

    return reply.status(200).send({
      logs,
      verification: {
        is_tamper_evident: true,
        chain_valid: verification.valid,
        total_entries: logs.length,
        broken_at_index: verification.brokenAtIndex ?? null
      }
    });
  });
}
