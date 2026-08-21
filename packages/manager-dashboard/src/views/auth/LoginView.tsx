import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { BrandLogo } from '../../components/common/BrandLogo.js';
import { LegalModal, LegalModalView } from '../../components/common/LegalModal.js';
import { Lock, Mail, ArrowRight, ShieldCheck, KeyRound, HelpCircle } from 'lucide-react';

export function LoginView() {
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('manager@aegisretail.local');
  const [password, setPassword] = useState('Password123!');

  // Legal / Compliance Modal state
  const [legalModal, setLegalModal] = useState<{ open: boolean; view: LegalModalView }>({
    open: false,
    view: 'privacy'
  });

  // Forgot Password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    try {
      await login(email, password);
    } catch {
      // Error handled in AuthContext
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          boxShadow: 'var(--shadow-overlay)',
          border: '1px solid var(--border-subtle)',
          margin: 'auto'
        }}
      >
        {/* Brand Logo with Tinted Badge Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <BrandLogo size={40} withContainer={true} />
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Aegis Retail
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Store Manager Control Dashboard
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--tint-red-10)',
              border: '1px solid rgba(166, 64, 46, 0.25)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              color: 'var(--color-accent-red)',
              fontSize: '13px',
              lineHeight: 1.4
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="manager-email">Manager Email</label>
            <input
              id="manager-email"
              className="input-field"
              type="email"
              required
              autoComplete="email"
              placeholder="manager@aegisretail.local"
              value={email}
              onChange={(e) => {
                clearError();
                setEmail(e.target.value);
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="manager-password">Password</label>
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="manager-password"
              className="input-field"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                clearError();
                setPassword(e.target.value);
              }}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '12px' }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In as Store Manager'}
          </button>
        </form>

        {/* Provisioned Access Model Guidance */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px 14px',
            backgroundColor: 'var(--bg-surface-alt)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.5
          }}
        >
          <span>No account yet? </span>
          <button
            onClick={() => setLegalModal({ open: true, view: 'support' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'underline'
            }}
          >
            Contact your Aegis regional partner
          </button>
          <span> to get your store set up.</span>
        </div>

        {/* Credibility Anchor */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-subtle)', letterSpacing: '0.02em' }}>
          Offline-First Delta Sync • SHA-256 Ledger • Edge Verified
        </div>

        {/* Minimal Legal Footer on Card */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '11px',
            color: 'var(--text-subtle)'
          }}
        >
          <button
            onClick={() => setLegalModal({ open: true, view: 'privacy' })}
            style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Privacy Policy (RA 10173)
          </button>
          <span>•</span>
          <button
            onClick={() => setLegalModal({ open: true, view: 'terms' })}
            style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Terms
          </button>
          <span>•</span>
          <button
            onClick={() => setLegalModal({ open: true, view: 'support' })}
            style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
          >
            Partner Support
          </button>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {forgotPasswordOpen && (
        <div className="modal-overlay" onClick={() => setForgotPasswordOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: '17px' }}>Password Reset & Recovery</h3>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
              Aegis Retail utilizes enterprise cryptographic device authorization and store tenant isolation. For security, store manager passwords and hardware MFA tokens cannot be reset via unverified email links.
            </p>

            <div style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>How to restore access:</div>
              <div>1. Contact your authorized Regional Partner Coordinator.</div>
              <div>2. Provide your Store License ID (e.g. <code>Store #104</code>).</div>
              <div>3. Complete two-factor identity verification to receive an ephemeral re-key token.</div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setForgotPasswordOpen(false);
                  setLegalModal({ open: true, view: 'support' });
                }}
              >
                View Support Contacts
              </button>
              <button className="btn btn-primary" onClick={() => setForgotPasswordOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL & COMPLIANCE MODAL */}
      <LegalModal
        isOpen={legalModal.open}
        view={legalModal.view}
        onClose={() => setLegalModal({ ...legalModal, open: false })}
        onSelectView={(v) => setLegalModal({ open: true, view: v })}
      />
    </div>
  );
}
