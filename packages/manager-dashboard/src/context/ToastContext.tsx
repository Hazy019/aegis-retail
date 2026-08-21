import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ToastType = 'success' | 'warning' | 'error' | 'sync';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  latencyMs?: number;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (title: string, message: string, latencyMs?: number) => void;
    warning: (title: string, message: string, latencyMs?: number) => void;
    error: (title: string, message: string, latencyMs?: number) => void;
    sync: (title: string, message: string, latencyMs?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (toastData: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = toastData.duration || (toastData.type === 'error' ? 6000 : 4000);
    const newToast: Toast = { ...toastData, id };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  };

  const toast = {
    success: (title: string, message: string, latencyMs?: number) =>
      addToast({ type: 'success', title, message, latencyMs }),
    warning: (title: string, message: string, latencyMs?: number) =>
      addToast({ type: 'warning', title, message, latencyMs }),
    error: (title: string, message: string, latencyMs?: number) =>
      addToast({ type: 'error', title, message, latencyMs }),
    sync: (title: string, message: string, latencyMs?: number) =>
      addToast({ type: 'sync', title, message, latencyMs })
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
