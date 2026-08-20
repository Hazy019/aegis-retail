export interface StoreDeviceStatus {
  id: string;
  label: string;
  identifier: string;
  is_revoked: boolean;
  last_sync_at: string | null;
  sync_health: 'synced' | 'pending' | 'escalated_warning';
  offline_hours: number;
  status_message: string;
}

export interface DashboardStoreData {
  store: {
    id: string;
    name: string;
    currency: string;
    region: string;
  };
  devices: StoreDeviceStatus[];
}

export interface CatalogProduct {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  unit_type: string;
  units_per_bulk: number;
  price: number;
  cost_price: number;
  stock_quantity: number;
  display_quantity: number;
  pending_price: number | null;
}

export interface AnomalyItem {
  id: string;
  product_id: string;
  conflict_type: string;
  calculated_stock: number;
  clamped_stock: number;
  details: string;
  resolved: boolean;
  created_at: string;
}

export interface CreditCustomer {
  id: string;
  name: string;
  phone: string;
  credit_limit: number;
  current_credit_balance: number;
}

export interface AuditEntry {
  id: string;
  previous_hash: string;
  hash: string;
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_canonical: string;
  created_at: string;
}

export interface AuditVerification {
  is_tamper_evident: boolean;
  chain_valid: boolean;
  total_entries: number;
  broken_at_index: number | null;
}

class DashboardApiClient {
  private baseUrl: string = '';
  private token: string | null = null;

  constructor() {
    const saved = localStorage.getItem('aegis_manager_token');
    if (saved) this.token = saved;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('aegis_manager_token', token);
    } else {
      localStorage.removeItem('aegis_manager_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async login(email: string, password: string, totpCode?: string) {
    const data = await this.request<{ access_token: string; refresh_token: string }>('/auth/manager-login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totp_code: totpCode })
    });
    this.setToken(data.access_token);
    return data;
  }

  async getStoreStatus(storeId: string): Promise<DashboardStoreData> {
    return this.request<DashboardStoreData>(`/dashboard/stores/${storeId}/status`);
  }

  async getPricing(): Promise<{ products: CatalogProduct[]; proposals: any[] }> {
    return this.request<{ products: CatalogProduct[]; proposals: any[] }>('/dashboard/pricing');
  }

  async updatePrice(productId: string, newPrice: number) {
    return this.request('/dashboard/pricing/propose', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, new_price: newPrice })
    });
  }

  async recordDamageWriteOff(productId: string, quantity: number, reason: string) {
    const key = `manager:${Date.now()}`;
    return this.request('/dashboard/inventory/write-off', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        quantity,
        reason,
        idempotency_key: key
      })
    });
  }

  async getAnomalies(): Promise<{ anomalies: AnomalyItem[] }> {
    return this.request<{ anomalies: AnomalyItem[] }>('/dashboard/anomalies');
  }

  async resolveAnomaly(anomalyId: string, action: string, adjustedQuantity?: number, resolutionNotes: string = '') {
    return this.request(`/dashboard/anomalies/${anomalyId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        adjusted_quantity: adjustedQuantity,
        resolution_notes: resolutionNotes
      })
    });
  }

  async getCustomers(): Promise<{ customers: CreditCustomer[] }> {
    return this.request<{ customers: CreditCustomer[] }>('/dashboard/credit');
  }

  async createCustomer(name: string, phone: string, creditLimit: number) {
    return this.request('/dashboard/credit/customer', {
      method: 'POST',
      body: JSON.stringify({
        name,
        phone,
        credit_limit: creditLimit
      })
    });
  }

  async getAuditLog(): Promise<{ logs: AuditEntry[]; verification: AuditVerification }> {
    return this.request<{ logs: AuditEntry[]; verification: AuditVerification }>('/dashboard/audit');
  }

  async revokeDevice(deviceId: string, reason?: string) {
    return this.request('/auth/revoke-device', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, reason })
    });
  }
}

export const api = new DashboardApiClient();
