import React, { useState } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { useToast } from '../../context/ToastContext.js';
import { CatalogProduct } from '../../api/client.js';
import {
  Wifi,
  WifiOff,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Layers,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  Search
} from 'lucide-react';

export function PosSimulatorView() {
  const { products, customers, refreshData, setProducts } = useDashboardData();
  const { toast } = useToast();

  const [simNetwork, setSimNetwork] = useState<'online' | '2g_slow' | 'offline'>('online');
  const [simCart, setSimCart] = useState<{ product: CatalogProduct; qty: number }[]>([]);
  const [simPaymentType, setSimPaymentType] = useState<'cash' | 'credit'>('cash');
  const [simSelectedCustomer, setSimSelectedCustomer] = useState<string>(customers[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [simQueuedSales, setSimQueuedSales] = useState<any[]>([]);

  const formatCurrency = (minor: number) => `₱${(minor / 100).toFixed(2)}`;

  const handleAddToCart = (product: CatalogProduct) => {
    setSimCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setSimCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: CatalogProduct; qty: number }[]
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setSimCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleSimCheckout = async () => {
    if (simCart.length === 0) return;

    const t0 = performance.now();
    const subtotal = simCart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const saleId = `pos-sale-${Date.now()}`;
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

    // Sub-50ms local write commit simulation
    const latency = Math.max(1, Math.round((performance.now() - t0) * 10) / 10);

    if (simNetwork === 'offline') {
      // Local queue write
      setSimQueuedSales((prev) => [...prev, saleRecord]);

      // Optimistic local stock reduction
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
      toast.sync(
        'Offline Transaction Recorded',
        `Sale of ${formatCurrency(subtotal)} committed locally and stored in offline queue.`,
        latency
      );
    } else {
      // Online sync
      setSimCart([]);
      toast.success(
        'Transaction Completed',
        `Sale of ${formatCurrency(subtotal)} committed and delta synced with cloud API.`,
        latency
      );
      await refreshData();
    }
  };

  const handleSimBulkConversion = async (cartonProduct: CatalogProduct) => {
    const t0 = performance.now();
    const unitProduct = products.find((p) => p.sku === 'COF-SACHET-1');
    if (!unitProduct) return;

    const latency = Math.max(1, Math.round((performance.now() - t0) * 10) / 10);

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === cartonProduct.id) {
          return {
            ...p,
            stock_quantity: p.stock_quantity - 1,
            display_quantity: Math.max(0, p.display_quantity - 1)
          };
        }
        if (p.id === unitProduct.id) {
          return {
            ...p,
            stock_quantity: p.stock_quantity + 100,
            display_quantity: p.display_quantity + 100
          };
        }
        return p;
      })
    );

    toast.success(
      'Bulk Unit Broken at POS',
      '1 Carton converted into 100 individual sachets with atomic local consistency.',
      latency
    );
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
  });

  const cartTotal = simCart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  return (
    <div className="pos-viewport tab-content-enter">
      {/* POS Top Control Bar */}
      <div className="pos-header-panel">
        <div>
          <h2 style={{ fontSize: '18px', color: '#FFF' }}>Touch Cashier POS Register Simulator</h2>
          <p style={{ fontSize: '12px', color: '#A0B2AF', marginTop: '2px' }}>
            Simulate sub-50ms offline write commits, 2G network delays, and bulk-to-unit conversions.
          </p>
        </div>

        {/* Network Mode Switches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#A0B2AF', fontWeight: 600 }}>NETWORK:</span>
          <button
            className={`btn btn-sm ${simNetwork === 'online' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '36px' }}
            onClick={() => setSimNetwork('online')}
          >
            <Wifi size={14} /> Broadband Online
          </button>
          <button
            className={`btn btn-sm ${simNetwork === '2g_slow' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ minHeight: '36px' }}
            onClick={() => setSimNetwork('2g_slow')}
          >
            <Wifi size={14} /> 2G Cellular (Lag)
          </button>
          <button
            className={`btn btn-sm ${simNetwork === 'offline' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ minHeight: '36px' }}
            onClick={() => setSimNetwork('offline')}
          >
            <WifiOff size={14} /> Airplane Mode (Offline)
          </button>
        </div>
      </div>

      {/* POS Status Bar */}
      <div className={`pos-status-bar ${simNetwork === 'offline' ? 'pos-status-offline' : 'pos-status-online'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`status-dot ${simNetwork === 'offline' ? 'pending' : 'synced'}`} />
          <span>
            {simNetwork === 'offline'
              ? `Terminal Operating Offline — ${simQueuedSales.length} Transactions Queued in Local Store DB`
              : 'Terminal Online — Realtime Delta Sync Engine Ready'}
          </span>
        </div>
        <span className="badge badge-teal" style={{ background: '#1E2524', border: '1px solid #364441', color: '#4FB0A4' }}>
          Local Write Latency Guarantee: &lt;50ms
        </span>
      </div>

      {/* 2-Column POS Layout */}
      <div className="pos-grid-layout">
        {/* Left: Product Catalog & Quick Tap Scan */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', color: '#FFF' }}>Cashier Quick Select</h3>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#A0B2AF' }} />
              <input
                type="text"
                placeholder="Scan or filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #364441',
                  backgroundColor: '#1E2524',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {filteredProducts.map((p) => (
              <div key={p.id} className="pos-product-card">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#FFF', marginBottom: '4px' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#A0B2AF', marginBottom: '8px' }}>
                    Barcode: <code>{p.barcode}</code>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#4FB0A4', marginBottom: '4px' }}>
                    {formatCurrency(p.price)}
                  </div>
                  <div style={{ fontSize: '12px', color: p.display_quantity < 5 ? '#F8B878' : '#A0B2AF' }}>
                    In Stock: {p.display_quantity} units
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                  <button
                    className="pos-touch-btn"
                    style={{ flex: 1, backgroundColor: 'var(--color-primary)', color: '#FFF' }}
                    onClick={() => handleAddToCart(p)}
                  >
                    <Plus size={16} /> Add
                  </button>

                  {p.unit_type === 'carton' && (
                    <button
                      className="pos-touch-btn"
                      style={{ backgroundColor: '#364441', color: '#FFF', padding: '0 12px' }}
                      title="Break 1 carton into 100 individual retail sachets"
                      onClick={() => handleSimBulkConversion(p)}
                    >
                      <Layers size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cashier Register Cart Panel */}
        <div className="pos-cart-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #364441', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF', fontWeight: 600, fontSize: '16px' }}>
              <ShoppingCart size={18} color="#4FB0A4" />
              <span>Current Cart</span>
            </div>
            {simCart.length > 0 && (
              <button
                className="btn btn-sm btn-secondary"
                style={{ backgroundColor: 'transparent', borderColor: '#364441', color: '#A0B2AF' }}
                onClick={() => setSimCart([])}
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          {simCart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#A0B2AF', fontSize: '14px' }}>
              Cart is empty. Tap any product on the left to add items.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '280px', overflowY: 'auto' }}>
              {simCart.map((item) => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: '#1E2524',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #364441'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF' }}>{item.product.name}</div>
                    <div style={{ fontSize: '12px', color: '#A0B2AF' }}>
                      {formatCurrency(item.product.price)} each
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#252E2C', borderRadius: 'var(--radius-xs)', border: '1px solid #364441' }}>
                      <button
                        onClick={() => handleUpdateQty(item.product.id, -1)}
                        style={{ background: 'none', border: 'none', color: '#FFF', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 6px', color: '#FFF' }}>
                        {item.qty}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(item.product.id, 1)}
                        style={{ background: 'none', border: 'none', color: '#FFF', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <span style={{ fontWeight: 600, minWidth: '70px', textAlign: 'right', color: '#FFF', fontSize: '14px' }}>
                      {formatCurrency(item.qty * item.product.price)}
                    </span>

                    <button
                      onClick={() => handleRemoveFromCart(item.product.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart Summary & Payment Controls */}
          {simCart.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '1px solid #364441',
                  borderBottom: '1px solid #364441',
                  marginBottom: '14px'
                }}
              >
                <span style={{ fontSize: '15px', color: '#A0B2AF' }}>Total Due:</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#4FB0A4' }}>
                  {formatCurrency(cartTotal)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A0B2AF', marginBottom: '6px' }}>
                  PAYMENT METHOD
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    className="pos-touch-btn"
                    style={{
                      backgroundColor: simPaymentType === 'cash' ? 'var(--color-primary)' : '#1E2524',
                      color: '#FFF',
                      border: '1px solid #364441'
                    }}
                    onClick={() => setSimPaymentType('cash')}
                  >
                    <Banknote size={16} /> Cash
                  </button>
                  <button
                    className="pos-touch-btn"
                    style={{
                      backgroundColor: simPaymentType === 'credit' ? 'var(--color-primary)' : '#1E2524',
                      color: '#FFF',
                      border: '1px solid #364441'
                    }}
                    onClick={() => setSimPaymentType('credit')}
                  >
                    <CreditCard size={16} /> Credit
                  </button>
                </div>
              </div>

              {/* Customer selection for Credit checkout */}
              {simPaymentType === 'credit' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#A0B2AF', marginBottom: '6px' }}>
                    SELECT CREDIT CUSTOMER (BUKAS-BAYAD)
                  </label>
                  <select
                    className="select-field"
                    value={simSelectedCustomer}
                    onChange={(e) => setSimSelectedCustomer(e.target.value)}
                    style={{ backgroundColor: '#1E2524', color: '#FFF', borderColor: '#364441' }}
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Limit: {formatCurrency(c.credit_limit)} | Bal: {formatCurrency(c.current_credit_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Touch Checkout Button */}
              <button
                className="pos-touch-btn"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFF',
                  marginTop: '10px',
                  boxShadow: 'var(--shadow-overlay)'
                }}
                onClick={handleSimCheckout}
              >
                <CheckCircle2 size={18} />
                Complete {simPaymentType.toUpperCase()} Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
