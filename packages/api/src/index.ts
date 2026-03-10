/**
 * ClearHealth API — Express Application Entry Point
 *
 * Configures and starts the Express server with all middleware, routes,
 * and error handling. This is the main entry point for the API service.
 *
 * @security
 * - CORS restricted to configured origins
 * - Helmet sets security headers
 * - Auth middleware validates JWT on protected routes
 * - Audit middleware logs all patient data access
 * - PII guard scrubs sensitive data from responses and error output
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { piiGuardMiddleware } from './middleware/pii-guard';
import { patientRoutes } from './routes/patients';
import { appointmentRoutes } from './routes/appointments';
import { billingRoutes } from './routes/billing';
import { authRoutes } from './routes/auth';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Global middleware ---
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// PII guard — scrubs sensitive data from all outgoing responses
app.use(piiGuardMiddleware);

// --- Public routes (no auth required) ---
app.use('/api/v1/auth', authRoutes);

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Protected routes ---
app.use('/api/v1/patients', authMiddleware, auditMiddleware, patientRoutes);
app.use('/api/v1/appointments', authMiddleware, auditMiddleware, appointmentRoutes);
app.use('/api/v1/billing', authMiddleware, auditMiddleware, billingRoutes);

// --- Global error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // PII scrubbing on error messages before logging
  const sanitizedMessage = err.message.replace(/\d{3}-\d{2}-\d{4}/g, '***-**-****');

  logger.error('Unhandled error', {
    error: sanitizedMessage,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// --- Start server ---
const server = app.listen(PORT, () => {
  logger.info(`ClearHealth API running on port ${PORT}`, {
    environment: process.env.NODE_ENV,
    port: PORT,
  });
});

// --- Graceful shutdown ---
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  } catch (err) {
    logger.error('Error disconnecting Prisma', { error: (err as Error).message });
  }

  try {
    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (err) {
    logger.error('Error closing Redis', { error: (err as Error).message });
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });

export default app;
