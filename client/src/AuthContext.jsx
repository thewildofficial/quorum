import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [allowedDomain, setAllowedDomain] = useState('sst.scaler.com');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((d) => { setUser(d.user); if (d.allowedDomain) setAllowedDomain(d.allowedDomain); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, logout, allowedDomain }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
