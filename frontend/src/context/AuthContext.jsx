import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";

const AuthContext = createContext(null);
const ACCESS_TOKEN_KEY = "shortly.accessToken";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(ACCESS_TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    function handleExpiredSession() {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      setToken(null);
      setUser(null);
    }

    window.addEventListener("shortly:auth-expired", handleExpiredSession);
    return () => window.removeEventListener("shortly:auth-expired", handleExpiredSession);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    api.get("/auth/me", { signal: controller.signal })
      .then(({ data }) => {
        if (active) {
          setUser(data.user);
        }
      })
      .catch((error) => {
        if (active && error.code !== "ERR_CANCELED") {
          sessionStorage.removeItem(ACCESS_TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token]);

  async function authenticate(action, credentials) {
    const { data } = await api.post(`/auth/${action}`, credentials);
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function signOut() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: (credentials) => authenticate("login", credentials),
      register: (credentials) => authenticate("register", credentials),
      signOut
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
