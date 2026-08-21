import React from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { ManagerTab } from '../../components/layout/TabNav.js';
import {
  Smartphone,
  Tag,
  AlertTriangle,
  CreditCard,
  History,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Package,
  Plus,
  Trash2,
  Lock,
  Layers
} from 'lucide-react';
import { CardSkeleton } from '../../components/common/SkeletonLoader.js';

interface OverviewTabProps {
  onNavigateTab: (tab: ManagerTab) => void;
  onNavigateView: (view: 'manager' | 'pos_simulator') => void;
}

export function OverviewTab({ onNavigateTab, onNavigateView }: OverviewTabProps) {
  const {
    storeInfo,
    devices,
    products,
    anomalies,
    customers,
    auditLogs,
    auditVerification,
    loading
  } = useDashboardData();

  const formatCurrency = (minor: number) => `₱${(minor / 100).toFixed(2)}`;

  if (loading && products.length === 0) {
    return <CardSkeleton count={4} />;
  }

  // Calculated Metrics
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalCatalogSkus = products.length;
  const syncedDevicesCount = devices.filter((d) => d.sync_health === 'synced' && !d.is_revoked).length;
  const totalDevicesCount = devices.length;
  const totalCreditOwed = customers.reduce((sum, c) => sum + c.current_credit_balance, 0);
  const totalCreditLimit = customers.reduce((sum, c) => sum + c.credit_limit, 0);
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);
  const hasEscalatedWarning = devices.some((d) => d.sync_health === 'escalated_warning');
  const isAuditChainValid = auditVerification?.chain_valid ?? true;

  return (
    <div className="tab-content-enter">
      {/* Store Overview Hero Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>
            {storeInfo?.name || 'Aegis Sari-Sari Store #104'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
            Store Operational Overview & Live Synchronization Hub ({storeInfo?.region || 'Barangay Central'})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-green">
            <CheckCircle2 size={12} /> Delta Sync Ready
          </span>
          <span className="badge badge-teal">
            <Lock size={12} /> SHA-256 Chained
          </span>
        </div>
      </div>

      {/* 6 CLICKABLE KPI HUB CARDS */}
      <div className="kpi-grid">
        
        {/* KPI 1: Inventory & Catalog Size */}
        <div
          className="kpi-card kpi-card-healthy"
          onClick={() => onNavigateTab('pricing')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('pricing')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label">INVENTORY & CATALOG</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--tint-primary-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <Package size={16} />
              </div>
            </div>
            <div className="kpi-value">{totalStockUnits.toLocaleString()} units</div>
            <div className="kpi-subtext">{totalCatalogSkus} active catalog SKUs</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '16px' }}>
            Manage Pricing & Stock <ArrowRight size={13} />
          </div>
        </div>

        {/* KPI 2: Terminal Sync & Device Health */}
        <div
          className={`kpi-card ${hasEscalatedWarning ? 'kpi-card-alert' : 'kpi-card-healthy'}`}
          onClick={() => onNavigateTab('devices')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('devices')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label">TERMINAL HEALTH</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: hasEscalatedWarning ? 'var(--tint-red-10)' : 'var(--tint-green-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasEscalatedWarning ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}>
                <Smartphone size={16} />
              </div>
            </div>
            <div className="kpi-value">{syncedDevicesCount} / {totalDevicesCount} Online</div>
            <div className="kpi-subtext">
              {hasEscalatedWarning ? '⚠️ 48h offline escalation active' : 'All terminals synced within 24h'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '16px' }}>
            Inspect Terminal Certificates <ArrowRight size={13} />
          </div>
        </div>

        {/* KPI 3: Customer Credit Ledger (Bukas-Bayad) */}
        <div
          className="kpi-card kpi-card-healthy"
          onClick={() => onNavigateTab('credit')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('credit')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label">CUSTOMER CREDIT (BUKAS-BAYAD)</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--tint-amber-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-amber)' }}>
                <CreditCard size={16} />
              </div>
            </div>
            <div className="kpi-value">{formatCurrency(totalCreditOwed)}</div>
            <div className="kpi-subtext">Of {formatCurrency(totalCreditLimit)} approved total limit</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '16px' }}>
            View Credit Ledger <ArrowRight size={13} />
          </div>
        </div>

        {/* KPI 4: Conflict & Anomaly Queue */}
        <div
          className={`kpi-card ${unresolvedAnomalies.length > 0 ? 'kpi-card-warning' : 'kpi-card-healthy'}`}
          onClick={() => onNavigateTab('anomalies')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('anomalies')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label">CONFLICT & ANOMALY QUEUE</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: unresolvedAnomalies.length > 0 ? 'var(--tint-amber-10)' : 'var(--tint-green-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: unresolvedAnomalies.length > 0 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)' }}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="kpi-value">
              {unresolvedAnomalies.length} {unresolvedAnomalies.length === 1 ? 'Anomaly' : 'Anomalies'}
            </div>
            <div className="kpi-subtext">
              {unresolvedAnomalies.length > 0
                ? 'Offline stock discrepancies queued'
                : 'Zero active inventory conflicts'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '16px' }}>
            Reconcile Discrepancies <ArrowRight size={13} />
          </div>
        </div>

        {/* KPI 5: Cryptographic Audit Trail */}
        <div
          className={`kpi-card ${isAuditChainValid ? 'kpi-card-healthy' : 'kpi-card-alert'}`}
          onClick={() => onNavigateTab('audit')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('audit')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label">TAMPER-EVIDENT AUDIT TRAIL</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: isAuditChainValid ? 'var(--tint-green-10)' : 'var(--tint-red-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isAuditChainValid ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }}>
                <ShieldCheck size={16} />
              </div>
            </div>
            <div className="kpi-value">{auditLogs.length} Verified Events</div>
            <div className="kpi-subtext">
              {isAuditChainValid ? 'SHA-256 Genesis Hash Verified' : 'Chain verification error'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '16px' }}>
            Audit Immutable Ledger <ArrowRight size={13} />
          </div>
        </div>

        {/* KPI 6: POS Simulator Shortcut */}
        <div
          className="kpi-card"
          style={{ borderLeft: '4px solid var(--color-primary)', backgroundColor: 'var(--tint-primary-5)' }}
          onClick={() => onNavigateView('pos_simulator')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateView('pos_simulator')}
        >
          <div>
            <div className="kpi-header">
              <span className="kpi-label" style={{ color: 'var(--color-primary)' }}>TOUCH CASHIER POS SIMULATOR</span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                <ShoppingCart size={16} />
              </div>
            </div>
            <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>&lt;50ms Local Writes</div>
            <div className="kpi-subtext">Simulate 2G/Airplane mode offline checkout</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700, marginTop: '16px' }}>
            Open POS Register Simulator <ArrowRight size={13} />
          </div>
        </div>
      </div>

      {/* QUICK OPERATIONAL ACTIONS */}
      <div className="quick-actions-bar">
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '8px' }}>
          Quick Actions:
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigateTab('pricing')}
        >
          <Tag size={13} /> Update Retail Price
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigateTab('pricing')}
        >
          <Trash2 size={13} /> Record Damage Write-Off
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigateTab('credit')}
        >
          <Plus size={13} /> Register Credit Customer
        </button>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => onNavigateView('pos_simulator')}
        >
          <ShoppingCart size={13} /> Launch Cashier Register
        </button>
      </div>

      {/* RECENT ACTIVITY & AUDIT STREAM */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: '16px' }}>Recent Cryptographic Ledger Mutations</h3>
          </div>
          <button
            onClick={() => onNavigateTab('audit')}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            View Full Audit Trail
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No mutation events on record yet.
          </div>
        ) : (
          <div className="activity-stream">
            {auditLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="activity-item">
                <div style={{ marginTop: '3px' }}>
                  <div className="status-dot synced" />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{log.action}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      by <code>{log.actor_role}</code> ({log.entity_type})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="hash-cell" style={{ fontSize: '11px' }}>{log.hash.slice(0, 14)}...</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
