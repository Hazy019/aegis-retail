import React, { useState } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { CreditCard, Plus, UserCheck, X, Phone, User } from 'lucide-react';
import { TableSkeleton } from '../../components/common/SkeletonLoader.js';

export function CreditLedgerTab() {
  const { customers, registerCustomer, loading } = useDashboardData();
  const [customerModal, setCustomerModal] = useState<{
    open: boolean;
    name: string;
    phone: string;
    creditLimit: string;
  }>({
    open: false,
    name: '',
    phone: '',
    creditLimit: '1000'
  });

  const formatCurrency = (minor: number) => `₱${(minor / 100).toFixed(2)}`;

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerModal.name.trim() || !customerModal.phone.trim()) return;
    const limit = parseFloat(customerModal.creditLimit);
    if (isNaN(limit) || limit < 0) return;

    const limitMinor = Math.round(limit * 100);
    await registerCustomer(customerModal.name.trim(), customerModal.phone.trim(), limitMinor);
    setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' });
  };

  if (loading && customers.length === 0) {
    return <TableSkeleton rows={5} cols={6} />;
  }

  return (
    <div className="tab-content-enter">
      {/* Header & Add Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Customer Credit Ledger (Bukas-Bayad)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Manage community micro-credit accounts. Cashiers can record purchases on credit offline within approved limits.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setCustomerModal({ open: true, name: '', phone: '', creditLimit: '1000' })}
        >
          <Plus size={16} /> Register Credit Customer
        </button>
      </div>

      {/* Credit Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th style={{ textAlign: 'right' }}>Approved Credit Limit</th>
              <th style={{ textAlign: 'right' }}>Current Balance (Owed)</th>
              <th style={{ textAlign: 'right' }}>Available Credit</th>
              <th style={{ textAlign: 'center' }}>Account Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No customer credit accounts registered yet. Click above to add one.
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const available = Math.max(0, c.credit_limit - c.current_credit_balance);
                const isNearingLimit = c.current_credit_balance > 0 && available < c.credit_limit * 0.2;

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={15} color="var(--color-primary)" />
                        {c.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: <code>{c.id.slice(0, 8)}...</code></div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <Phone size={13} /> {c.phone}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="metric-cell">{formatCurrency(c.credit_limit)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="metric-cell"
                        style={{
                          color: c.current_credit_balance > 0 ? 'var(--color-accent-amber)' : 'inherit',
                          fontWeight: 700
                        }}
                      >
                        {formatCurrency(c.current_credit_balance)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isNearingLimit ? 'var(--tint-amber-10)' : 'var(--tint-green-10)',
                          color: isNearingLimit ? 'var(--color-accent-amber)' : 'var(--color-accent-green)',
                          fontWeight: 600
                        }}
                      >
                        {formatCurrency(available)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-teal">
                        <UserCheck size={12} /> Active
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ADD CUSTOMER */}
      {customerModal.open && (
        <div className="modal-overlay" onClick={() => setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '17px' }}>Register Credit Customer</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' })}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  placeholder="e.g. Aling Nena Santos"
                  value={customerModal.name}
                  onChange={(e) => setCustomerModal({ ...customerModal, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  placeholder="e.g. +639171234567"
                  value={customerModal.phone}
                  onChange={(e) => setCustomerModal({ ...customerModal, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Approved Credit Limit (PHP)</label>
                <input
                  className="input-field"
                  type="number"
                  step="50"
                  min="100"
                  required
                  value={customerModal.creditLimit}
                  onChange={(e) => setCustomerModal({ ...customerModal, creditLimit: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCustomerModal({ open: false, name: '', phone: '', creditLimit: '1000' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
