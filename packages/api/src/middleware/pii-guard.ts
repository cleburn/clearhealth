/**
 * ClearHealth API — PII Guard Middleware
 *
 * Defense in depth — even if application code leaks PII, this middleware
 * catches it before it reaches the client or logs.
 *
 * Scans outgoing responses and log output for PII patterns (SSN, DOB,
 * insurance IDs) and masks them before transmission.
 *
 * @security This is a safety net, not a primary control. Application code
 * should still handle PII correctly. This middleware catches mistakes.
 */

import { Request, Response, NextFunction } from 'express';

/** SSN pattern: XXX-XX-XXXX */
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/** SSN pattern without dashes: XXXXXXXXX */
const SSN_NO_DASH_PATTERN = /\b\d{9}\b/g;

/** Email pattern for log scrubbing */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/** Fields that should always be masked in responses */
const SENSITIVE_FIELDS = ['ssn', 'socialSecurityNumber', 'dateOfBirth', 'dob', 'passwordHash'];

/**
 * Masks PII patterns in a string.
 * Replaces SSNs with '***-**-****' and emails with '[REDACTED]'.
 */
export function maskPII(text: string): string {
  // TODO: implement
  // - Replace SSN patterns (with and without dashes)
  // - Replace email addresses in log context (not in response bodies)
  // - Return masked string
  return text;
}

/**
 * Recursively scans an object and masks sensitive field values.
 */
export function maskSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  // TODO: implement
  // - Walk object tree recursively
  // - For keys matching SENSITIVE_FIELDS, replace value with '[REDACTED]'
  // - For string values, run through maskPII()
  // - Return new object (don't mutate original)
  return obj;
}

/**
 * PII guard middleware.
 * Intercepts response.json() to scan outgoing data for PII patterns
 * before it reaches the client.
 *
 * Defense in depth — even if application code leaks PII, this middleware
 * catches it before it reaches the client or logs.
 */
export function piiGuardMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // TODO: implement
  // - Override res.json() to intercept response body
  // - Scan response body for PII patterns
  // - Mask any detected PII
  // - Log a warning if PII was found (potential application code issue)
  // - Call original res.json() with sanitized data
  next();
}
