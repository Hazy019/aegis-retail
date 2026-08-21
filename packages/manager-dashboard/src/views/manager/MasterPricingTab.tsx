import React, { useState, useMemo } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { CatalogProduct } from '../../api/client.js';
import { Tag, Trash2, Search, Package, Plus, X } from 'lucide-react';
import { TableSkeleton } from '../../components/common/SkeletonLoader.js';

export function MasterPricingTab() {
  const { products, updateProductPrice, writeOffDamage, loading } = useDashboardData();
  const [searchQuery, setSearchQuery] = useState('');

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
    reason: 'Water / packaging transit damage'
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }, [products, searchQuery]);

  const formatCurrency = (minor: number) => `₱${(minor / 100).toFixed(2)}`;

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModal.product) return;
    const priceVal = parseFloat(priceModal.newPrice);
    if (isNaN(priceVal) || priceVal <= 0) return;

    const minor = Math.round(priceVal * 100);
    await updateProductPrice(priceModal.product.id, minor);
    setPriceModal({ open: false, product: null, newPrice: '' });
  };

  const handleDamageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageModal.product) return;
    const qty = parseInt(damageModal.quantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    await writeOffDamage(damageModal.product.id, qty, damageModal.reason.trim());
    setDamageModal({ open: false, product: null, quantity: '5', reason: '' });
  };

  if (loading && products.length === 0) {
    return <TableSkeleton rows={6} cols={7} />;
  }

  return (
    <div className="tab-content-enter">
      {/* Header & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Master Product Catalog & Pricing</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Manage inventory and retail prices. Price changes propagate to cashier terminals on their next delta sync.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search product, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product & SKU</th>
              <th>Barcode</th>
              <th>Unit Type</th>
              <th style={{ textAlign: 'right' }}>Cost Price</th>
              <th style={{ textAlign: 'right' }}>Retail Price</th>
              <th style={{ textAlign: 'center' }}>Physical Stock</th>
              <th style={{ textAlign: 'center' }}>POS Display Stock</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No catalog products found matching "{searchQuery}".
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: <code>{p.sku}</code></div>
                  </td>
                  <td>
                    <span className="hash-cell" style={{ fontSize: '11px' }}>{p.barcode}</span>
                  </td>
                  <td>
                    <span className="badge badge-teal">
                      {p.unit_type} {p.units_per_bulk > 1 ? `(${p.units_per_bulk}/bulk)` : ''}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="metric-cell" style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(p.cost_price)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="metric-cell" style={{ color: 'var(--color-primary)', fontSize: '15px' }}>
                      {formatCurrency(p.price)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className="metric-cell"
                      style={{ color: p.stock_quantity < 0 ? 'var(--color-accent-red)' : 'inherit' }}
                    >
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-green">
                      {p.display_quantity} units
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPriceModal({ open: true, product: p, newPrice: (p.price / 100).toString() })}
                        title="Queue retail price adjustment"
                      >
                        <Tag size={13} /> Edit Price
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDamageModal({ open: true, product: p, quantity: '5', reason: 'Damaged item write-off' })}
                        title="Record damaged inventory write-off"
                      >
                        <Trash2 size={13} /> Write-Off
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: EDIT PRICE */}
      {priceModal.open && priceModal.product && (
        <div className="modal-overlay" onClick={() => setPriceModal({ open: false, product: null, newPrice: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px' }}>Queue Price Update</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPriceModal({ open: false, product: null, newPrice: '' })}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Product: <strong>{priceModal.product.name}</strong> ({priceModal.product.sku})
            </p>

            <form onSubmit={handlePriceSubmit}>
              <div className="form-group">
                <label className="form-label">New Retail Price (PHP)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.25"
                  min="0.25"
                  required
                  value={priceModal.newPrice}
                  onChange={(e) => setPriceModal({ ...priceModal, newPrice: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPriceModal({ open: false, product: null, newPrice: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Queue Price Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DAMAGE WRITE-OFF */}
      {damageModal.open && damageModal.product && (
        <div className="modal-overlay" onClick={() => setDamageModal({ open: false, product: null, quantity: '5', reason: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px' }}>Record Damaged Stock Write-off</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDamageModal({ open: false, product: null, quantity: '5', reason: '' })}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Product: <strong>{damageModal.product.name}</strong> ({damageModal.product.sku})
            </p>

            <form onSubmit={handleDamageSubmit}>
              <div className="form-group">
                <label className="form-label">Quantity Damaged</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  required
                  value={damageModal.quantity}
                  onChange={(e) => setDamageModal({ ...damageModal, quantity: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Notes</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  placeholder="e.g. Water damage during transit"
                  value={damageModal.reason}
                  onChange={(e) => setDamageModal({ ...damageModal, reason: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDamageModal({ open: false, product: null, quantity: '5', reason: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Write-Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
