import React, { useState, useMemo } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { ShieldCheck, ShieldAlert, RefreshCw, Lock, Link } from 'lucide-react';
import { TableSkeleton } from '../../components/common/SkeletonLoader.js';
import { Pagination } from '../../components/common/Pagination.js';

export function AuditTrailTab() {
  const { auditLogs, auditVerification, refreshData, loading } = useDashboardData();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const isChainValid = auditVerification?.chain_valid ?? true;

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return auditLogs.slice(start, start + pageSize);
  }, [auditLogs, currentPage, pageSize]);

  if (loading && auditLogs.length === 0) {
    return <TableSkeleton rows={6} cols={6} />;
  }

  return (
    <div className="tab-content-enter">
      {/* Header & Verification Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Immutable Audit Trail & Cryptographic Chain</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Every mutation to pricing, inventory, customer credit, and terminal authorization is cryptographically chained using SHA-256.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => refreshData()}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'skeleton' : ''} /> Re-verify Chain Integrity
        </button>
      </div>

      {/* FOCAL ANCHOR: Genesis Block Verification Banner */}
      {auditVerification && (
        <div
          className={`focal-banner ${isChainValid ? 'focal-banner-verified' : 'focal-banner-alert'}`}
          role="region"
          aria-label="Cryptographic Verification Status"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: isChainValid ? 'var(--color-accent-green)' : 'var(--color-accent-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                flexShrink: 0
              }}
            >
              {isChainValid ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
            </div>
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '15px',
                  color: isChainValid ? 'var(--color-accent-green)' : 'var(--color-accent-red)'
                }}
              >
                {isChainValid
                  ? 'Cryptographic SHA-256 Hash Chain Intact & Verified'
                  : 'Cryptographic Chain Integrity Breach Detected'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>
                All {auditVerification.total_entries} historical transactions mathematically verified against the Genesis block.
              </div>
            </div>
          </div>
          <span className={`badge ${isChainValid ? 'badge-green' : 'badge-red'}`} style={{ flexShrink: 0 }}>
            {isChainValid ? 'Zero Tampering' : 'Broken Chain'}
          </span>
        </div>
      )}

      {/* Containerized Table Viewport */}
      <div className="table-viewport-card">
        <div className="table-scroll-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor & Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>SHA-256 Hash</th>
                <th>Previous Block Hash</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                    No audit log entries recorded yet.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-teal">{log.actor_role}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                        <code>{log.actor_id.slice(0, 8)}...</code>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>{log.action}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px' }}>
                        {log.entity_type} ({log.entity_id.slice(0, 8)})
                      </code>
                    </td>
                    <td>
                      <span className="hash-cell">{log.hash.slice(0, 16)}...</span>
                    </td>
                    <td>
                      <span
                        className="hash-cell"
                        style={{
                          backgroundColor: 'transparent',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {log.previous_hash.slice(0, 16)}...
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalItems={auditLogs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[6, 12, 24]}
          itemLabel="audit blocks"
        />
      </div>
    </div>
  );
}

