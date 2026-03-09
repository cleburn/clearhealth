/**
 * ClearHealth — Authentication Type Definitions
 *
 * Defines user authentication types, JWT payloads, and auth request/response shapes.
 *
 * @security JWT tokens contain userId, tenantId, and role — no PII.
 * Refresh tokens are stored in Redis and rotated on each use.
 * Password hashes use bcrypt and are never exposed in API responses.
 */

import { UserRole } from '../constants/roles';

/** User record (safe subset — no passwordHash) */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
}

/** JWT access token payload */
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  /** Token expiration (Unix timestamp) */
  exp: number;
  /** Token issued at (Unix timestamp) */
  iat: number;
}

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Successful login response */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

/** Refresh token request body */
export interface RefreshRequest {
  refreshToken: string;
}

/** Refresh token response */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Password reset request */
export interface ForgotPasswordRequest {
  email: string;
}

/** Password reset completion */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
