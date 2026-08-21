import React from 'react';
import { useToast } from '../../context/ToastContext.js';
import { CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="region" aria-label="System Notifications">
      {toasts.map((t) => {
        let Icon = CheckCircle2;
        let iconColor = 'var(--color-accent-green)';
        if (t.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'var(--color-accent-amber)';
        } else if (t.type === 'error') {
          Icon = AlertCircle;
          iconColor = 'var(--color-accent-red)';
        } else if (t.type === 'sync') {
          Icon = RefreshCw;
          iconColor = 'var(--color-primary)';
        }

        return (
          <div key={t.id} className={`toast-item toast-${t.type}`} role="alert">
            <div style={{ marginTop: '2px', flexShrink: 0 }}>
              <Icon size={18} color={iconColor} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                {t.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {t.message}
              </div>
              {t.latencyMs !== undefined && (
                <div className="toast-latency-pill">
                  ⚡ {t.latencyMs}ms local commit
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-subtle)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
