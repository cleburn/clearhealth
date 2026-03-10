/**
 * ClearHealth API — Audit Logging Middleware
 *
 * Logs every API request to the AuditLog table for HIPAA compliance.
 * Captures userId, action, resource, IP address, and timestamp.
 *
 * @security
 * HIPAA requires access logging for all patient data.
 * This middleware MUST be applied to all patient-related routes.
 * Audit logs are append-only and cannot be modified or deleted
 * through the application (only via direct database access by SUPER_ADMIN).
 */

import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Maps HTTP methods to audit action names.
 */
const METHOD_TO_ACTION: Record<string, string> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** UUID v4 pattern for extracting resource IDs from paths */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Extracts the resource name from the request path.
 * e.g., /api/v1/patients/123 -> "patient"
 */
function extractResource(path: string): string {
  // Strip /api/v1/ prefix
  const stripped = path.replace(/^\/api\/v1\//, '');
  const segments = stripped.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'unknown';
  }

  // Get the resource name (first segment), singularize
  const resource = segments[0].replace(/s$/, '');

  // Handle nested resources (e.g., /patients/:id/history -> "patient_history")
  const subResources: string[] = [];
  for (let i = 1; i < segments.length; i++) {
    // Skip UUID segments
    if (!UUID_PATTERN.test(segments[i])) {
      subResources.push(segments[i]);
    }
  }

  if (subResources.length > 0) {
    return `${resource}_${subResources.join('_')}`;
  }

  return resource;
}

/**
 * Extracts the resource ID from the request path, if present.
 */
function extractResourceId(path: string): string | null {
  const match = path.match(UUID_PATTERN);
  return match ? match[0] : null;
}

/**
 * Audit logging middleware.
 * Records every request to patient-related routes in the AuditLog table.
 *
 * HIPAA requires access logging for all patient data. This middleware
 * MUST be applied to all patient-related routes.
 */
export function auditMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.user || !req.tenantId) {
    next();
    return;
  }

  const action = METHOD_TO_ACTION[req.method] || req.method;
  const resource = extractResource(req.path);
  const resourceId = extractResourceId(req.path);
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  // Write audit log asynchronously — do not block the response
  prisma.auditLog
    .create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.userId,
        action,
        resource,
        resourceId,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
        },
        ipAddress,
      },
    })
    .catch((err: Error) => {
      logger.error('Failed to write audit log', {
        error: err.message,
        userId: req.user?.userId,
        resource,
        action,
      });
    });

  next();
}
