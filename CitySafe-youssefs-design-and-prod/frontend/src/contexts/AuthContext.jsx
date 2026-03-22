import { createContext, useContext, useState, useEffect, useCallback } from "react";
import client from "../lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: verify session against server via the HTTPOnly cookie
  useEffect(() => {
    client.get("/auth/me")
      .then((res) => {
        const data = res.data ?? res;
        setUser({ userId: data.userId, role: data.role, displayName: data.displayName });
      })
      .catch(() => {
        // Cookie is missing or invalid — user is not logged in
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (userId, password) => {
    const res = await client.post("/auth/login", { userId, password });
    const { userId: uid, role, displayName } = res.data ?? res;
    setUser({ userId: uid, role, displayName });
    return res.data ?? res;
  }, []);

  const register = useCallback(async (userId, password, displayName) => {
    const res = await client.post("/auth/register", { userId, password, displayName });
    const { userId: uid, role, displayName: dName } = res.data ?? res;
    setUser({ userId: uid, role, displayName: dName });
    return res.data ?? res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await client.post("/auth/logout");
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
