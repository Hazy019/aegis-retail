import React from 'react';

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="data-table-wrapper" style={{ padding: '16px' }}>
      <div className="skeleton" style={{ height: '32px', marginBottom: '16px', borderRadius: 'var(--radius-xs)' }} />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton skeleton-row" style={{ opacity: 1 - r * 0.15 }} />
      ))}
    </div>
  );
}
