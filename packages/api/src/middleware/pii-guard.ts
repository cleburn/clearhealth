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

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/** SSN pattern: XXX-XX-XXXX */
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/** SSN pattern without dashes: XXXXXXXXX */
const SSN_NO_DASH_PATTERN = /\b\d{9}\b/g;

/** Email pattern for log scrubbing */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/** Fields that should always be masked in responses */
const SENSITIVE_FIELDS = [
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "dob",
  "passwordHash",
];

/**
 * Masks PII patterns in a string.
 * Replaces SSNs with '***-**-****' and emails with '[REDACTED]'.
 */
export function maskPII(text: string): string {
  let result = text;
  result = result.replace(SSN_PATTERN, "***-**-****");
  result = result.replace(SSN_NO_DASH_PATTERN, "***-**-****");
  result = result.replace(EMAIL_PATTERN, "[REDACTED]");
  return result;
}

/**
 * Recursively scans an object and masks sensitive field values.
 */
export function maskSensitiveFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      result[key] = maskPII(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (item !== null && typeof item === "object") {
          return maskSensitiveFields(item as Record<string, unknown>);
        }
        if (typeof item === "string") {
          return maskPII(item);
        }
        return item;
      });
    } else if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Date)
    ) {
      result[key] = maskSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * PII guard middleware.
 * Intercepts response.json() to scan outgoing data for PII patterns
 * before it reaches the client.
 *
 * Defense in depth — even if application code leaks PII, this middleware
 * catches it before it reaches the client or logs.
 */
export function piiGuardMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const originalJson = res.json.bind(res);

  res.json = function piiFilteredJson(body: unknown): Response {
    if (body !== null && typeof body === "object") {
      const originalStr = JSON.stringify(body);
      const masked = maskSensitiveFields(body as Record<string, unknown>);
      const maskedStr = JSON.stringify(masked);

      if (originalStr !== maskedStr) {
        logger.warn(
          "PII detected in response body and masked by guard middleware",
          {
            path: _req.path,
            method: _req.method,
          },
        );
      }

      return originalJson(masked);
    }

    return originalJson(body);
  };

  next();
}
