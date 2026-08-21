import React, { useState } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { AnomalyItem } from '../../api/client.js';
import { AlertTriangle, CheckCircle2, RefreshCw, X, HelpCircle, Layers } from 'lucide-react';
import { CardSkeleton } from '../../components/common/SkeletonLoader.js';

export function ConflictQueueTab() {
  const { anomalies, products, reconcileAnomaly, loading } = useDashboardData();
  const [reconcileModal, setReconcileModal] = useState<{
    open: boolean;
    anomaly: AnomalyItem | null;
    restockQty: string;
    notes: string;
  }>({
    open: false,
    anomaly: null,
    restockQty: '20',
    notes: 'Restocked from central distribution warehouse batch'
  });

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileModal.anomaly) return;
    const qty = parseInt(reconcileModal.restockQty, 10);
    if (isNaN(qty)) return;

    await reconcileAnomaly(reconcileModal.anomaly.id, qty, reconcileModal.notes.trim());
    setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' });
  };

  if (loading && anomalies.length === 0) {
    return <CardSkeleton count={2} />;
  }

  return (
    <div className="tab-content-enter">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2>Concurrent Conflict & Anomaly Reconciliation</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          When offline cashier sales conflict with manager inventory adjustments, Aegis records both mutations and clamps stock without blocking cashiers.
        </p>
      </div>

      {/* FOCAL ANCHOR: Discrepancy Status Banner */}
      {unresolvedAnomalies.length > 0 ? (
        <div className="focal-banner focal-banner-warning" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-accent-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-accent-amber)' }}>
                {unresolvedAnomalies.length} Active Discrepancy Requiring Physical Verification
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>
                Soft stock clamping has preserved POS cashier availability. Reconcile with actual physical shelf counts below.
              </div>
            </div>
          </div>
          <span className="badge badge-amber" style={{ flexShrink: 0 }}>Pending Review</span>
        </div>
      ) : (
        <div className="focal-banner focal-banner-verified">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-accent-green)' }}>
                All Inventory Discrepancies Reconciled
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>
                Offline cashier sales and manager stock updates are fully synchronized with 100% mathematical consistency.
              </div>
            </div>
          </div>
          <span className="badge badge-green">Healthy State</span>
        </div>
      )}

      {/* Anomalies List */}
      {anomalies.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <CheckCircle2 size={40} color="var(--color-accent-green)" style={{ marginBottom: '12px' }} />
          <h3>No Conflict Anomalies on Record</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
            All offline transactions have synced cleanly without conflicting write mutations.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {anomalies.map((a) => {
            const prod = products.find((p) => p.id === a.product_id);
            const isResolved = a.resolved;

            return (
              <div
                key={a.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${isResolved ? 'var(--color-accent-green)' : 'var(--color-accent-red)'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle
                      size={20}
                      color={isResolved ? 'var(--color-accent-green)' : 'var(--color-accent-red)'}
                    />
                    <div>
                      <strong style={{ fontSize: '16px' }}>
                        {prod?.name || 'Catalog Product'}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        SKU: <code>{prod?.sku || 'SKU-UNKNOWN'}</code>
                      </span>
                    </div>
                  </div>

                  {isResolved ? (
                    <span className="badge badge-green">
                      <CheckCircle2 size={12} /> Reconciled
                    </span>
                  ) : (
                    <span className="badge badge-red">
                      <AlertTriangle size={12} /> Action Required
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '14px', lineHeight: 1.5 }}>
                  {a.details}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-surface-alt)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    marginBottom: '16px'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Calculated True Stock: </span>
                    <strong className="metric-cell" style={{ color: 'var(--color-accent-red)' }}>
                      {a.calculated_stock}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Clamped POS Display: </span>
                    <strong className="metric-cell">{a.clamped_stock}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Logged: </span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {!isResolved && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        setReconcileModal({
                          open: true,
                          anomaly: a,
                          restockQty: '20',
                          notes: 'Physical count verified; restocked from warehouse'
                        })
                      }
                    >
                      <CheckCircle2 size={14} /> Reconcile & Commit True Count
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: RECONCILE ANOMALY */}
      {reconcileModal.open && reconcileModal.anomaly && (
        <div className="modal-overlay" onClick={() => setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px' }}>Reconcile Stock Discrepancy</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' })}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {reconcileModal.anomaly.details}
            </p>

            <form onSubmit={handleReconcileSubmit}>
              <div className="form-group">
                <label className="form-label">Verified Physical Stock Count</label>
                <input
                  className="input-field"
                  type="number"
                  required
                  value={reconcileModal.restockQty}
                  onChange={(e) => setReconcileModal({ ...reconcileModal, restockQty: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Audit Notes & Distributor Reference</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  placeholder="e.g. Physical inventory counted; restocked batch #81"
                  value={reconcileModal.notes}
                  onChange={(e) => setReconcileModal({ ...reconcileModal, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReconcileModal({ open: false, anomaly: null, restockQty: '20', notes: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Reconcile & Update Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
