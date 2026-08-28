import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  api,
  StoreDeviceStatus,
  CatalogProduct,
  AnomalyItem,
  CreditCustomer,
  AuditEntry,
  AuditVerification
} from '../api/client.js';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';

interface DashboardDataContextType {
  storeInfo: { id: string; name: string; currency: string; region: string } | null;
  devices: StoreDeviceStatus[];
  products: CatalogProduct[];
  anomalies: AnomalyItem[];
  customers: CreditCustomer[];
  auditLogs: AuditEntry[];
  auditVerification: AuditVerification | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  registerProduct: (productData: {
    sku: string;
    barcode: string;
    name: string;
    description?: string;
    unit_type: string;
    units_per_bulk: number;
    bulk_parent_id?: string | null;
    price: number;
    cost_price: number;
    initial_stock: number;
  }) => Promise<CatalogProduct>;
  updateProductPrice: (productId: string, newPriceMinor: number) => Promise<void>;
  writeOffDamage: (productId: string, quantity: number, reason: string) => Promise<void>;
  registerCustomer: (name: string, phone: string, creditLimitMinor: number) => Promise<void>;
  reconcileAnomaly: (anomalyId: string, adjustedQty: number, notes: string) => Promise<void>;
  revokeTerminal: (deviceId: string, reason?: string) => Promise<void>;
  setProducts: React.Dispatch<React.SetStateAction<CatalogProduct[]>>;
}

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [storeInfo, setStoreInfo] = useState<{ id: string; name: string; currency: string; region: string } | null>(null);
  const [devices, setDevices] = useState<StoreDeviceStatus[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<AuditVerification | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [pricingData, anomaliesData, customersData, auditData] = await Promise.all([
        api.getPricing(),
        api.getAnomalies(),
        api.getCustomers(),
        api.getAuditLog()
      ]);

      setProducts(pricingData.products);
      setAnomalies(anomaliesData.anomalies);
      setCustomers(customersData.customers);
      setAuditLogs(auditData.logs);
      setAuditVerification(auditData.verification);

      if (pricingData.products.length > 0) {
        const storeId = (pricingData.products[0] as any).store_id;
        if (storeId) {
          const storeRes = await api.getStoreStatus(storeId);
          setStoreInfo(storeRes.store);
          setDevices(storeRes.devices);
        }
      }
    } catch (err: any) {
      const safeMessage = err.message || 'Failed to synchronize dashboard state with server.';
      setError(safeMessage);
      toast.error('Sync Error', safeMessage);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, toast]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    } else {
      setStoreInfo(null);
      setDevices([]);
      setProducts([]);
      setAnomalies([]);
      setCustomers([]);
      setAuditLogs([]);
      setAuditVerification(null);
    }
  }, [isAuthenticated, refreshData]);

  const registerProduct = async (productData: {
    sku: string;
    barcode: string;
    name: string;
    description?: string;
    unit_type: string;
    units_per_bulk: number;
    bulk_parent_id?: string | null;
    price: number;
    cost_price: number;
    initial_stock: number;
  }): Promise<CatalogProduct> => {
    const t0 = performance.now();
    try {
      const res = await api.createProduct(productData);
      const latency = Math.round(performance.now() - t0);
      toast.success('Product Registered', `${productData.name} registered into master catalog and queued for edge POS sync.`, latency);
      await refreshData();
      return res.product;
    } catch (err: any) {
      toast.error('Registration Error', err.message || 'Could not register new product.');
      throw err;
    }
  };

  const updateProductPrice = async (productId: string, newPriceMinor: number) => {
    const t0 = performance.now();
    try {
      await api.updatePrice(productId, newPriceMinor);
      const latency = Math.round(performance.now() - t0);
      toast.success('Price Updated', 'Price change queued for next terminal delta sync.', latency);
      await refreshData();
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Could not queue price update.');
      throw err;
    }
  };

  const writeOffDamage = async (productId: string, quantity: number, reason: string) => {
    const t0 = performance.now();
    try {
      await api.recordDamageWriteOff(productId, quantity, reason);
      const latency = Math.round(performance.now() - t0);
      toast.warning('Damaged Stock Recorded', `Write-off of ${quantity} units recorded in immutable audit log.`, latency);
      await refreshData();
    } catch (err: any) {
      toast.error('Write-Off Error', err.message || 'Could not record damage write-off.');
      throw err;
    }
  };

  const registerCustomer = async (name: string, phone: string, creditLimitMinor: number) => {
    const t0 = performance.now();
    try {
      await api.createCustomer(name, phone, creditLimitMinor);
      const latency = Math.round(performance.now() - t0);
      toast.success('Credit Account Registered', `Customer ${name} approved for Bukas-Bayad credit.`, latency);
      await refreshData();
    } catch (err: any) {
      toast.error('Registration Failed', err.message || 'Could not register customer credit account.');
      throw err;
    }
  };

  const reconcileAnomaly = async (anomalyId: string, adjustedQty: number, notes: string) => {
    const t0 = performance.now();
    try {
      await api.resolveAnomaly(anomalyId, 'adjust_inventory', adjustedQty, notes);
      const latency = Math.round(performance.now() - t0);
      toast.success('Conflict Reconciled', 'Stock discrepancy resolved and true inventory committed.', latency);
      await refreshData();
    } catch (err: any) {
      toast.error('Reconciliation Error', err.message || 'Could not reconcile inventory anomaly.');
      throw err;
    }
  };

  const revokeTerminal = async (deviceId: string, reason: string = 'Manager manual revocation') => {
    const t0 = performance.now();
    try {
      await api.revokeDevice(deviceId, reason);
      const latency = Math.round(performance.now() - t0);
      toast.warning('Terminal Revoked', 'Cashier device cryptographic certificate revoked. Cloud access blocked.', latency);
      await refreshData();
    } catch (err: any) {
      toast.error('Revocation Error', err.message || 'Could not revoke terminal certificate.');
      throw err;
    }
  };

  return (
    <DashboardDataContext.Provider
      value={{
        storeInfo,
        devices,
        products,
        anomalies,
        customers,
        auditLogs,
        auditVerification,
        loading,
        error,
        refreshData,
        registerProduct,
        updateProductPrice,
        writeOffDamage,
        registerCustomer,
        reconcileAnomaly,
        revokeTerminal,
        setProducts
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within a DashboardDataProvider');
  }
  return context;
}
