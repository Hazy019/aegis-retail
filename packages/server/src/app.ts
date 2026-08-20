import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';
import { AegisRepository } from './db/repository.js';
import { AuthService } from './auth/auth.service.js';
import { ConflictResolutionWorker } from './worker/conflict.worker.js';
import { SyncService } from './sync/sync.service.js';
import { registerRoutes } from './routes/dashboard.routes.js';
import { generateDeviceKeyPair } from '@aegis/core';

export interface AppContext {
  app: FastifyInstance;
  repo: AegisRepository;
  authService: AuthService;
  syncService: SyncService;
  worker: ConflictResolutionWorker;
  seedData: {
    storeId: string;
    managerUser: { email: string; rawPassword: string };
    device: { id: string; identifier: string; privateKey: string; publicKey: string };
    products: { bulkCartonId: string; unitPackId: string; riceId: string };
  };
}

export async function createApp(): Promise<AppContext> {
  const app = Fastify({
    logger: false,
    trustProxy: true
  });

  // Strict HTTP Security Headers
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    return payload;
  });

  // Global Error Handler: Suppress raw stack traces and technical errors from client responses
  app.setErrorHandler((error, request, reply) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[Security Log] [${request.id}] Error on ${request.method} ${request.url}:`, error.message);
    }
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected server error occurred. The incident has been logged.'
      });
    } else {
      reply.status(statusCode).send({
        error: error.name || 'RequestError',
        message: error.message
      });
    }
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  const repo = new AegisRepository();
  const authService = new AuthService(repo, process.env.JWT_SECRET || 'aegis_super_secret_jwt_key_development_2026');
  const worker = new ConflictResolutionWorker(repo);
  const syncService = new SyncService(repo, worker);

  // Register all endpoints
  registerRoutes(app, repo, authService, syncService, worker);

  // Health check
  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  // --- INITIAL SEED DATA FOR DEMO & TESTING ---
  const store = await repo.createStore({
    name: 'Aegis Sari-Sari Store #104',
    currency: 'PHP',
    region: 'Barangay Central'
  });

  // Seed Manager User (Environment variable override or fallback)
  const rawPassword = process.env.MANAGER_SEED_PASSWORD || 'Password123!';
  const managerEmail = process.env.MANAGER_SEED_EMAIL || 'manager@aegisretail.local';
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const managerUser = await repo.createUser({
    store_id: store.id,
    username: 'Elena Santos',
    email: managerEmail,
    role: 'manager',
    password_hash: passwordHash,
    mfa_enabled: false,
    is_active: true
  });

  // Seed Cashier Device
  const { publicKey, privateKey } = generateDeviceKeyPair();
  const device = await repo.registerDevice({
    store_id: store.id,
    device_identifier: 'AEGIS-POS-001',
    device_cert_public_key: publicKey,
    label: 'Front Counter Terminal #1'
  });

  // Seed Products
  // 1. Bulk Product (Carton)
  const { product: bulkCarton } = await repo.createProduct(
    store.id,
    {
      sku: 'COF-CARTON-100',
      barcode: '4800016550012',
      name: 'Instant 3-in-1 Coffee (100-pack Carton)',
      description: 'Master carton of 100 coffee sachets',
      unit_type: 'carton',
      units_per_bulk: 100,
      price: 85000, // PHP 850.00
      cost_price: 72000,
      is_active: true
    },
    15 // 15 master cartons in stock
  );

  // 2. Unit Product (Broken-down Sachet)
  const { product: unitPack } = await repo.createProduct(
    store.id,
    {
      sku: 'COF-SACHET-1',
      barcode: '4800016550029',
      name: 'Instant 3-in-1 Coffee (Single Sachet)',
      description: 'Single sachet extracted from bulk carton',
      unit_type: 'piece',
      units_per_bulk: 1,
      bulk_parent_id: bulkCarton.id,
      price: 1000, // PHP 10.00
      cost_price: 720,
      is_active: true
    },
    80 // 80 individual sachets
  );

  // 3. Premium Rice 1kg
  const { product: rice } = await repo.createProduct(
    store.id,
    {
      sku: 'RICE-JASMINE-1KG',
      barcode: '4800016550036',
      name: 'Jasmine Fragrant Rice (1kg)',
      description: 'First grade milled rice',
      unit_type: 'kg',
      units_per_bulk: 1,
      price: 5500, // PHP 55.00
      cost_price: 4400,
      is_active: true
    },
    50
  );

  // 4. Sardines in Tomato Sauce
  await repo.createProduct(
    store.id,
    {
      sku: 'SAR-TOMATO-155G',
      barcode: '4800016550043',
      name: 'Mega Sardines in Tomato Sauce (155g)',
      description: 'Canned fish in rich tomato sauce',
      unit_type: 'piece',
      units_per_bulk: 1,
      price: 2400, // PHP 24.00
      cost_price: 1950,
      is_active: true
    },
    45
  );

  // 5. Laundry Detergent Bar
  await repo.createProduct(
    store.id,
    {
      sku: 'DET-BAR-380G',
      barcode: '4800016550050',
      name: 'Tide Laundry Detergent Bar (380g)',
      description: 'Blue stain-fighting detergent bar',
      unit_type: 'piece',
      units_per_bulk: 1,
      price: 3200, // PHP 32.00
      cost_price: 2600,
      is_active: true
    },
    30
  );

  // Seed Customers with Credit
  const customer1 = await repo.createCustomer(store.id, {
    name: 'Maria Clara',
    phone: '+639171234567',
    credit_limit: 100000 // PHP 1,000.00 credit limit
  });
  await repo.recordCreditCharge(store.id, customer1.id, null, 25000, 'Initial running ledger balance');

  const customer2 = await repo.createCustomer(store.id, {
    name: 'Juan Dela Cruz',
    phone: '+639209876543',
    credit_limit: 50000 // PHP 500.00 credit limit
  });

  return {
    app,
    repo,
    authService,
    syncService,
    worker,
    seedData: {
      storeId: store.id,
      managerUser: { email: managerUser.email, rawPassword },
      device: {
        id: device.id,
        identifier: device.device_identifier,
        privateKey,
        publicKey
      },
      products: {
        bulkCartonId: bulkCarton.id,
        unitPackId: unitPack.id,
        riceId: rice.id
      }
    }
  };
}
