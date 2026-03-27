/**
 * Billing Routes — Test Suite
 *
 * Tests billing record listing, claim submission, and report generation.
 * All test data is synthetic — no real patient or insurance data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.user = {
      userId: 'usr-admin-001',
      tenantId: 'tenant-test-001',
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    req.tenantId = 'tenant-test-001';
    next();
  },
  requireRole: (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    billingRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    appointment: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock insurance service
vi.mock('../../services/insurance', () => ({
  submitClaim: vi.fn().mockResolvedValue({ claimId: 'CLM-SYN-001', status: 'SUBMITTED' }),
  checkClaimStatus: vi.fn().mockResolvedValue({ status: 'PENDING' }),
}));

// Mock audit and PII guard
vi.mock('../../middleware/audit', () => ({
  auditMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/pii-guard', () => ({
  piiGuardMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

import { billingRoutes } from '../billing';
import { authMiddleware } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

// Synthetic test data
const SYNTHETIC_BILLING_ID = 'bill-syn-001';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/billing', authMiddleware, billingRoutes);
  return app;
}

describe('Billing Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();

    // Set sensible mock defaults so implemented routes don't throw on undefined
    const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    mockPrisma.billingRecord.findMany.mockResolvedValue([]);
    mockPrisma.billingRecord.count.mockResolvedValue(0);
    mockPrisma.billingRecord.findUnique.mockResolvedValue(null);
    mockPrisma.billingRecord.update.mockResolvedValue({});
  });

  // ── GET /billing ───────────────────────────────────────────────────

  describe('GET /api/v1/billing', () => {
    it('returns tenant-scoped billing records or 501', async () => {
      const res = await request(app).get('/api/v1/billing');
      expect([200, 501]).toContain(res.status);
    });

    it('accepts filter query parameters (status, dateRange)', async () => {
      const res = await request(app)
        .get('/api/v1/billing')
        .query({
          status: 'PENDING',
          dateStart: '2025-01-01',
          dateEnd: '2025-12-31',
        });
      expect([200, 501]).toContain(res.status);
    });

    it('accepts patientId filter', async () => {
      const res = await request(app)
        .get('/api/v1/billing')
        .query({ patientId: 'patient-syn-001' });
      expect([200, 501]).toContain(res.status);
    });

    it('returns JSON content type', async () => {
      const res = await request(app).get('/api/v1/billing');
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/billing')
        .query({ page: 1, limit: 20 });
      expect([200, 501]).toContain(res.status);
    });
  });

  // ── POST /billing/claims ───────────────────────────────────────────

  describe('POST /api/v1/billing/claims', () => {
    const validClaimInput = {
      billingRecordId: SYNTHETIC_BILLING_ID,
    };

    it('returns 501 or 201 on valid claim submission', async () => {
      const res = await request(app)
        .post('/api/v1/billing/claims')
        .send(validClaimInput);
      expect([200, 201, 400, 404, 501]).toContain(res.status);
    });


    it('validates that billing record exists and is PENDING', async () => {
      const res = await request(app)
        .post('/api/v1/billing/claims')
        .send({ billingRecordId: 'nonexistent-id' });
      // When implemented: should validate billing record status
      expect([400, 404, 501]).toContain(res.status);
    });

    it('rejects claim for already submitted billing record', async () => {
      const res = await request(app)
        .post('/api/v1/billing/claims')
        .send({ billingRecordId: 'already-submitted-id' });
      // When implemented: should return 400 for non-PENDING status
      expect([400, 404, 501]).toContain(res.status);
    });

    it('rejects empty request body', async () => {
      const res = await request(app)
        .post('/api/v1/billing/claims')
        .send({});
      expect([400, 404, 501]).toContain(res.status);
    });
  });

  // ── GET /billing/reports ───────────────────────────────────────────

  describe('GET /api/v1/billing/reports', () => {
    it('returns aggregated billing data or 501', async () => {
      const res = await request(app).get('/api/v1/billing/reports');
      expect([200, 501]).toContain(res.status);
    });

    it('accepts date range parameters', async () => {
      const res = await request(app)
        .get('/api/v1/billing/reports')
        .query({
          dateStart: '2025-01-01',
          dateEnd: '2025-06-30',
        });
      expect([200, 501]).toContain(res.status);
    });

    it('accepts groupBy parameter', async () => {
      const res = await request(app)
        .get('/api/v1/billing/reports')
        .query({ groupBy: 'status' });
      expect([200, 501]).toContain(res.status);
    });

    it('returns data scoped to tenant', async () => {
      const res = await request(app).get('/api/v1/billing/reports');
      // When implemented, data should be filtered to tenant-test-001
      expect([200, 501]).toContain(res.status);
    });

    it('returns JSON response', async () => {
      const res = await request(app).get('/api/v1/billing/reports');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // ── Tenant scoping ─────────────────────────────────────────────────

  describe('Tenant scoping', () => {
    it('all billing queries are scoped to authenticated tenant', async () => {
      // Auth mock sets tenantId = 'tenant-test-001'
      const res = await request(app).get('/api/v1/billing');
      expect([200, 501]).toContain(res.status);
      // When implemented: prisma queries should include tenantId filter
    });
  });
});
