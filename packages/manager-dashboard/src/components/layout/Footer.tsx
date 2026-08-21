import React from 'react';
import { ShieldCheck, Lock, FileText, Phone } from 'lucide-react';
import { LegalModalView } from '../common/LegalModal.js';

interface FooterProps {
  onOpenLegalModal: (view: LegalModalView) => void;
}

export function Footer({ onOpenLegalModal }: FooterProps) {
  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px 24px',
        marginTop: 'auto'
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Aegis Retail v1.2</span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-accent-green)' }}>
            <ShieldCheck size={13} /> RA 10173 Data Privacy Compliant
          </span>
          <span>•</span>
          <span>SHA-256 Ledger Genesis Verified</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onOpenLegalModal('privacy')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => onOpenLegalModal('terms')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            Terms of Service
          </button>
          <button
            onClick={() => onOpenLegalModal('support')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            Regional Partner Support
          </button>
        </div>
      </div>
    </footer>
  );
}
