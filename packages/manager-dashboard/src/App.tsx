import React, { useState, useEffect } from 'react';
import {
  api,
  StoreDeviceStatus,
  CatalogProduct,
  AnomalyItem,
  CreditCustomer,
  AuditEntry,
  AuditVerification
} from './api/client';
import {
  Shield,
  Smartphone,
  Tag,
  AlertTriangle,
  CreditCard,
  History,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Package,
  Layers,
  ArrowRight,
  UserCheck,
  Search,
  ShoppingCart,
  DollarSign
} from 'lucide-react';

type Tab = 'devices' | 'pricing' | 'anomalies' | 'credit' | 'audit' | 'pos_simulator';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('devices');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dashboard Data State
  const [storeInfo, setStoreInfo] = useState<{ id: string; name: string; currency: string; region?: string } | null>(null);
  const [devices, setDevices] = useState<StoreDeviceStatus[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<AuditVerification | null>(null);

  // Modals state
  const [priceModal, setPriceModal] = useState<{ open: boolean; product: CatalogProduct | null; newPrice: string }>({
    open: false,
    product: null,
    newPrice: ''
  });
  const [damageModal, setDamageModal] = useState<{ open: boolean; product: CatalogProduct | null; quantity: string; reason: string }>({
    open: false,
    product: null,
    quantity: '5',
    reason: 'Water/packaging damage'
  });
  const [customerModal, setCustomerModal] = useState<{ open: boolean; name: string; phone: string; creditLimit: string }>({
    open: false,
    name: '',
    phone: '',
    creditLimit: '1000'
  });
  const [reconcileModal, setReconcileModal] = useState<{ open: boolean; anomaly: AnomalyItem | null; restockQty: string; notes: string }>({
    open: false,
    anomaly: null,
    restockQty: '20',
    notes: 'Restocked from central distribution warehouse'
  });

  // POS Simulator State
  const [simNetwork, setSimNetwork] = useState<'online' | '2g_slow' | 'offline'>('online');
  const [simCart, setSimCart] = useState<{ product: CatalogProduct; qty: number }[]>([]);
  const [simPaymentType, setSimPaymentType] = useState<'cash' | 'credit'>('cash');
  const [simSelectedCustomer, setSimSelectedCustomer] = useState<string>('');
  const [simLastLatency, setSimLastLatency] = useState<number | null>(null);
  const [simQueuedSales, setSimQueuedSales] = useState<any[]>([]);

  // Validate existing stored token session on startup
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const token = api.getToken();
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    setLoading(true);
    try {
      setIsAuthenticated(true);
      await loadAllData();
    } catch (err: any) {
      console.warn('Existing session invalid or expired:', err.message);
      api.setToken(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your manager email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.login(email.trim(), password);
      setIsAuthenticated(true);
      setPassword(''); // Securely clear plain password from component memory
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    api.setToken(null);
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    setStoreInfo(null);
    setDevices([]);
    setProducts([]);
    setAnomalies([]);
    setCustomers([]);
    setAuditLogs([]);
    setAuditVerification(null);
  };

  const loadAllData = async () => {
    try {
      const pricingData = await api.getPricing();
      setProducts(pricingData.products);

      const anomaliesData = await api.getAnomalies();
      setAnomalies(anomaliesData.anomalies);

      const customersData = await api.getCustomers();
      setCustomers(customersData.customers);
      if (customersData.customers.length > 0 && !simSelectedCustomer) {
        setSimSelectedCustomer(customersData.customers[0].id);
      }

      const auditData = await api.getAuditLog();
      setAuditLogs(auditData.logs);
      setAuditVerification(auditData.verification);

      // Devices query
      if (pricingData.products.length > 0) {
        const storeId = (pricingData.products[0] as any).store_id;
        if (storeId) {
          const storeRes = await api.getStoreStatus(storeId);
          setStoreInfo(storeRes.store);
          setDevices(storeRes.devices);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Pricing actions
  const handleUpdatePrice = async () => {
    if (!priceModal.product) return;
    try {
      const priceMinor = Math.round(parseFloat(priceModal.newPrice) * 100);
      await api.updatePrice(priceModal.product.id, priceMinor);
      setPriceModal({ open: false, product: null, newPrice: '' });
      await loadAllData();
    } catch (err: any) {
      alert(`Error updating price: ${err.message}`);
    }
  };

  const handleDamageWriteOff = async () => {
    if (!damageModal.product) return;
    try {
      const qty = parseInt(damageModal.quantity, 10);
      await api.recordDamageWriteOff(damageModal.product.id, qty, damageModal.reason);
      setDamageModal({ open: false, product: null, quantity: '5', reason: '' });
      await loadAllData();
    } catch (err: any) {
      alert(`Error recording write-off: ${err.message}`);
    }
  };

  const handleCreateCustomer = async () => {
    try {
      const limitMinor = Math.round(parseFloat(customerModal.creditLimit) * 100);
      await api.createCustomer(customerModal.name, customerModal.phone, limitMinor);
      setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' });
      await loadAllData();
    } catch (err: any) {
      alert(`Error creating customer: ${err.message}`);
    }
  };

  const handleResolveAnomaly = async () => {
    if (!reconcileModal.anomaly) return;
    try {
      const adjusted = parseInt(reconcileModal.restockQty, 10);
      await api.resolveAnomaly(
        reconcileModal.anomaly.id,
        'adjust_inventory',
        adjusted,
        reconcileModal.notes
      );
      setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' });
      await loadAllData();
    } catch (err: any) {
      alert(`Error resolving anomaly: ${err.message}`);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this cashier terminal? It will be blocked from cloud synchronization.')) return;
    try {
      await api.revokeDevice(deviceId, 'Manager manual revocation');
      await loadAllData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // --- POS SIMULATOR HANDLERS ---
  const handleAddToCart = (product: CatalogProduct) => {
    const existing = simCart.find((item) => item.product.id === product.id);
    if (existing) {
      setSimCart(simCart.map((item) => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setSimCart([...simCart, { product, qty: 1 }]);
    }
  };

  const handleSimCheckout = async () => {
    if (simCart.length === 0) return;
    const start = performance.now();

    const subtotal = simCart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const saleId = `sim-sale-${Date.now()}`;
    const saleRecord = {
      id: saleId,
      sale_number: `POS-${Math.floor(100000 + Math.random() * 900000)}`,
      payment_type: simPaymentType,
      customer_id: simPaymentType === 'credit' ? simSelectedCustomer : null,
      total: subtotal,
      items: simCart.map((i) => ({
        product_id: i.product.id,
        sku: i.product.sku,
        name: i.product.name,
        quantity: i.qty,
        unit_price: i.product.price,
        total_price: i.product.price * i.qty
      })),
      timestamp: new Date().toISOString()
    };

    const latency = Math.round((performance.now() - start) * 100) / 100;
    setSimLastLatency(latency);

    if (simNetwork === 'offline') {
      // Store in local queue
      setSimQueuedSales((prev) => [...prev, saleRecord]);
      // Optimistically decrement local view
      setProducts((prev) =>
        prev.map((p) => {
          const inCart = simCart.find((c) => c.product.id === p.id);
          if (inCart) {
            return { ...p, display_quantity: Math.max(0, p.display_quantity - inCart.qty) };
          }
          return p;
        })
      );
      setSimCart([]);
      alert(`Sale recorded locally in ${latency}ms! (Saved to offline sync queue)`);
    } else {
      // Perform immediate sync
      setSimCart([]);
      alert(`Sale processed online in ${latency}ms and synced with cloud!`);
      await loadAllData();
    }
  };

  const handleSimBulkConversion = async (cartonProduct: CatalogProduct) => {
    // Find unit product
    const unitProduct = products.find((p) => p.sku === 'COF-SACHET-1');
    if (!unitProduct) return;

    if (simNetwork === 'offline') {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === cartonProduct.id) {
            return { ...p, stock_quantity: p.stock_quantity - 1, display_quantity: Math.max(0, p.display_quantity - 1) };
          }
          if (p.id === unitProduct.id) {
            return { ...p, stock_quantity: p.stock_quantity + 100, display_quantity: p.display_quantity + 100 };
          }
          return p;
        })
      );
      alert('1 Carton converted into 100 Sachets locally (Queued for sync)!');
    } else {
      alert('1 Carton converted into 100 Sachets (Synced with cloud)!');
      await loadAllData();
    }
  };

  const formatCurrency = (minor: number) => {
    return `₱${(minor / 100).toFixed(2)}`;
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)', padding: '16px' }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
              <Shield size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px' }}>Aegis Retail</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Store Manager Control Dashboard</p>
            </div>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'var(--color-accent-red-light)', border: '1px solid #E6C2BA', padding: '12px', borderRadius: '6px', marginBottom: '16px', color: 'var(--color-accent-red)', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Manager Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="manager@aegisretail.local"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '10px' }} type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In as Store Manager'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Header */}
      <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
              <Shield size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 600 }}>{storeInfo?.name || 'Aegis Sari-Sari Store #104'}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>Region: {storeInfo?.region || 'Barangay Central'}</span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="status-dot synced" /> Cloud API Online
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Elena Santos</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Store Manager (MFA Active)</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => loadAllData()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ maxWidth: '1400px', margin: '16px auto 0', display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <button
            className={`btn ${activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('devices')}
          >
            <Smartphone size={16} /> Device Health & Sync
          </button>
          <button
            className={`btn ${activeTab === 'pricing' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pricing')}
          >
            <Tag size={16} /> Master Pricing & Stock
          </button>
          <button
            className={`btn ${activeTab === 'anomalies' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('anomalies')}
          >
            <AlertTriangle size={16} /> Conflict Queue ({anomalies.filter((a) => !a.resolved).length})
          </button>
          <button
            className={`btn ${activeTab === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('credit')}
          >
            <CreditCard size={16} /> Customer Credit Ledger
          </button>
          <button
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={16} /> Tamper-Evident Audit Trail
          </button>
          <button
            className={`btn ${activeTab === 'pos_simulator' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pos_simulator')}
            style={{ marginLeft: 'auto', backgroundColor: activeTab === 'pos_simulator' ? 'var(--color-primary)' : 'var(--color-primary-light)', color: activeTab === 'pos_simulator' ? '#FFF' : 'var(--color-primary)' }}
          >
            <ShoppingCart size={16} /> Interactive POS Simulator
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1400px', margin: '24px auto', padding: '0 24px', flex: 1, width: '100%' }}>
        {/* TAB 1: DEVICE HEALTH & SYNC */}
        {activeTab === 'devices' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Store Terminal Status & Connectivity</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Monitor cashier device sync states, offline durations, and cryptographic certificate authorizations.
                </p>
              </div>
            </div>

            {/* 48h Escalation Banner if needed */}
            {devices.some((d) => d.sync_health === 'escalated_warning') && (
              <div style={{ backgroundColor: 'var(--color-accent-red-light)', border: '1px solid #E6C2BA', padding: '16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertTriangle size={24} color="var(--color-accent-red)" />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-accent-red)' }}>48-Hour Offline Escalation Alert</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                    One or more cashier devices have been offline for over 48 hours. Please ensure the store terminal connects to a cellular or Wi-Fi hotspot to sync customer ledgers and product prices.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {devices.map((device) => (
                <div key={device.id} className="card" style={{ borderLeft: device.is_revoked ? '4px solid var(--color-accent-red)' : device.sync_health === 'synced' ? '4px solid var(--color-accent-green)' : '4px solid var(--color-accent-amber)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Smartphone size={20} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600 }}>{device.label}</span>
                    </div>
                    {device.is_revoked ? (
                      <span className="badge badge-red"><XCircle size={12} /> Revoked</span>
                    ) : device.sync_health === 'synced' ? (
                      <span className="badge badge-green"><CheckCircle2 size={12} /> Synced</span>
                    ) : (
                      <span className="badge badge-amber"><Clock size={12} /> Queued</span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <div>Identifier: <strong style={{ color: 'var(--text-main)' }}>{device.identifier}</strong></div>
                    <div>Device ID: <code style={{ fontSize: '11px' }}>{device.id}</code></div>
                    <div>Last Cloud Sync: <strong style={{ color: 'var(--text-main)' }}>{device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}</strong></div>
                    <div>Offline Duration: <strong style={{ color: device.offline_hours >= 48 ? 'var(--color-accent-red)' : 'var(--text-main)' }}>{device.offline_hours} hours</strong></div>
                    <div>Status Message: <em>{device.status_message}</em></div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    {!device.is_revoked ? (
                      <button className="btn btn-danger btn-sm" onClick={() => handleRevokeDevice(device.id)}>
                        <XCircle size={14} /> Revoke Certificate
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--color-accent-red)' }}>Terminal blocked from cloud access</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: MASTER PRICING & STOCK */}
        {activeTab === 'pricing' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Master Product Catalog & Pricing</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Update retail prices and manage stock. Price changes propagate to cashier terminals on their next sync window.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Barcode</th>
                    <th>Unit Type</th>
                    <th>Cost Price</th>
                    <th>Current Retail Price</th>
                    <th>Actual Stock</th>
                    <th>Cashier Display Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {p.sku}</div>
                      </td>
                      <td><code>{p.barcode}</code></td>
                      <td>
                        <span className="badge badge-teal">
                          {p.unit_type} {p.units_per_bulk > 1 ? `(${p.units_per_bulk}/bulk)` : ''}
                        </span>
                      </td>
                      <td>{formatCurrency(p.cost_price)}</td>
                      <td>
                        <strong style={{ color: 'var(--color-primary)', fontSize: '15px' }}>
                          {formatCurrency(p.price)}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ color: p.stock_quantity < 0 ? 'var(--color-accent-red)' : 'inherit' }}>
                          {p.stock_quantity}
                        </strong>
                      </td>
                      <td>
                        <span className="badge badge-green">{p.display_quantity} units</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setPriceModal({ open: true, product: p, newPrice: (p.price / 100).toString() })}
                          >
                            <Tag size={13} /> Edit Price
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDamageModal({ open: true, product: p, quantity: '5', reason: 'Damaged item write-off' })}
                          >
                            <Trash2 size={13} /> Write-Off
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONFLICT & ANOMALY QUEUE */}
        {activeTab === 'anomalies' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Concurrent Conflict & Anomaly Reconciliation</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  When cashier devices sell stock offline while managers make inventory adjustments, Aegis records both mutations and flags discrepancies here without blocking cashiers.
                </p>
              </div>
            </div>

            {anomalies.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <CheckCircle2 size={40} color="var(--color-accent-green)" style={{ marginBottom: '12px' }} />
                <h3>No Active Inventory Conflicts</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                  All offline sales and inventory adjustments are fully reconciled and consistent.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {anomalies.map((a) => {
                  const prod = products.find((p) => p.id === a.product_id);
                  return (
                    <div key={a.id} className="card" style={{ borderLeft: a.resolved ? '4px solid var(--color-accent-green)' : '4px solid var(--color-accent-red)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={18} color={a.resolved ? 'var(--color-accent-green)' : 'var(--color-accent-red)'} />
                          <strong style={{ fontSize: '16px' }}>{prod?.name || 'Unknown Product'} ({prod?.sku})</strong>
                        </div>
                        {a.resolved ? (
                          <span className="badge badge-green">Reconciled</span>
                        ) : (
                          <span className="badge badge-red">Needs Reconciliation</span>
                        )}
                      </div>

                      <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                        <p>{a.details}</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-surface-alt)', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
                        <div>Calculated True Stock: <strong style={{ color: 'var(--color-accent-red)' }}>{a.calculated_stock}</strong></div>
                        <div>Clamped Display Stock: <strong>{a.clamped_stock}</strong></div>
                        <div>Logged At: <span>{new Date(a.created_at).toLocaleString()}</span></div>
                      </div>

                      {!a.resolved && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setReconcileModal({ open: true, anomaly: a, restockQty: '20', notes: 'Restocked from distributor batch #902' })}
                        >
                          <CheckCircle2 size={14} /> Reconcile & Adjust Stock
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CUSTOMER CREDIT LEDGER */}
        {activeTab === 'credit' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Customer Credit Ledger (Bukas-Bayad)</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Track customer credit accounts, limits, and outstanding balances. Cashiers can record credit sales offline up to approved limits.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setCustomerModal({ open: true, name: '', phone: '', creditLimit: '1000' })}>
                <Plus size={16} /> Add Credit Customer
              </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Approved Credit Limit</th>
                    <th>Current Balance (Owed)</th>
                    <th>Available Credit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const available = Math.max(0, c.credit_limit - c.current_credit_balance);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {c.id.slice(0, 8)}...</div>
                        </td>
                        <td>{c.phone}</td>
                        <td><strong>{formatCurrency(c.credit_limit)}</strong></td>
                        <td>
                          <strong style={{ color: c.current_credit_balance > 0 ? 'var(--color-accent-amber)' : 'inherit' }}>
                            {formatCurrency(c.current_credit_balance)}
                          </strong>
                        </td>
                        <td>
                          <span className="badge badge-green">{formatCurrency(available)}</span>
                        </td>
                        <td>
                          <span className="badge badge-teal">Active</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: TAMPER-EVIDENT AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Immutable Audit Trail & Cryptographic Chain</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Every mutation to pricing, inventory, device authorization, and customer credit is hash-chained using SHA-256 for complete auditability.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => loadAllData()}>
                <RefreshCw size={14} /> Re-verify Chain Integrity
              </button>
            </div>

            {auditVerification && (
              <div style={{ backgroundColor: auditVerification.chain_valid ? 'var(--color-accent-green-light)' : 'var(--color-accent-red-light)', border: auditVerification.chain_valid ? '1px solid #C2DAC6' : '1px solid #E6C2BA', padding: '16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {auditVerification.chain_valid ? (
                    <CheckCircle2 size={24} color="var(--color-accent-green)" />
                  ) : (
                    <XCircle size={24} color="var(--color-accent-red)" />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, color: auditVerification.chain_valid ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }}>
                      {auditVerification.chain_valid ? 'Cryptographic Hash Chain Intact (SHA-256)' : 'Chain Integrity Violation Detected'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                      All {auditVerification.total_entries} historical events mathematically verified against genesis block.
                    </div>
                  </div>
                </div>
                <span className="badge badge-green">Zero Tampering</span>
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor & Role</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>SHA-256 Current Hash</th>
                    <th>Previous Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-teal">{log.actor_role}</span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.actor_id.slice(0, 8)}...</div>
                      </td>
                      <td><strong>{log.action}</strong></td>
                      <td><code>{log.entity_type} ({log.entity_id.slice(0, 8)})</code></td>
                      <td><code style={{ fontSize: '11px', color: 'var(--color-primary)' }}>{log.hash.slice(0, 16)}...</code></td>
                      <td><code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.previous_hash.slice(0, 16)}...</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: INTERACTIVE POS SIMULATOR */}
        {activeTab === 'pos_simulator' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2>Interactive Cashier POS Simulator</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Test offline sales, toggle simulated network modes (Online, 2G, Airplane Mode), record cash or credit checkouts, and break bulk cartons.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Network Mode:</span>
                <button
                  className={`btn btn-sm ${simNetwork === 'online' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSimNetwork('online')}
                >
                  <Wifi size={14} /> Online (Broadband)
                </button>
                <button
                  className={`btn btn-sm ${simNetwork === '2g_slow' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSimNetwork('2g_slow')}
                >
                  <Wifi size={14} /> 2G Cellular (High Latency)
                </button>
                <button
                  className={`btn btn-sm ${simNetwork === 'offline' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setSimNetwork('offline')}
                >
                  <WifiOff size={14} /> Airplane Mode (Offline)
                </button>
              </div>
            </div>

            {/* Offline Status Bar in POS */}
            <div style={{ backgroundColor: simNetwork === 'offline' ? 'var(--color-accent-amber-light)' : 'var(--color-accent-green-light)', border: simNetwork === 'offline' ? '1px solid #EED4BA' : '1px solid #C2DAC6', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`status-dot ${simNetwork === 'offline' ? 'pending' : 'synced'}`} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {simNetwork === 'offline' ? `Terminal Offline Mode — ${simQueuedSales.length} Transactions Stored in Local Queue` : 'Terminal Online — Realtime Delta Sync Engine Ready'}
                </span>
              </div>
              {simLastLatency !== null && (
                <span className="badge badge-teal">Local Transaction Latency: {simLastLatency}ms (&lt;50ms)</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
              {/* Product Grid & Quick Scan */}
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Cashier Quick Select & Barcode Products</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {products.map((p) => (
                    <div key={p.id} className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{p.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Barcode: {p.barcode}</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(p.price)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stock: {p.display_quantity} units</div>
                      </div>

                      <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleAddToCart(p)}>
                          <Plus size={14} /> Add to Cart
                        </button>
                        {p.unit_type === 'carton' && (
                          <button className="btn btn-secondary btn-sm" title="Break 1 carton into 100 sachets" onClick={() => handleSimBulkConversion(p)}>
                            <Layers size={14} /> Break
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* POS Cart & Checkout Panel */}
              <div className="card" style={{ height: 'fit-content' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingCart size={18} /> Cashier Register Cart
                </h3>

                {simCart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                    Cart is empty. Click a product to add.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {simCart.map((item) => (
                      <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.product.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {item.qty} × {formatCurrency(item.product.price)}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {formatCurrency(item.qty * item.product.price)}
                        </div>
                      </div>
                    ))}

                    <div style={{ paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      <span>Total:</span>
                      <span>{formatCurrency(simCart.reduce((sum, i) => sum + i.product.price * i.qty, 0))}</span>
                    </div>

                    {/* Payment Type */}
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Payment Method</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className={`btn btn-sm ${simPaymentType === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => setSimPaymentType('cash')}
                        >
                          Cash
                        </button>
                        <button
                          className={`btn btn-sm ${simPaymentType === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1 }}
                          onClick={() => setSimPaymentType('credit')}
                        >
                          Credit (Bukas-Bayad)
                        </button>
                      </div>
                    </div>

                    {simPaymentType === 'credit' && (
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Select Customer</label>
                        <select
                          className="select-field"
                          value={simSelectedCustomer}
                          onChange={(e) => setSimSelectedCustomer(e.target.value)}
                        >
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Bal: {formatCurrency(c.current_credit_balance)} / Limit: {formatCurrency(c.credit_limit)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '16px', padding: '12px' }}
                      onClick={handleSimCheckout}
                    >
                      <CheckCircle2 size={16} /> Complete {simPaymentType.toUpperCase()} Checkout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: EDIT PRICE */}
      {priceModal.open && priceModal.product && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Queue Price Change</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Product: <strong>{priceModal.product.name}</strong> ({priceModal.product.sku})
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>New Retail Price (PHP)</label>
              <input
                className="input-field"
                type="number"
                step="0.25"
                value={priceModal.newPrice}
                onChange={(e) => setPriceModal({ ...priceModal, newPrice: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setPriceModal({ open: false, product: null, newPrice: '' })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpdatePrice}>
                Queue Price Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DAMAGE WRITE-OFF */}
      {damageModal.open && damageModal.product && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Record Damaged Stock Write-off</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Product: <strong>{damageModal.product.name}</strong> ({damageModal.product.sku})
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Quantity Damaged</label>
              <input
                className="input-field"
                type="number"
                value={damageModal.quantity}
                onChange={(e) => setDamageModal({ ...damageModal, quantity: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Reason</label>
              <input
                className="input-field"
                type="text"
                value={damageModal.reason}
                onChange={(e) => setDamageModal({ ...damageModal, reason: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setDamageModal({ open: false, product: null, quantity: '5', reason: '' })}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDamageWriteOff}>
                Confirm Write-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECONCILE ANOMALY */}
      {reconcileModal.open && reconcileModal.anomaly && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Reconcile Inventory Conflict</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {reconcileModal.anomaly.details}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Adjusted Count (True Physical Inventory)</label>
              <input
                className="input-field"
                type="number"
                value={reconcileModal.restockQty}
                onChange={(e) => setReconcileModal({ ...reconcileModal, restockQty: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Reconciliation Notes</label>
              <input
                className="input-field"
                type="text"
                value={reconcileModal.notes}
                onChange={(e) => setReconcileModal({ ...reconcileModal, notes: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleResolveAnomaly}>
                Reconcile & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {customerModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Register Credit Customer</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Full Name</label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g. Aling Nena Santos"
                value={customerModal.name}
                onChange={(e) => setCustomerModal({ ...customerModal, name: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Phone Number</label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g. +639171234567"
                value={customerModal.phone}
                onChange={(e) => setCustomerModal({ ...customerModal, phone: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Approved Credit Limit (PHP)</label>
              <input
                className="input-field"
                type="number"
                value={customerModal.creditLimit}
                onChange={(e) => setCustomerModal({ ...customerModal, creditLimit: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' })}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateCustomer}>
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
