import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client.js';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;
  managerEmail: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [managerEmail, setManagerEmail] = useState<string>('manager@aegisretail.local');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const existingToken = api.getToken();
    if (!existingToken) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      // Validate token with a lightweight call
      await api.getPricing();
      setIsAuthenticated(true);
      setToken(existingToken);
    } catch {
      api.setToken(null);
      setToken(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email.trim(), password);
      setToken(data.access_token);
      setManagerEmail(email.trim());
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
      setIsAuthenticated(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setToken(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        loading,
        error,
        managerEmail,
        login,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
