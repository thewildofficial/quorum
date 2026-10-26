import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/api/auth/login', { email, password });
    setUser(d.user);
  }, []);
  const register = useCallback(async (email, password, displayName) => {
    const d = await api.post('/api/auth/register', { email, password, displayName });
    setUser(d.user);
  }, []);
  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
