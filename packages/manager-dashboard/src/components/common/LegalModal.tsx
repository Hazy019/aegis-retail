import React, { useEffect } from 'react';
import { Shield, FileText, Phone, X, CheckCircle2, Lock } from 'lucide-react';

export type LegalModalView = 'terms' | 'privacy' | 'support';

interface LegalModalProps {
  isOpen: boolean;
  view: LegalModalView;
  onClose: () => void;
  onSelectView?: (view: LegalModalView) => void;
}

export function LegalModal({ isOpen, view, onClose, onSelectView }: LegalModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header & Navigation Tabs */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="var(--color-primary)" />
            <h3 id="legal-modal-title" style={{ fontSize: '18px' }}>
              {view === 'terms' && 'Terms of Service'}
              {view === 'privacy' && 'Data Privacy & Compliance Policy'}
              {view === 'support' && 'Aegis Regional Partner & Support'}
            </h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: '4px 8px' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <button
            className={`btn btn-sm ${view === 'privacy' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectView?.('privacy')}
          >
            <Lock size={13} /> Privacy Policy (RA 10173)
          </button>
          <button
            className={`btn btn-sm ${view === 'terms' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectView?.('terms')}
          >
            <FileText size={13} /> Terms of Service
          </button>
          <button
            className={`btn btn-sm ${view === 'support' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSelectView?.('support')}
          >
            <Phone size={13} /> Regional Partner Support
          </button>
        </div>

        {/* Dynamic Modal Content */}
        <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
          {view === 'privacy' && (
            <div>
              <div style={{ backgroundColor: 'var(--tint-green-10)', border: '1px solid rgba(79, 122, 87, 0.25)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-green)', fontWeight: 600, marginBottom: '14px' }}>
                ✓ Philippine Republic Act No. 10173 (Data Privacy Act of 2012) Compliant
              </div>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>1. Scope & Personal Data Collection</h4>
              <p style={{ marginBottom: '12px' }}>
                Aegis Retail processes store transactional data and community customer credit ledgers (<em>Bukas-Bayad</em>). Personal Identifiable Information (PII) collected is limited strictly to customer full names, mobile phone contact numbers, and approved credit ledger balances.
              </p>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>2. Data Storage, RLS Isolation & Cryptographic Integrity</h4>
              <p style={{ marginBottom: '12px' }}>
                Customer records are secured with multi-tenant database Row-Level Security (RLS) policies ensuring complete cryptographic segregation between store branches. Local offline terminal caches are encrypted, and all mutations are chained with immutable SHA-256 audit hashes.
              </p>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>3. Data Subject Rights & Data Controller</h4>
              <p>
                In accordance with RA 10173, registered customers possess the right to access, rectify, and request account de-identification upon settlement of outstanding balances. The licensed Store Manager acts as the local Data Controller.
              </p>
            </div>
          )}

          {view === 'terms' && (
            <div>
              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>1. Provisioned Store Tenancy & Access</h4>
              <p style={{ marginBottom: '12px' }}>
                Aegis Retail accounts and cryptographic terminal authorization certificates are provisioned by certified regional distribution partners. Accounts are enterprise-managed and require MFA protection.
              </p>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>2. Offline Operations & 48-Hour Sync Policy</h4>
              <p style={{ marginBottom: '12px' }}>
                Edge POS terminals are designed for continuous offline transaction recording. To prevent stock drift, store managers must ensure edge terminals connect to a cellular or broadband hotspot at least once every 48 hours.
              </p>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>3. Cryptographic Non-Repudiation</h4>
              <p>
                All retail price updates, inventory write-offs, and terminal revocation actions are signed and permanently logged in the immutable audit ledger.
              </p>
            </div>
          )}

          {view === 'support' && (
            <div>
              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>Account Provisioning & Store Onboarding</h4>
              <p style={{ marginBottom: '14px' }}>
                Aegis Retail operates under an invite-only regional partner network. If your store branch needs new terminal pairing certificates or additional cashier hardware, reach out to your designated regional partner coordinator.
              </p>

              <div style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Regional Distribution Partner Network</div>
                <div>Support Desk: <strong style={{ color: 'var(--color-primary)' }}>support@aegisretail.local</strong></div>
                <div>Emergency Partner Hotline: <strong style={{ color: 'var(--color-primary)' }}>+63 (2) 8876-AEGIS</strong></div>
                <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-subtle)' }}>Operating Hours: 6:00 AM – 10:00 PM PHT (Mon – Sun)</div>
              </div>

              <h4 style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '6px' }}>Password & MFA Token Reset</h4>
              <p>
                For security reasons, password resets and cryptographic device re-keys cannot be performed via automated self-service email links. Contact your regional partner administrator for identity-verified provisioning.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
