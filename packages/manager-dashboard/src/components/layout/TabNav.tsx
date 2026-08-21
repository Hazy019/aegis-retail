import React from 'react';
import { LayoutDashboard, Smartphone, Tag, AlertTriangle, CreditCard, History } from 'lucide-react';
import { useDashboardData } from '../../context/DashboardDataContext.js';

export type ManagerTab = 'overview' | 'devices' | 'pricing' | 'anomalies' | 'credit' | 'audit';

interface TabNavProps {
  activeTab: ManagerTab;
  onTabSelect: (tab: ManagerTab) => void;
}

export function TabNav({ activeTab, onTabSelect }: TabNavProps) {
  const { anomalies } = useDashboardData();
  const unresolvedAnomalyCount = anomalies.filter((a) => !a.resolved).length;

  const tabs: { id: ManagerTab; label: string; icon: React.ComponentType<{ size: number }> }[] = [
    { id: 'overview', label: 'Store Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Device Health & Sync', icon: Smartphone },
    { id: 'pricing', label: 'Master Pricing & Stock', icon: Tag },
    { id: 'anomalies', label: 'Conflict & Anomaly Queue', icon: AlertTriangle },
    { id: 'credit', label: 'Customer Credit Ledger', icon: CreditCard },
    { id: 'audit', label: 'Tamper-Evident Audit Trail', icon: History }
  ];

  return (
    <nav
      aria-label="Manager Dashboard Navigation"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 24px'
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingTop: '6px'
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabSelect(tab.id)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                borderBottom: isActive ? '2px solid var(--color-primary)' : '1px solid transparent',
                padding: '10px 16px',
                whiteSpace: 'nowrap',
                position: 'relative'
              }}
              role="tab"
              aria-selected={isActive}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.id === 'anomalies' && unresolvedAnomalyCount > 0 && (
                <span
                  className="badge badge-red"
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    marginLeft: '4px'
                  }}
                >
                  {unresolvedAnomalyCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
