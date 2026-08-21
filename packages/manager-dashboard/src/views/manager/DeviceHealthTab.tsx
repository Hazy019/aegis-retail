import React, { useState } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { Smartphone, AlertTriangle, CheckCircle2, Clock, XCircle, ShieldAlert, Cpu } from 'lucide-react';
import { ConfirmModal } from '../../components/common/ConfirmModal.js';
import { CardSkeleton } from '../../components/common/SkeletonLoader.js';

export function DeviceHealthTab() {
  const { devices, revokeTerminal, loading } = useDashboardData();
  const [selectedDeviceForRevocation, setSelectedDeviceForRevocation] = useState<string | null>(null);

  const hasEscalatedWarning = devices.some((d) => d.sync_health === 'escalated_warning');

  const handleConfirmRevoke = async () => {
    if (selectedDeviceForRevocation) {
      await revokeTerminal(selectedDeviceForRevocation, 'Manager manual certificate revocation');
      setSelectedDeviceForRevocation(null);
    }
  };

  if (loading && devices.length === 0) {
    return <CardSkeleton count={3} />;
  }

  return (
    <div className="tab-content-enter">
      {/* Tab Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2>Store Terminal Status & Connectivity</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Real-time monitor for edge cashier terminals, offline sync windows, and cryptographic certificate trust.
        </p>
      </div>

      {/* FOCAL ANCHOR: 48-Hour Offline Escalation Alert */}
      {hasEscalatedWarning && (
        <div className="focal-banner focal-banner-alert" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-accent-red)' }}>
                48-Hour Offline Sync Escalation Alert
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>
                One or more cashier devices have exceeded the 48-hour offline delta sync window. Reconnect terminal to cellular/Wi-Fi to prevent catalog version drift.
              </div>
            </div>
          </div>
          <span className="badge badge-red" style={{ flexShrink: 0 }}>Action Required</span>
        </div>
      )}

      {/* Terminal Cards Grid or Bounded Empty State */}
      {devices.length === 0 ? (
        <div className="empty-state-card">
          <Smartphone size={40} color="var(--color-primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px' }}>No Cashier Terminals Provisioned</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', maxWidth: '440px' }}>
            There are currently no authorized POS terminal devices paired with this store branch. Contact your regional partner coordinator to issue a device certificate.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {devices.map((device) => {
            let statusBadge = (
              <span className="badge badge-green">
                <CheckCircle2 size={12} /> Synced
              </span>
            );
          let borderColor = 'var(--color-accent-green)';

          if (device.is_revoked) {
            statusBadge = (
              <span className="badge badge-red">
                <XCircle size={12} /> Revoked
              </span>
            );
            borderColor = 'var(--color-accent-red)';
          } else if (device.sync_health === 'escalated_warning') {
            statusBadge = (
              <span className="badge badge-red">
                <AlertTriangle size={12} /> 48h Escalated
              </span>
            );
            borderColor = 'var(--color-accent-red)';
          } else if (device.sync_health === 'pending') {
            statusBadge = (
              <span className="badge badge-amber">
                <Clock size={12} /> Queued
              </span>
            );
            borderColor = 'var(--color-accent-amber)';
          }

          return (
            <div
              key={device.id}
              className="card"
              style={{
                borderLeft: `4px solid ${borderColor}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--tint-primary-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{device.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Identifier: <code>{device.identifier}</code></div>
                    </div>
                  </div>
                  {statusBadge}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Device Key ID:</span>
                    <span className="hash-cell" style={{ fontSize: '11px' }}>{device.id.slice(0, 16)}...</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last Cloud Sync:</span>
                    <strong style={{ color: 'var(--text-main)' }}>
                      {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Offline Duration:</span>
                    <strong style={{ color: device.offline_hours >= 48 ? 'var(--color-accent-red)' : 'var(--text-main)' }}>
                      {device.offline_hours} hours
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Status Message:</span>
                    <em>{device.status_message}</em>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Cpu size={13} /> Ed25519 Signed
                </span>
                {!device.is_revoked ? (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setSelectedDeviceForRevocation(device.id)}
                  >
                    <XCircle size={13} /> Revoke Certificate
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-accent-red)', fontWeight: 500 }}>
                    Terminal Certificate Blocked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Accessible Revocation Confirmation Modal */}
      <ConfirmModal
        isOpen={selectedDeviceForRevocation !== null}
        title="Revoke Cashier Terminal Authorization?"
        message="Revoking this device will immediately invalidate its cryptographic session key and block it from synchronizing offline sales with the cloud. This action is recorded in the immutable audit chain."
        confirmLabel="Confirm Revocation"
        isDanger={true}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setSelectedDeviceForRevocation(null)}
      />
    </div>
  );
}
