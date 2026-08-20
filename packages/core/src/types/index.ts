export type Role = 'cashier' | 'manager' | 'distributor';

export type PaymentType = 'cash' | 'credit';

export type UnitType = 'piece' | 'kg' | 'carton' | 'box' | 'pack' | 'liter';

export interface Store {
  id: string;
  name: string;
  currency: string;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  store_id: string;
  device_identifier: string;
  device_cert_public_key: string;
  label: string;
  is_revoked: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  store_id: string;
  username: string;
  email: string;
  role: Role;
  password_hash?: string;
  mfa_secret?: string;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  unit_type: UnitType;
  units_per_bulk: number; // e.g. 1 carton = 100 units
  bulk_parent_id?: string | null; // references parent bulk product if this is a broken-down unit
  price: number; // in minor currency units (cents/pesos)
  cost_price: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number; // raw calculated quantity (may be negative during conflicts)
  display_quantity: number; // clamped to 0 for cashier display
  reserved_quantity: number;
  min_threshold: number;
  last_counted_at: string | null;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Sale {
  id: string;
  store_id: string;
  device_id: string;
  customer_id?: string | null;
  cashier_id: string;
  sale_number: string;
  payment_type: PaymentType;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  change_due: number;
  status: 'completed' | 'cancelled';
  items: SaleItem[];
  client_created_at: string;
  created_at: string;
}

export interface Customer {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  credit_limit: number;
  current_credit_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreditEntryType = 'charge' | 'payment' | 'adjustment';

export interface CreditLedger {
  id: string;
  store_id: string;
  customer_id: string;
  sale_id?: string | null;
  entry_type: CreditEntryType;
  amount: number;
  balance_after: number;
  notes?: string;
  created_at: string;
}

export type SyncOp = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: string;
  device_id: string;
  idempotency_key: string; // scoped as device_id:uuid
  op: SyncOp;
  table_name: string;
  payload: Record<string, unknown>;
  client_ts: string;
  status?: 'pending' | 'syncing' | 'synced' | 'failed';
  retry_count?: number;
  error_message?: string;
}

export type InventoryEventType =
  | 'sale'
  | 'write_off'
  | 'restock'
  | 'bulk_conversion'
  | 'reconciliation';

export interface InventoryEvent {
  id: string;
  store_id: string;
  device_id: string;
  product_id: string;
  event_type: InventoryEventType;
  quantity_delta: number; // negative for sales/write-offs, positive for restock/conversions
  previous_quantity: number;
  new_quantity: number;
  causality_id?: string;
  idempotency_key: string;
  client_ts: string;
  server_ts: string;
}

export type ConflictType = 'negative_stock' | 'concurrent_write_off' | 'stale_version';

export interface InventoryAnomaly {
  id: string;
  store_id: string;
  product_id: string;
  event_id: string;
  conflict_type: ConflictType;
  calculated_stock: number;
  clamped_stock: number;
  details: string;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  store_id: string;
  previous_hash: string;
  hash: string;
  actor_id: string;
  actor_role: Role | 'system';
  action: string;
  entity_type: string;
  entity_id: string;
  payload_canonical: string;
  created_at: string;
}

export interface SyncCursor {
  store_id: string;
  device_id: string;
  last_server_version: number;
  last_sync_at: string;
  cursor_timestamp: string;
}

export interface PriceChangeProposal {
  id: string;
  store_id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  effective_at: string;
  status: 'queued' | 'active' | 'cancelled';
  created_by: string;
  created_at: string;
}
