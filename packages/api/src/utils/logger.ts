/**
 * ClearHealth API — Structured Logger
 *
 * Winston-based logger configured for JSON output in production
 * and pretty-printed output in development. Includes built-in PII
 * redaction to prevent sensitive data from appearing in log output.
 *
 * @security
 * NEVER log patient names, SSNs, DOBs, or insurance IDs.
 * Use patient.id for correlation. PII redaction runs automatically
 * on all log output as a safety net.
 */

// NEVER log patient names, SSNs, DOBs, or insurance IDs. Use patient.id for correlation.

import winston from "winston";

/** PII patterns to redact from log output */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN-REDACTED]" },
  { pattern: /\b\d{9}\b/g, replacement: "[SSN-REDACTED]" },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL-REDACTED]",
  },
  {
    pattern: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g,
    replacement: "[DATETIME-REDACTED]",
  },
];

/**
 * Redacts PII patterns from a string.
 * Applied automatically to all log messages and metadata.
 */
function redactPII(message: string): string {
  let result = message;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(
      new RegExp(pattern.source, pattern.flags),
      replacement,
    );
  }
  return result;
}

/**
 * Recursively redact PII from log metadata objects.
 */
function redactObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return redactPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = redactObject(value);
    }
    return result;
  }
  return obj;
}

/** Log levels supported by the logger */
type _LogLevel = "error" | "warn" | "info" | "debug" | "audit";

/** Logger interface for the application */
interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  /** Audit-level log for HIPAA compliance entries */
  audit(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Creates a structured logger instance.
 * In production: JSON format for log aggregation (CloudWatch, Datadog, etc.)
 * In development: Pretty-printed output with colors
 *
 * @returns Configured logger instance
 */
function createLogger(): Logger {
  const isProduction = process.env.NODE_ENV === "production";
  const logLevel = process.env.LOG_LEVEL || "info";

  const customLevels = {
    levels: {
      error: 0,
      warn: 1,
      audit: 2,
      info: 3,
      debug: 4,
    },
    colors: {
      error: "red",
      warn: "yellow",
      audit: "magenta",
      info: "green",
      debug: "blue",
    },
  };

  winston.addColors(customLevels.colors);

  const piiRedactionFormat = winston.format((info) => {
    info.message = redactPII(String(info.message));
    // Redact all other fields
    for (const key of Object.keys(info)) {
      if (key !== "level" && key !== "message" && key !== "timestamp") {
        info[key] = redactObject(info[key]);
      }
    }
    return info;
  });

  const formats = [winston.format.timestamp(), piiRedactionFormat()];

  if (isProduction) {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr =
          Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
        return `${String(timestamp)} [${level}]: ${String(message)}${metaStr}`;
      }),
    );
  }

  const transports: winston.transport[] = [new winston.transports.Console()];

  if (isProduction) {
    transports.push(
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
      }),
      new winston.transports.File({
        filename: "logs/audit.log",
        level: "audit",
      }),
      new winston.transports.File({ filename: "logs/combined.log" }),
    );
  }

  const winstonLogger = winston.createLogger({
    levels: customLevels.levels,
    level: logLevel,
    format: winston.format.combine(...formats),
    transports,
  });

  return {
    error: (message: string, meta?: Record<string, unknown>) =>
      winstonLogger.error(message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      winstonLogger.warn(message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      winstonLogger.info(message, meta),
    debug: (message: string, meta?: Record<string, unknown>) =>
      winstonLogger.debug(message, meta),
    audit: (message: string, meta?: Record<string, unknown>) =>
      winstonLogger.log("audit", message, meta),
  };
}

/** Singleton logger instance for the application */
export const logger = createLogger();
