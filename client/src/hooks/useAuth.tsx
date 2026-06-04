import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user: u } = await api.auth.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  // Apply theme from user preferences
  useEffect(() => {
    if (!user) return;
    const root = document.documentElement;
    if (user.themeColor) root.style.setProperty('--accent', user.themeColor);
    if (user.themeMode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [user?.themeColor, user?.themeMode]);

  const login = async (email: string, password: string) => {
    const { user: u } = await api.auth.login(email, password);
    setUser(u);
  };

  const register = async (email: string, username: string, password: string) => {
    const { user: u } = await api.auth.register(email, username, password);
    setUser(u);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...patch } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
