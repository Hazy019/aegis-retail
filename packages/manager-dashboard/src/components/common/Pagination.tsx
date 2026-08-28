import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25],
  itemLabel = 'entries'
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate visible page numbers with surrounding window
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, safePage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="pagination-bar" role="navigation" aria-label="Table Pagination">
      {/* Left: Range and Count */}
      <div className="pagination-info">
        <span>
          Showing <strong style={{ color: 'var(--text-main)' }}>{startItem}–{endItem}</strong> of{' '}
          <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="pagination-size-selector">
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="pagination-select"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Buttons */}
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft size={15} />
        </button>

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`pagination-btn ${p === safePage ? 'pagination-btn-active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === safePage ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight size={15} />
        </button>

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
