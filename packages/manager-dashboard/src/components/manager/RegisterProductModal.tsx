import React, { useState } from 'react';
import {
  PackagePlus,
  X,
  Barcode,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  Coffee,
  Wheat,
  Fish,
  Sparkle,
  Cookie
} from 'lucide-react';
import { useDashboardData } from '../../context/DashboardDataContext.js';

export interface RegisterProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CategoryPreset {
  id: string;
  name: string;
  nameTagalog: string;
  icon: React.ReactNode;
  defaultUnit: string;
  skuPrefix: string;
  suggestedName: string;
  defaultCost: string;
  defaultPrice: string;
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'coffee',
    name: 'Coffee & Sachets',
    nameTagalog: 'Kape & Sachets',
    icon: <Coffee size={15} />,
    defaultUnit: 'piece',
    skuPrefix: 'COF',
    suggestedName: 'Nescafe 3-in-1 Blend (Single Sachet)',
    defaultCost: '7.50',
    defaultPrice: '10.00'
  },
  {
    id: 'rice',
    name: 'Rice & Staples',
    nameTagalog: 'Bigas & Butil',
    icon: <Wheat size={15} />,
    defaultUnit: 'kg',
    skuPrefix: 'RIC',
    suggestedName: 'Sinandomeng Special Rice (1kg)',
    defaultCost: '46.00',
    defaultPrice: '55.00'
  },
  {
    id: 'canned',
    name: 'Canned Goods',
    nameTagalog: 'Delata',
    icon: <Fish size={15} />,
    defaultUnit: 'piece',
    skuPrefix: 'CAN',
    suggestedName: '555 Sardines in Tomato Sauce (155g)',
    defaultCost: '19.00',
    defaultPrice: '24.00'
  },
  {
    id: 'detergent',
    name: 'Soap & Detergent',
    nameTagalog: 'Sabon & Panlaba',
    icon: <Sparkle size={15} />,
    defaultUnit: 'piece',
    skuPrefix: 'DET',
    suggestedName: 'Surf Powder Sachet (Active Clean)',
    defaultCost: '9.00',
    defaultPrice: '12.00'
  },
  {
    id: 'snacks',
    name: 'Snacks & Biscuits',
    nameTagalog: 'Tsitsirya & Biskwit',
    icon: <Cookie size={15} />,
    defaultUnit: 'piece',
    skuPrefix: 'SNK',
    suggestedName: 'Piattos Cheese Flavored (40g)',
    defaultCost: '14.00',
    defaultPrice: '18.00'
  }
];

export function RegisterProductModal({ isOpen, onClose }: RegisterProductModalProps) {
  const { registerProduct } = useDashboardData();

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('coffee');
  const [name, setName] = useState('Nescafe 3-in-1 Blend (Single Sachet)');
  const [sku, setSku] = useState('COF-NES-01');
  const [barcode, setBarcode] = useState('4800016801015');
  const [unitType, setUnitType] = useState('piece');
  const [costPrice, setCostPrice] = useState('7.50');
  const [retailPrice, setRetailPrice] = useState('10.00');
  const [initialStock, setInitialStock] = useState('50');

  // Bulk Carton (Tingi) Mode
  const [isBulkTingiMode, setIsBulkTingiMode] = useState(false);
  const [bulkCartonName, setBulkCartonName] = useState('Nescafe 3-in-1 Master Carton (100 sachets)');
  const [bulkBarcode, setBulkBarcode] = useState('4800016801008');
  const [bulkUnitsPerCarton, setBulkUnitsPerCarton] = useState('100');
  const [bulkCostPrice, setBulkCostPrice] = useState('700.00');
  const [bulkRetailPrice, setBulkRetailPrice] = useState('850.00');
  const [bulkInitialStock, setBulkInitialStock] = useState('5');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Preset Click
  const handleSelectPreset = (preset: CategoryPreset) => {
    setSelectedCategory(preset.id);
    setName(preset.suggestedName);
    setUnitType(preset.defaultUnit);
    setCostPrice(preset.defaultCost);
    setRetailPrice(preset.defaultPrice);

    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    setSku(`${preset.skuPrefix}-${randSuffix}`);
    setBarcode(`4800016${randSuffix}${Math.floor(Math.random() * 10)}`);
  };

  // Generate 13-digit EAN Barcode & SKU
  const handleGenerateBarcodeAndSku = () => {
    const prefix = selectedCategory ? selectedCategory.slice(0, 3).toUpperCase() : 'GEN';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setSku(`${prefix}-${randNum}`);
    // Philippine GS1 country prefix is typically 480
    const randomEan = `480${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    setBarcode(randomEan);
    if (isBulkTingiMode) {
      setBulkBarcode(`480${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    }
  };

  // Live Margins Calculation
  const unitCost = parseFloat(costPrice) || 0;
  const unitSell = parseFloat(retailPrice) || 0;
  const unitProfit = unitSell - unitCost;
  const unitMarginPct = unitCost > 0 ? ((unitProfit / unitCost) * 100).toFixed(1) : '0.0';

  // Bulk Tingi Calculation
  const bulkUnits = parseInt(bulkUnitsPerCarton, 10) || 1;
  const bulkCost = parseFloat(bulkCostPrice) || 0;
  const tingiTotalRevenue = unitSell * bulkUnits;
  const tingiGrossProfit = tingiTotalRevenue - bulkCost;
  const tingiMarginPct = bulkCost > 0 ? ((tingiGrossProfit / bulkCost) * 100).toFixed(1) : '0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const costMinor = Math.round((parseFloat(costPrice) || 0) * 100);
    const priceMinor = Math.round((parseFloat(retailPrice) || 0) * 100);
    const stockQty = parseInt(initialStock, 10) || 0;

    if (!name.trim()) {
      setError('Please provide a product name.');
      return;
    }
    if (priceMinor <= 0) {
      setError('Retail price (presyo) must be greater than ₱0.00');
      return;
    }

    setSubmitting(true);

    try {
      if (isBulkTingiMode) {
        // 1. Create Bulk Parent Product (Carton)
        const bulkCostMinor = Math.round((parseFloat(bulkCostPrice) || 0) * 100);
        const bulkPriceMinor = Math.round((parseFloat(bulkRetailPrice) || 0) * 100);
        const bulkStock = parseInt(bulkInitialStock, 10) || 0;

        const parentProduct = await registerProduct({
          sku: `${sku}-CARTON`,
          barcode: bulkBarcode || `480${Date.now().toString().slice(-9)}`,
          name: bulkCartonName.trim() || `${name} (Master Carton)`,
          unit_type: 'carton',
          units_per_bulk: bulkUnits,
          price: bulkPriceMinor,
          cost_price: bulkCostMinor,
          initial_stock: bulkStock
        });

        // 2. Create Single Unit (Tingi Sachet) with bulk_parent_id
        await registerProduct({
          sku: `${sku}-UNIT`,
          barcode: barcode || `480${(Date.now() + 1).toString().slice(-9)}`,
          name: name.trim(),
          unit_type: unitType,
          units_per_bulk: 1,
          bulk_parent_id: parentProduct.id,
          price: priceMinor,
          cost_price: costMinor > 0 ? costMinor : Math.round(bulkCostMinor / bulkUnits),
          initial_stock: stockQty
        });
      } else {
        // Standard Single Product Creation
        await registerProduct({
          sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
          barcode: barcode.trim() || `480${Date.now().toString().slice(-9)}`,
          name: name.trim(),
          unit_type: unitType,
          units_per_bulk: 1,
          price: priceMinor,
          cost_price: costMinor,
          initial_stock: stockQty
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-content-enter"
        style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-product-title"
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--tint-primary-10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)'
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 id="register-product-title" style={{ fontSize: '18px', fontWeight: 600 }}>
                Register New Goods / Paninda
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Add new items to the master catalog. Propagates automatically to all edge POS terminals.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--tint-red-10)',
              border: '1px solid rgba(166, 64, 46, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-accent-red)',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Quick Category Chips */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Quick Category Preset (Piliin ang Kategorya)</span>
            </label>
            <div className="category-chip-grid">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${selectedCategory === cat.id ? 'category-chip-active' : ''}`}
                  onClick={() => handleSelectPreset(cat)}
                >
                  <span className="category-chip-icon">{cat.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{cat.name}</div>
                    <div style={{ fontSize: '11px', opacity: 0.75 }}>{cat.nameTagalog}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Product Name */}
          <div className="form-group">
            <label className="form-label">
              Product Name <span style={{ color: 'var(--color-accent-red)' }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Instant Coffee (Single Sachet)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Barcode & SKU Row with 1-Click Generator */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label">Barcode / EAN</label>
                <button
                  type="button"
                  onClick={handleGenerateBarcodeAndSku}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '11px', gap: '4px' }}
                >
                  <Sparkles size={11} color="var(--color-accent-amber)" /> Auto-Gen
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Barcode size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '32px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                  placeholder="Scan or type barcode..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '4px', display: 'block' }}>SKU Code</label>
              <input
                type="text"
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                placeholder="e.g. COF-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Pricing & Stock Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '10px',
              backgroundColor: 'var(--bg-app)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px'
            }}
          >
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>
                Unit Type
              </label>
              <select
                className="select-field"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '13px' }}
              >
                <option value="piece">Piece (Pcs / Piraso)</option>
                <option value="kg">Kilogram (kg / Kilo)</option>
                <option value="pack">Pack / Balot</option>
                <option value="box">Box / Kahon</option>
                <option value="liter">Liter / Litro</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>
                Cost Price (Puhunan)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                className="input-field"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>
                Retail Price (Presyo)
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                className="input-field"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '13px', borderColor: 'var(--color-primary)', fontWeight: 600 }}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>
                Initial Stock (Dami)
              </label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '13px' }}
                placeholder="0"
              />
            </div>
          </div>

          {/* Unit Profit Live Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: unitProfit >= 0 ? 'var(--tint-green-10)' : 'var(--tint-red-10)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              marginBottom: '16px'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
              <TrendingUp size={14} color={unitProfit >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-red)'} />
              Estimated Profit Margin per {unitType}:
            </span>
            <strong>
              ₱{unitProfit.toFixed(2)} ({unitMarginPct}%)
            </strong>
          </div>

          {/* Bulk-to-Tingi Toggle (Repack/Wholesale Feature) */}
          <div
            style={{
              padding: '12px',
              border: '1px dashed var(--border-focus)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isBulkTingiMode ? 'var(--tint-primary-5)' : 'transparent',
              marginBottom: '18px',
              transition: 'background-color var(--transition-fast)'
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--text-main)'
              }}
            >
              <input
                type="checkbox"
                checked={isBulkTingiMode}
                onChange={(e) => setIsBulkTingiMode(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
              />
              <span>📦 Register as Wholesale Master Box + Single Piece (*Tingi*)</span>
            </label>

            {isBulkTingiMode && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  This will register a <strong>Master Carton</strong> parent and link this <strong>Single Sachet</strong> as its child.
                  Cashiers can break cartons into pieces at the register.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Carton Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={bulkCartonName}
                      onChange={(e) => setBulkCartonName(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Pieces per Box</label>
                    <input
                      type="number"
                      min="2"
                      className="input-field"
                      value={bulkUnitsPerCarton}
                      onChange={(e) => setBulkUnitsPerCarton(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Cartons in Stock</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={bulkInitialStock}
                      onChange={(e) => setBulkInitialStock(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Carton Wholesale Cost (Puhunan)</label>
                    <input
                      type="number"
                      step="1"
                      className="input-field"
                      value={bulkCostPrice}
                      onChange={(e) => setBulkCostPrice(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Carton Retail Price (If sold whole)</label>
                    <input
                      type="number"
                      step="1"
                      className="input-field"
                      value={bulkRetailPrice}
                      onChange={(e) => setBulkRetailPrice(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '10px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--tint-primary-10)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '11px',
                    color: 'var(--color-primary)'
                  }}
                >
                  💡 Selling 1 box ({bulkUnits} pcs @ ₱{unitSell.toFixed(2)}) yields <strong>₱{tingiTotalRevenue.toFixed(2)}</strong> gross revenue (Gross profit: <strong>+₱{tingiGrossProfit.toFixed(2)} / +{tingiMarginPct}%</strong>).
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Registering...' : 'Complete Registration (Itala)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
