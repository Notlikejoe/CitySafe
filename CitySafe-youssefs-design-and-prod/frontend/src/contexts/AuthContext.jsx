import { createContext, useContext, useState, useEffect, useCallback } from "react";
import client from "../lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: decode token from localStorage and set user
  useEffect(() => {
    const token = localStorage.getItem("cs_token");
    if (token) {
      try {
        // JWT payload is base64url encoded in the second segment
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser({ userId: payload.userId, role: payload.role });
      } catch {
        localStorage.removeItem("cs_token");
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (userId, password) => {
    const res = await client.post("/auth/login", { userId, password });
    const token = res.data?.token ?? res.token;
    localStorage.setItem("cs_token", token);
    const payload = JSON.parse(atob(token.split(".")[1]));
    setUser({ userId: payload.userId, role: payload.role });
    return res.data;
  }, []);

  const register = useCallback(async (userId, password, displayName) => {
    const res = await client.post("/auth/register", { userId, password, displayName });
    const token = res.data?.token ?? res.token;
    if (token) {
      localStorage.setItem("cs_token", token);
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser({ userId: payload.userId, role: payload.role });
    }
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("cs_token");
    setUser(null);
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
