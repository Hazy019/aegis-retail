import * as crypto from 'crypto';
import type {
  Store,
  Device,
  User,
  Product,
  Inventory,
  Sale,
  SaleItem,
  Customer,
  CreditLedger,
  InventoryEvent,
  InventoryAnomaly,
  PriceChangeProposal,
  AuditLogEntry,
  SyncCursor
} from '@aegis/core';
import {
  GENESIS_HASH,
  computeAuditHash,
  canonicalizeJson
} from '@aegis/core';

export class AegisRepository {
  private stores: Map<string, Store> = new Map();
  private devices: Map<string, Device> = new Map();
  private users: Map<string, User> = new Map();
  private products: Map<string, Product> = new Map();
  private inventory: Map<string, Inventory> = new Map();
  private customers: Map<string, Customer> = new Map();
  private sales: Map<string, Sale> = new Map();
  private creditLedger: Map<string, CreditLedger[]> = new Map(); // customer_id -> entries
  private inventoryEvents: InventoryEvent[] = [];
  private anomalies: Map<string, InventoryAnomaly> = new Map();
  private priceProposals: Map<string, PriceChangeProposal> = new Map();
  private syncCursors: Map<string, SyncCursor> = new Map(); // `${storeId}:${deviceId}` -> cursor
  private auditLogs: Map<string, AuditLogEntry[]> = new Map(); // store_id -> entries
  private refreshTokens: Map<string, { userId?: string; deviceId?: string; tokenHash: string; familyId: string; isRevoked: boolean; expiresAt: string }> = new Map();

  // --- STORES ---
  async createStore(data: { name: string; currency?: string; region?: string }): Promise<Store> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const store: Store = {
      id,
      name: data.name,
      currency: data.currency || 'PHP',
      region: data.region || 'Southeast Asia',
      created_at: now,
      updated_at: now
    };
    this.stores.set(id, store);
    await this.appendAuditLog(id, 'system', 'system', 'CREATE', 'store', id, store);
    return store;
  }

  async getStore(id: string): Promise<Store | null> {
    return this.stores.get(id) || null;
  }

  // --- DEVICES ---
  async registerDevice(data: {
    store_id: string;
    device_identifier: string;
    device_cert_public_key: string;
    label: string;
  }): Promise<Device> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const device: Device = {
      id,
      store_id: data.store_id,
      device_identifier: data.device_identifier,
      device_cert_public_key: data.device_cert_public_key,
      label: data.label,
      is_revoked: false,
      last_sync_at: null,
      created_at: now,
      updated_at: now
    };
    this.devices.set(id, device);
    await this.appendAuditLog(data.store_id, 'manager', 'system', 'REGISTER_DEVICE', 'device', id, {
      device_identifier: device.device_identifier,
      label: device.label
    });
    return device;
  }

  async getDevice(id: string): Promise<Device | null> {
    return this.devices.get(id) || null;
  }

  async getDeviceByIdentifier(identifier: string): Promise<Device | null> {
    for (const d of this.devices.values()) {
      if (d.device_identifier === identifier) return d;
    }
    return null;
  }

  async listDevicesByStore(storeId: string): Promise<Device[]> {
    return Array.from(this.devices.values()).filter((d) => d.store_id === storeId);
  }

  async updateDeviceSync(id: string, lastSyncAt: string): Promise<void> {
    const device = this.devices.get(id);
    if (device) {
      device.last_sync_at = lastSyncAt;
      device.updated_at = new Date().toISOString();
    }
  }

  async revokeDevice(id: string, storeId: string, actorId: string): Promise<boolean> {
    const device = this.devices.get(id);
    if (device && device.store_id === storeId) {
      device.is_revoked = true;
      device.updated_at = new Date().toISOString();
      await this.appendAuditLog(storeId, actorId, 'manager', 'REVOKE_DEVICE', 'device', id, {
        revoked: true
      });
      return true;
    }
    return false;
  }

  // --- USERS ---
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newUser: User = { ...user, id, created_at: now, updated_at: now };
    this.users.set(id, newUser);
    return newUser;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  // --- PRODUCTS & INVENTORY ---
  async createProduct(
    storeId: string,
    data: Omit<Product, 'id' | 'store_id' | 'version' | 'created_at' | 'updated_at'>,
    initialQuantity: number = 0
  ): Promise<{ product: Product; inventory: Inventory }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const product: Product = {
      ...data,
      id,
      store_id: storeId,
      version: 1,
      created_at: now,
      updated_at: now
    };
    this.products.set(id, product);

    const invId = crypto.randomUUID();
    const inventory: Inventory = {
      id: invId,
      store_id: storeId,
      product_id: id,
      quantity: initialQuantity,
      display_quantity: Math.max(0, initialQuantity),
      reserved_quantity: 0,
      min_threshold: 5,
      last_counted_at: now,
      updated_at: now
    };
    this.inventory.set(id, inventory);

    await this.appendAuditLog(storeId, 'system', 'system', 'CREATE_PRODUCT', 'product', id, {
      sku: product.sku,
      price: product.price,
      initialQuantity
    });

    return { product, inventory };
  }

  async getProduct(id: string, storeId: string): Promise<Product | null> {
    const p = this.products.get(id);
    return p && p.store_id === storeId ? p : null;
  }

  async getProductByBarcode(barcode: string, storeId: string): Promise<Product | null> {
    for (const p of this.products.values()) {
      if (p.store_id === storeId && (p.barcode === barcode || p.sku === barcode)) {
        return p;
      }
    }
    return null;
  }

  async listProducts(storeId: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => p.store_id === storeId && p.is_active);
  }

  async getInventory(productId: string, storeId: string): Promise<Inventory | null> {
    const inv = this.inventory.get(productId);
    return inv && inv.store_id === storeId ? inv : null;
  }

  async listInventory(storeId: string): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter((i) => i.store_id === storeId);
  }

  async updateProductPrice(productId: string, storeId: string, newPrice: number, actorId: string): Promise<Product> {
    const product = await this.getProduct(productId, storeId);
    if (!product) throw new Error('Product not found or access denied');
    const oldPrice = product.price;
    product.price = newPrice;
    product.version += 1;
    product.updated_at = new Date().toISOString();

    await this.appendAuditLog(storeId, actorId, 'manager', 'UPDATE_PRICE', 'product', productId, {
      oldPrice,
      newPrice,
      version: product.version
    });

    return product;
  }

  // --- SALES & SALE ITEMS ---
  async recordSale(
    storeId: string,
    saleData: Omit<Sale, 'created_at'>
  ): Promise<Sale> {
    // Check RLS boundary
    if (saleData.store_id !== storeId) {
      throw new Error('RLS Isolation Violation: store_id mismatch in sale record');
    }

    const sale: Sale = {
      ...saleData,
      created_at: new Date().toISOString()
    };
    this.sales.set(sale.id, sale);

    // If payment is credit, log to credit ledger
    if (sale.payment_type === 'credit' && sale.customer_id) {
      await this.recordCreditCharge(storeId, sale.customer_id, sale.id, sale.total, 'Credit sale purchase');
    }

    return sale;
  }

  async listSales(storeId: string): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter((s) => s.store_id === storeId);
  }

  // --- CUSTOMERS & CREDIT LEDGER ---
  async createCustomer(
    storeId: string,
    data: { name: string; phone: string; credit_limit: number }
  ): Promise<Customer> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const customer: Customer = {
      id,
      store_id: storeId,
      name: data.name,
      phone: data.phone,
      credit_limit: data.credit_limit,
      current_credit_balance: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    };
    this.customers.set(id, customer);
    this.creditLedger.set(id, []);
    return customer;
  }

  async getCustomer(id: string, storeId: string): Promise<Customer | null> {
    const c = this.customers.get(id);
    return c && c.store_id === storeId ? c : null;
  }

  async listCustomers(storeId: string): Promise<Customer[]> {
    return Array.from(this.customers.values()).filter((c) => c.store_id === storeId);
  }

  async recordCreditCharge(
    storeId: string,
    customerId: string,
    saleId: string | null,
    amount: number,
    notes?: string
  ): Promise<CreditLedger> {
    const customer = await this.getCustomer(customerId, storeId);
    if (!customer) throw new Error('Customer not found');

    const newBalance = customer.current_credit_balance + amount;
    customer.current_credit_balance = newBalance;
    customer.updated_at = new Date().toISOString();

    const entry: CreditLedger = {
      id: crypto.randomUUID(),
      store_id: storeId,
      customer_id: customerId,
      sale_id: saleId,
      entry_type: 'charge',
      amount,
      balance_after: newBalance,
      notes,
      created_at: new Date().toISOString()
    };

    const list = this.creditLedger.get(customerId) || [];
    list.push(entry);
    this.creditLedger.set(customerId, list);

    await this.appendAuditLog(storeId, 'cashier', 'cashier', 'CREDIT_CHARGE', 'customer', customerId, {
      amount,
      balance_after: newBalance,
      sale_id: saleId
    });

    return entry;
  }

  async recordCreditPayment(
    storeId: string,
    customerId: string,
    amount: number,
    actorId: string,
    notes?: string
  ): Promise<CreditLedger> {
    const customer = await this.getCustomer(customerId, storeId);
    if (!customer) throw new Error('Customer not found');

    const newBalance = Math.max(0, customer.current_credit_balance - amount);
    customer.current_credit_balance = newBalance;
    customer.updated_at = new Date().toISOString();

    const entry: CreditLedger = {
      id: crypto.randomUUID(),
      store_id: storeId,
      customer_id: customerId,
      sale_id: null,
      entry_type: 'payment',
      amount,
      balance_after: newBalance,
      notes,
      created_at: new Date().toISOString()
    };

    const list = this.creditLedger.get(customerId) || [];
    list.push(entry);
    this.creditLedger.set(customerId, list);

    await this.appendAuditLog(storeId, actorId, 'manager', 'CREDIT_PAYMENT', 'customer', customerId, {
      amount,
      balance_after: newBalance
    });

    return entry;
  }

  async getCreditHistory(customerId: string, storeId: string): Promise<CreditLedger[]> {
    const customer = await this.getCustomer(customerId, storeId);
    if (!customer) return [];
    return this.creditLedger.get(customerId) || [];
  }

  // --- INVENTORY EVENTS & ANOMALIES ---
  async appendInventoryEvent(event: Omit<InventoryEvent, 'id' | 'server_ts'>): Promise<InventoryEvent> {
    const id = crypto.randomUUID();
    const fullEvent: InventoryEvent = {
      ...event,
      id,
      server_ts: new Date().toISOString()
    };
    this.inventoryEvents.push(fullEvent);
    return fullEvent;
  }

  async getInventoryEventsByStore(storeId: string, since?: string): Promise<InventoryEvent[]> {
    return this.inventoryEvents.filter((e) => {
      if (e.store_id !== storeId) return false;
      if (!since) return true;
      return new Date(e.server_ts) > new Date(since);
    });
  }

  async createAnomaly(data: Omit<InventoryAnomaly, 'id' | 'created_at' | 'resolved'>): Promise<InventoryAnomaly> {
    const id = crypto.randomUUID();
    const anomaly: InventoryAnomaly = {
      ...data,
      id,
      resolved: false,
      created_at: new Date().toISOString()
    };
    this.anomalies.set(id, anomaly);
    return anomaly;
  }

  async listAnomalies(storeId: string, includeResolved: boolean = false): Promise<InventoryAnomaly[]> {
    return Array.from(this.anomalies.values()).filter(
      (a) => a.store_id === storeId && (includeResolved || !a.resolved)
    );
  }

  async resolveAnomaly(
    id: string,
    storeId: string,
    actorId: string,
    resolutionNotes: string,
    adjustedQuantity?: number
  ): Promise<InventoryAnomaly> {
    const anomaly = this.anomalies.get(id);
    if (!anomaly || anomaly.store_id !== storeId) {
      throw new Error('Anomaly not found or store mismatch');
    }

    anomaly.resolved = true;
    anomaly.resolved_at = new Date().toISOString();
    anomaly.resolved_by = actorId;
    anomaly.details += ` | Resolved: ${resolutionNotes}`;

    if (adjustedQuantity !== undefined) {
      const inv = await this.getInventory(anomaly.product_id, storeId);
      if (inv) {
        inv.quantity = adjustedQuantity;
        inv.display_quantity = Math.max(0, adjustedQuantity);
        inv.updated_at = new Date().toISOString();
      }
    }

    await this.appendAuditLog(storeId, actorId, 'manager', 'RESOLVE_ANOMALY', 'inventory_anomaly', id, {
      resolutionNotes,
      adjustedQuantity
    });

    return anomaly;
  }

  // --- PRICE PROPOSALS ---
  async createPriceProposal(data: Omit<PriceChangeProposal, 'id' | 'created_at' | 'status'>): Promise<PriceChangeProposal> {
    const id = crypto.randomUUID();
    const proposal: PriceChangeProposal = {
      ...data,
      id,
      status: 'queued',
      created_at: new Date().toISOString()
    };
    this.priceProposals.set(id, proposal);
    return proposal;
  }

  async listPriceProposals(storeId: string): Promise<PriceChangeProposal[]> {
    return Array.from(this.priceProposals.values()).filter((p) => p.store_id === storeId);
  }

  // --- SYNC CURSORS ---
  async getSyncCursor(storeId: string, deviceId: string): Promise<SyncCursor | null> {
    return this.syncCursors.get(`${storeId}:${deviceId}`) || null;
  }

  async updateSyncCursor(cursor: SyncCursor): Promise<void> {
    this.syncCursors.set(`${cursor.store_id}:${cursor.device_id}`, cursor);
  }

  // --- AUDIT LOG & HASH CHAIN ---
  async getLatestAuditHash(storeId: string): Promise<string> {
    const logs = this.auditLogs.get(storeId) || [];
    if (logs.length === 0) return GENESIS_HASH;
    return logs[logs.length - 1].hash;
  }

  async appendAuditLog(
    storeId: string,
    actorId: string,
    actorRole: 'cashier' | 'manager' | 'distributor' | 'system',
    action: string,
    entityType: string,
    entityId: string,
    payload: unknown
  ): Promise<AuditLogEntry> {
    const logs = this.auditLogs.get(storeId) || [];
    const prevHash = logs.length > 0 ? logs[logs.length - 1].hash : GENESIS_HASH;
    const now = new Date().toISOString();
    const canonicalPayload = canonicalizeJson(payload);

    const hash = computeAuditHash(
      prevHash,
      now,
      storeId,
      actorId,
      action,
      entityType,
      entityId,
      canonicalPayload
    );

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      store_id: storeId,
      previous_hash: prevHash,
      hash,
      actor_id: actorId,
      actor_role: actorRole,
      action,
      entity_type: entityType,
      entity_id: entityId,
      payload_canonical: canonicalPayload,
      created_at: now
    };

    logs.push(entry);
    this.auditLogs.set(storeId, logs);
    return entry;
  }

  async listAuditLogs(storeId: string): Promise<AuditLogEntry[]> {
    return this.auditLogs.get(storeId) || [];
  }

  // --- REFRESH TOKENS ---
  async saveRefreshToken(data: {
    userId?: string;
    deviceId?: string;
    tokenHash: string;
    familyId: string;
    expiresAt: string;
  }): Promise<void> {
    this.refreshTokens.set(data.tokenHash, {
      ...data,
      isRevoked: false
    });
  }

  async getRefreshToken(tokenHash: string): Promise<{
    userId?: string;
    deviceId?: string;
    tokenHash: string;
    familyId: string;
    isRevoked: boolean;
    expiresAt: string;
  } | null> {
    return this.refreshTokens.get(tokenHash) || null;
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    for (const [hash, token] of this.refreshTokens.entries()) {
      if (token.familyId === familyId) {
        token.isRevoked = true;
        this.refreshTokens.set(hash, token);
      }
    }
  }
}
