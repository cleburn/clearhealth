/**
 * ClearHealth Web — Authentication Hook
 *
 * React hook for managing authentication state, token refresh,
 * and role-based access control in the frontend.
 *
 * @security
 * - JWT access tokens stored in memory only (not localStorage)
 * - Refresh tokens stored in httpOnly cookie (set by API)
 * - Auto-refresh before token expiry
 * - Logout clears all tokens and redirects to login
 */

'use client';

import { useState, useCallback } from 'react';
import type { User, LoginRequest } from '@clearhealth/shared/types/auth';
import { UserRole } from '@clearhealth/shared/constants/roles';

/** Auth state returned by the useAuth hook */
interface AuthState {
  /** Current authenticated user, or null if not logged in */
  user: User | null;
  /** Whether auth state is still being determined */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Log in with email and password */
  login: (credentials: LoginRequest) => Promise<void>;
  /** Log out and clear all tokens */
  logout: () => Promise<void>;
  /** Manually refresh the access token */
  refreshToken: () => Promise<void>;
  /** Check if the current user has the DOCTOR role */
  isDoctor: () => boolean;
  /** Check if the current user has the ADMIN role */
  isAdmin: () => boolean;
  /** Check if the current user has the PATIENT role */
  isPatient: () => boolean;
  /** Check if the current user has the SUPER_ADMIN role */
  isSuperAdmin: () => boolean;
}

/**
 * Authentication hook for managing user sessions.
 *
 * @returns Auth state and methods for login, logout, and role checking
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout, isDoctor } = useAuth();
 * ```
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // TODO: implement
  // - On mount: check for existing session (attempt token refresh)
  // - Set up auto-refresh timer (refresh 1 minute before expiry)
  // - Handle 401 responses globally (redirect to login)

  const login = useCallback(async (_credentials: LoginRequest): Promise<void> => {
    // TODO: implement
    // - POST to /api/v1/auth/login
    // - Store access token in memory
    // - Set user state from response
    // - Redirect to /dashboard
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // TODO: implement
    // - POST to /api/v1/auth/logout
    // - Clear access token from memory
    // - Clear user state
    // - Redirect to /login
  }, []);

  const refreshToken = useCallback(async (): Promise<void> => {
    // TODO: implement
    // - POST to /api/v1/auth/refresh
    // - Update access token in memory
    // - Update user state if needed
  }, []);

  const isDoctor = useCallback(() => user?.role === UserRole.DOCTOR, [user]);
  const isAdmin = useCallback(() => user?.role === UserRole.ADMIN, [user]);
  const isPatient = useCallback(() => user?.role === UserRole.PATIENT, [user]);
  const isSuperAdmin = useCallback(() => user?.role === UserRole.SUPER_ADMIN, [user]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
    isDoctor,
    isAdmin,
    isPatient,
    isSuperAdmin,
  };
}
