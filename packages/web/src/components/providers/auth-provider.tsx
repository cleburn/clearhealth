/**
 * ClearHealth Web — Auth Context Provider
 *
 * Provides authentication state to all client components via React context.
 * Wraps the useAuth hook logic so all components share the same auth state.
 *
 * @security
 * - Access token stored in memory only (never localStorage/sessionStorage)
 * - Refresh token managed via httpOnly cookie by the API
 * - Auto-refresh timer set 1 minute before JWT expiry
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { User, LoginRequest } from "@clearhealth/shared/types/auth";
import { UserRole } from "@clearhealth/shared/constants/roles";
import { authApi, setAccessToken } from "@/lib/api-client";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isDoctor: () => boolean;
  isAdmin: () => boolean;
  isPatient: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Parse a JWT to extract the payload (without verification — verification is server-side).
 * Used only to read the expiry time for auto-refresh scheduling.
 */
function parseJwtExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Schedule auto-refresh 60 seconds before token expiry */
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    const exp = parseJwtExpiry(token);
    if (!exp) return;

    const now = Math.floor(Date.now() / 1000);
    const refreshIn = Math.max((exp - now - 60) * 1000, 0);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const response = await authApi.refresh();
        setAccessToken(response.accessToken);
        scheduleRefresh(response.accessToken);
      } catch {
        // Refresh failed — session expired
        setUser(null);
        setAccessToken(null);
      }
    }, refreshIn);
  }, []);

  const refreshTokenFn = useCallback(async (): Promise<void> => {
    try {
      const response = await authApi.refresh();
      setAccessToken(response.accessToken);
      scheduleRefresh(response.accessToken);
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, [scheduleRefresh]);

  // On mount: attempt to restore session via refresh token (httpOnly cookie)
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const response = await authApi.refresh();
        if (cancelled) return;
        setAccessToken(response.accessToken);
        scheduleRefresh(response.accessToken);
        // We need user info — decode from token or make a separate call.
        // The refresh response doesn't include user, so we parse from JWT payload.
        const parts = response.accessToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          // Set minimal user from JWT — full user data comes from API calls
          setUser({
            id: payload.userId,
            tenantId: payload.tenantId,
            email: "",
            role: payload.role as UserRole,
            firstName: "",
            lastName: "",
            phone: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
            isActive: true,
          });
        }
      } catch {
        // No valid session — user needs to log in
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(
    async (credentials: LoginRequest): Promise<void> => {
      const response = await authApi.login(credentials);
      setAccessToken(response.accessToken);
      setUser(response.user);
      scheduleRefresh(response.accessToken);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Logout API may fail if token expired — clear local state anyway
    }
    setAccessToken(null);
    setUser(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    window.location.href = "/";
  }, []);

  const isDoctor = useCallback(() => user?.role === UserRole.DOCTOR, [user]);
  const isAdmin = useCallback(
    () => user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN,
    [user],
  );
  const isPatient = useCallback(() => user?.role === UserRole.PATIENT, [user]);
  const isSuperAdmin = useCallback(
    () => user?.role === UserRole.SUPER_ADMIN,
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken: refreshTokenFn,
        isDoctor,
        isAdmin,
        isPatient,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
