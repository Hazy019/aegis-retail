import { z } from 'zod';

export const RoleSchema = z.enum(['cashier', 'manager', 'distributor']);
export const PaymentTypeSchema = z.enum(['cash', 'credit']);
export const UnitTypeSchema = z.enum(['piece', 'kg', 'carton', 'box', 'pack', 'liter']);
export const SyncOpSchema = z.enum(['CREATE', 'UPDATE', 'DELETE']);

// Auth Schemas
export const DeviceLoginSchema = z.object({
  device_id: z.string().uuid(),
  signature: z.string().min(10),
  timestamp: z.string().datetime(),
  app_version: z.string().optional()
});

export const ManagerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totp_code: z.string().length(6).optional()
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(20)
});

export const RevokeDeviceSchema = z.object({
  device_id: z.string().uuid(),
  reason: z.string().min(3).optional()
});

// Sale Item & Sale Schemas
export const SaleItemSchema = z.object({
  id: z.string().uuid().optional(),
  sale_id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().int().nonnegative(),
  total_price: z.number().int().nonnegative()
});

export const SaleCreationSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid().optional(),
  device_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  cashier_id: z.string().uuid(),
  sale_number: z.string().min(1),
  payment_type: PaymentTypeSchema,
  subtotal: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  amount_paid: z.number().int().nonnegative(),
  change_due: z.number().int().nonnegative(),
  status: z.enum(['completed', 'cancelled']).default('completed'),
  items: z.array(SaleItemSchema).min(1),
  client_created_at: z.string().datetime()
});

// Sync Payload Schemas
export const SyncQueueItemSchema = z.object({
  id: z.string().uuid(),
  device_id: z.string().uuid(),
  idempotency_key: z.string().regex(/^[\w-]+:[\w-]+$/, {
    message: 'Idempotency key must be in format device_id:uuid'
  }),
  op: SyncOpSchema,
  table_name: z.string().min(1),
  payload: z.record(z.unknown()),
  client_ts: z.string().datetime(),
  status: z.enum(['pending', 'syncing', 'synced', 'failed']).optional(),
  retry_count: z.number().int().optional(),
  error_message: z.string().optional()
});

export const SyncPushPayloadSchema = z.object({
  device_id: z.string().uuid(),
  sync_batch_id: z.string().uuid(),
  operations: z.array(SyncQueueItemSchema).max(500)
});

export const SyncPullQuerySchema = z.object({
  since: z.string().optional().default('0'),
  limit: z.coerce.number().int().positive().max(500).default(100)
});

// Inventory Schemas
export const BulkConversionSchema = z.object({
  carton_product_id: z.string().uuid(),
  unit_product_id: z.string().uuid(),
  cartons_to_convert: z.number().int().positive(),
  units_yielded: z.number().int().positive(),
  idempotency_key: z.string().regex(/^[\w-]+:[\w-]+$/),
  notes: z.string().optional()
});

export const DamageWriteOffSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().min(3),
  idempotency_key: z.string().regex(/^[\w-]+:[\w-]+$/)
});

// Pricing Proposal Schema
export const PricingProposalSchema = z.object({
  product_id: z.string().uuid(),
  new_price: z.number().int().nonnegative(),
  effective_at: z.string().datetime().optional()
});

// Customer & Credit Schemas
export const CustomerCreationSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  credit_limit: z.number().int().nonnegative().default(0)
});

export const CreditPaymentSchema = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().int().positive(),
  notes: z.string().optional(),
  idempotency_key: z.string().regex(/^[\w-]+:[\w-]+$/)
});

// Anomaly Resolution Schema
export const AnomalyResolutionSchema = z.object({
  anomaly_id: z.string().uuid(),
  action: z.enum(['accept_negative_and_restock', 'adjust_inventory', 'dismiss']),
  adjusted_quantity: z.number().int().optional(),
  resolution_notes: z.string().min(3)
});
