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

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "@clearhealth/shared/types/auth";
import type { UserRole } from "@clearhealth/shared/constants/roles";
import { logger } from "../utils/logger";

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
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }

  const token = authHeader.substring(7);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error("JWT_SECRET not configured");
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    req.user = decoded;
    req.tenantId = decoded.tenantId;

    next();
  } catch (err) {
    const errorMessage =
      err instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token";

    logger.warn("Authentication failed", {
      reason: errorMessage,
      ip: req.ip,
      path: req.path,
    });

    res.status(401).json({ error: errorMessage, code: "AUTH_FAILED" });
  }
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
export function requireRole(
  ...roles: (UserRole | string)[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res
        .status(401)
        .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Unauthorized access attempt", {
        userId: req.user.userId,
        requiredRoles: roles,
        userRole: req.user.role,
        path: req.path,
        method: req.method,
      });

      res
        .status(403)
        .json({ error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }

    next();
  };
}
