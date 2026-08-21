import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { DashboardDataProvider } from './context/DashboardDataContext.js';
import { ToastContainer } from './components/common/ToastContainer.js';
import { LegalModal, LegalModalView } from './components/common/LegalModal.js';
import { Header } from './components/layout/Header.js';
import { TabNav, ManagerTab } from './components/layout/TabNav.js';
import { Footer } from './components/layout/Footer.js';
import { LoginView } from './views/auth/LoginView.js';
import { OverviewTab } from './views/manager/OverviewTab.js';
import { DeviceHealthTab } from './views/manager/DeviceHealthTab.js';
import { MasterPricingTab } from './views/manager/MasterPricingTab.js';
import { ConflictQueueTab } from './views/manager/ConflictQueueTab.js';
import { CreditLedgerTab } from './views/manager/CreditLedgerTab.js';
import { AuditTrailTab } from './views/manager/AuditTrailTab.js';
import { PosSimulatorView } from './views/pos-simulator/PosSimulatorView.js';

function DashboardShell() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'manager' | 'pos_simulator'>('manager');
  const [activeTab, setActiveTab] = useState<ManagerTab>('overview');
  const [legalModal, setLegalModal] = useState<{ open: boolean; view: LegalModalView }>({ open: false, view: 'privacy' });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: '200px', height: '24px', borderRadius: 'var(--radius-pill)' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {currentView === 'manager' && (
        <>
          <TabNav activeTab={activeTab} onTabSelect={setActiveTab} />
          <main style={{ maxWidth: '1440px', margin: '24px auto', padding: '0 24px', flex: 1, width: '100%' }}>
            {activeTab === 'overview' && <OverviewTab onNavigateTab={setActiveTab} onNavigateView={setCurrentView} />}
            {activeTab === 'devices' && <DeviceHealthTab />}
            {activeTab === 'pricing' && <MasterPricingTab />}
            {activeTab === 'anomalies' && <ConflictQueueTab />}
            {activeTab === 'credit' && <CreditLedgerTab />}
            {activeTab === 'audit' && <AuditTrailTab />}
          </main>
          <Footer onOpenLegalModal={(v) => setLegalModal({ open: true, view: v })} />
        </>
      )}

      {currentView === 'pos_simulator' && <PosSimulatorView />}
      <LegalModal
        isOpen={legalModal.open}
        view={legalModal.view}
        onClose={() => setLegalModal({ ...legalModal, open: false })}
        onSelectView={(v) => setLegalModal({ open: true, view: v })}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DashboardDataProvider>
          <DashboardShell />
          <ToastContainer />
        </DashboardDataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
