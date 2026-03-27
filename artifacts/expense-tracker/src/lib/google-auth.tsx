import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextValue {
  user: GoogleUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  hasGoogleConfig: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "smarttrack_google_user";
const TOKEN_KEY = "smarttrack_google_token";
const TOKEN_EXPIRY_KEY = "smarttrack_google_token_expiry";

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && expiry && Date.now() < parseInt(expiry)) return token;
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { setIsLoading(false); }, []);

  const handleSuccess = useCallback(async (tokenResponse: { access_token: string; expires_in: number }) => {
    const token = tokenResponse.access_token;
    const expiryMs = Date.now() + tokenResponse.expires_in * 1000;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryMs));
    setAccessToken(token);

    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const info = await res.json() as { id: string; email: string; name: string; picture: string };
      const u: GoogleUser = { id: info.id, email: info.email, name: info.name, picture: info.picture };
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch (e) {
      console.error("Failed to fetch user info", e);
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: handleSuccess,
    scope: "email profile https://www.googleapis.com/auth/gmail.readonly",
    flow: "implicit",
    onError: (err) => console.error("Google login error", err),
  });

  const logout = useCallback(() => {
    try { googleLogout(); } catch {}
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, isAuthenticated: !!user, login, logout, hasGoogleConfig: !!GOOGLE_CLIENT_ID }}>
      {children}
    </AuthContext.Provider>
  );
}

function NoOpAuthProvider({ children }: { children: React.ReactNode }) {
  const value: AuthContextValue = {
    user: null, accessToken: null, isLoading: false, isAuthenticated: false,
    login: () => alert("Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in."),
    logout: () => {},
    hasGoogleConfig: false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  if (!GOOGLE_CLIENT_ID) {
    return <NoOpAuthProvider>{children}</NoOpAuthProvider>;
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </GoogleOAuthProvider>
  );
}

export function useGoogleAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useGoogleAuth must be used within GoogleAuthProvider");
  return ctx;
}
