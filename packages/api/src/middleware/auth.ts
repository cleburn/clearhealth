/**
 * ClearHealth API — Authentication Middleware
 *
 * JWT verification middleware that protects API routes.
 * Extracts and validates the JWT from the Authorization header,
 * then attaches the decoded user and tenant context to the request.
 *
 * @security
 * - Tokens are verified against JWT_SECRET from environment
 * - Expired tokens return 401 (client should use refresh endpoint)
 * - Invalid tokens are logged to audit trail as potential security events
 * - Role-based guards restrict access to specific endpoints
 */

import { Request, Response, NextFunction } from 'express';
import type { JWTPayload } from '@clearhealth/shared/types/auth';
import type { UserRole } from '@clearhealth/shared/constants/roles';

/** Extended Express Request with authenticated user context */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  tenantId?: string;
}

/**
 * JWT verification middleware.
 * Extracts token from Authorization header, verifies it, and attaches
 * the decoded payload to the request object.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // TODO: implement
  // - Extract token from 'Authorization: Bearer <token>' header
  // - Verify token using jsonwebtoken and JWT_SECRET env var
  // - Check token is not expired
  // - Attach decoded payload (userId, tenantId, role) to req.user
  // - Set req.tenantId for tenant-scoped queries
  // - On failure: return 401 with generic error (don't leak token details)
  next();
}

/**
 * Role-based access control middleware factory.
 * Returns middleware that checks if the authenticated user has one of
 * the required roles.
 *
 * @param roles - One or more UserRole values that are allowed access
 * @returns Express middleware function
 *
 * @example
 * router.get('/admin-only', requireRole('ADMIN', 'SUPER_ADMIN'), handler);
 */
export function requireRole(...roles: (UserRole | string)[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // TODO: implement
    // - Check req.user exists (auth middleware must run first)
    // - Check req.user.role is in the allowed roles list
    // - On failure: return 403 Forbidden
    // - Log unauthorized access attempts to audit trail
    next();
  };
}
