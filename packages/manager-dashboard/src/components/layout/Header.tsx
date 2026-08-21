import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { BrandLogo } from '../common/BrandLogo.js';
import { RefreshCw, LogOut, LayoutDashboard, ShoppingCart, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentView: 'manager' | 'pos_simulator';
  onViewChange: (view: 'manager' | 'pos_simulator') => void;
}

export function Header({ currentView, onViewChange }: HeaderProps) {
  const { logout, managerEmail } = useAuth();
  const { storeInfo, refreshData, loading } = useDashboardData();

  return (
    <header style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 24px' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Store Information */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <BrandLogo size={36} withContainer={true} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {storeInfo?.name || 'Aegis Sari-Sari Store #104'}
              </h1>
              <span className="badge badge-teal" style={{ fontSize: '11px' }}>
                Store ID: {storeInfo?.id?.slice(0, 8) || 'Store-01'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>Region: {storeInfo?.region || 'Central Metro'}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span className="status-dot synced" /> Cloud API Online
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher (Manager Dashboard vs POS Simulator) */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-surface-alt)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            className={`btn btn-sm ${currentView === 'manager' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', boxShadow: currentView === 'manager' ? 'var(--shadow-subtle)' : 'none' }}
            onClick={() => onViewChange('manager')}
          >
            <LayoutDashboard size={15} /> Manager Dashboard
          </button>
          <button
            className={`btn btn-sm ${currentView === 'pos_simulator' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', boxShadow: currentView === 'pos_simulator' ? 'var(--shadow-subtle)' : 'none' }}
            onClick={() => onViewChange('pos_simulator')}
          >
            <ShoppingCart size={15} /> POS Simulator
          </button>
        </div>

        {/* User Session & Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right', display: 'none', minWidth: '120px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
              {managerEmail}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              MFA Active • Full Access
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => refreshData()}
            disabled={loading}
            title="Fetch latest cloud delta sync"
          >
            <RefreshCw size={14} className={loading ? 'skeleton' : ''} /> {loading ? 'Syncing...' : 'Sync Data'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Sign out of store manager account"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
