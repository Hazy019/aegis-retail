import React, { useState } from 'react';
import { useDashboardData } from '../../context/DashboardDataContext.js';
import { CreditCard, Plus, UserCheck, X, Phone, User, Banknote, CheckCircle2 } from 'lucide-react';
import { TableSkeleton } from '../../components/common/SkeletonLoader.js';
import { CreditCustomer } from '../../api/client.js';

export function CreditLedgerTab() {
  const { customers, registerCustomer, recordCreditPayment, loading } = useDashboardData();
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

  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    customer: CreditCustomer | null;
    amount: string;
    notes: string;
  }>({
    open: false,
    customer: null,
    amount: '',
    notes: 'Cash payment settled at store counter'
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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.customer) return;
    const payVal = parseFloat(paymentModal.amount);
    if (isNaN(payVal) || payVal <= 0) return;

    const payMinor = Math.round(payVal * 100);
    await recordCreditPayment(paymentModal.customer.id, payMinor, paymentModal.notes.trim());
    setPaymentModal({ open: false, customer: null, amount: '', notes: '' });
  };

  if (loading && customers.length === 0) {
    return <TableSkeleton rows={5} cols={7} />;
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
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
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
                    <td style={{ textAlign: 'right' }}>
                      {c.current_credit_balance > 0 ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', fontWeight: 600 }}
                          onClick={() =>
                            setPaymentModal({
                              open: true,
                              customer: c,
                              amount: (c.current_credit_balance / 100).toString(),
                              notes: 'Cash payment settled at store counter'
                            })
                          }
                        >
                          <Banknote size={13} /> Record Payment
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Zero Balance</span>
                      )}
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

      {/* MODAL: RECORD CREDIT PAYMENT (BAYAD NG UTANG) */}
      {paymentModal.open && paymentModal.customer && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ open: false, customer: null, amount: '', notes: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: '17px' }}>Record Credit Repayment (Bayad)</h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPaymentModal({ open: false, customer: null, amount: '', notes: '' })}
                style={{ padding: '4px 8px' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Customer: <strong>{paymentModal.customer.name}</strong> • Outstanding Balance: <strong style={{ color: 'var(--color-accent-amber)' }}>{formatCurrency(paymentModal.customer.current_credit_balance)}</strong>
            </p>

            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label className="form-label">Payment Amount (PHP)</label>
                <input
                  className="input-field"
                  type="number"
                  step="0.50"
                  min="0.50"
                  max={(paymentModal.customer.current_credit_balance / 100).toString()}
                  required
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  autoFocus
                />
              </div>

              {/* Quick Amount Presets */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPaymentModal({ ...paymentModal, amount: (paymentModal.customer!.current_credit_balance / 100).toString() })}
                >
                  Full Balance
                </button>
                {paymentModal.customer.current_credit_balance >= 10000 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPaymentModal({ ...paymentModal, amount: '100' })}
                  >
                    ₱100.00
                  </button>
                )}
                {paymentModal.customer.current_credit_balance >= 20000 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPaymentModal({ ...paymentModal, amount: '200' })}
                  >
                    ₱200.00
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Receipt / Payment Notes</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Cash payment at register"
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({ ...paymentModal, notes: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentModal({ open: false, customer: null, amount: '', notes: '' })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={14} /> Commit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

