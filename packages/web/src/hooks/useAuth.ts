/**
 * ClearHealth Web — Authentication Hook
 *
 * Re-exports the useAuth hook from the AuthProvider context.
 * This file exists as a convenience import path.
 *
 * @security
 * - JWT access tokens stored in memory only (not localStorage)
 * - Refresh tokens stored in httpOnly cookie (set by API)
 * - Auto-refresh before token expiry
 * - Logout clears all tokens and redirects to login
 */

'use client';

export { useAuth } from '@/components/providers/auth-provider';
