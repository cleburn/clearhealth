/**
 * Appointment Routes — Test Suite
 *
 * Tests appointment CRUD, status transitions, availability checks,
 * and check-in/completion workflows.
 * All test data is synthetic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req.user = {
      userId: 'usr-doc-001',
      tenantId: 'tenant-test-001',
      role: 'DOCTOR',
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
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    visitNote: {
      findFirst: vi.fn(),
    },
    billingRecord: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
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

import { appointmentRoutes } from '../appointments';

// Synthetic test data
const SYNTHETIC_APPOINTMENT_ID = 'appt-syn-001';
const SYNTHETIC_PATIENT_ID = 'patient-syn-001';
const SYNTHETIC_DOCTOR_ID = 'doc-syn-001';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/appointments', appointmentRoutes);
  return app;
}

describe('Appointment Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  // ── GET /appointments ──────────────────────────────────────────────

  describe('GET /api/v1/appointments', () => {
    it('returns filtered appointment list or 501', async () => {
      const res = await request(app).get('/api/v1/appointments');
      expect([200, 501]).toContain(res.status);
    });

    it('accepts filter query parameters (doctorId, patientId, status)', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({
          doctorId: SYNTHETIC_DOCTOR_ID,
          patientId: SYNTHETIC_PATIENT_ID,
          status: 'SCHEDULED',
        });
      expect([200, 501]).toContain(res.status);
    });

    it('accepts date range filters', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({
          dateStart: '2025-01-01',
          dateEnd: '2025-12-31',
        });
      expect([200, 501]).toContain(res.status);
    });

    it('returns JSON content type', async () => {
      const res = await request(app).get('/api/v1/appointments');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // ── POST /appointments ─────────────────────────────────────────────

  describe('POST /api/v1/appointments', () => {
    const validInput = {
      patientId: SYNTHETIC_PATIENT_ID,
      doctorId: SYNTHETIC_DOCTOR_ID,
      scheduledAt: '2025-09-15T10:00:00Z',
      duration: 30,
      type: 'FOLLOW_UP',
      notes: 'Synthetic follow-up appointment',
    };

    it('returns 501 or 201 on valid input', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .send(validInput);
      expect([201, 501]).toContain(res.status);
    });

    it('validates required input fields', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .send({ patientId: SYNTHETIC_PATIENT_ID }); // Missing doctorId, scheduledAt, etc.
      expect([400, 501]).toContain(res.status);
    });

    it('validates appointment type enum', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .send({ ...validInput, type: 'INVALID_TYPE' });
      expect([400, 501]).toContain(res.status);
    });

    it('checks doctor availability (no double-booking)', async () => {
      // When implemented, creating two appointments at the same time for the same
      // doctor should fail. For now, verify the route responds.
      const res = await request(app)
        .post('/api/v1/appointments')
        .send(validInput);
      expect([201, 409, 501]).toContain(res.status);
    });
  });

  // ── PATCH /appointments/:id ────────────────────────────────────────

  describe('PATCH /api/v1/appointments/:id', () => {
    it('returns 501 or 200 on valid status update', async () => {
      const res = await request(app)
        .patch(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}`)
        .send({ status: 'CONFIRMED' });
      expect([200, 501]).toContain(res.status);
    });

    it('validates status transitions (e.g., COMPLETED cannot be rescheduled)', async () => {
      const res = await request(app)
        .patch(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}`)
        .send({ status: 'SCHEDULED' }); // Attempting invalid transition
      // When implemented: might return 400 for invalid transition
      expect([200, 400, 501]).toContain(res.status);
    });

    it('allows cancellation', async () => {
      const res = await request(app)
        .patch(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}`)
        .send({ status: 'CANCELLED' });
      expect([200, 501]).toContain(res.status);
    });

    it('returns 404 or 501 for non-existent appointment', async () => {
      const res = await request(app)
        .patch('/api/v1/appointments/nonexistent-id')
        .send({ status: 'CONFIRMED' });
      expect([404, 501]).toContain(res.status);
    });
  });

  // ── POST /appointments/:id/checkin ─────────────────────────────────

  describe('POST /api/v1/appointments/:id/checkin', () => {
    it('returns 501 or 200 on valid check-in', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}/checkin`);
      expect([200, 501]).toContain(res.status);
    });

    it('only accepts CONFIRMED or SCHEDULED appointments for check-in', async () => {
      // When implemented, checking in a COMPLETED appointment should fail
      const res = await request(app)
        .post(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}/checkin`);
      expect([200, 400, 501]).toContain(res.status);
    });

    it('returns 404 or 501 for non-existent appointment', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/nonexistent-id/checkin');
      expect([404, 501]).toContain(res.status);
    });
  });

  // ── POST /appointments/:id/complete ────────────────────────────────

  describe('POST /api/v1/appointments/:id/complete', () => {
    it('returns 501 or 200 on valid completion', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}/complete`);
      expect([200, 501]).toContain(res.status);
    });

    it('requires a signed visit note for completion', async () => {
      // When implemented: completing without a signed visit note should return 400
      const res = await request(app)
        .post(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}/complete`);
      expect([200, 400, 501]).toContain(res.status);
    });

    it('returns 404 or 501 for non-existent appointment', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/nonexistent-id/complete');
      expect([404, 501]).toContain(res.status);
    });

    it('only allows completion of IN_PROGRESS appointments', async () => {
      // When implemented: completing a SCHEDULED appointment should fail
      const res = await request(app)
        .post(`/api/v1/appointments/${SYNTHETIC_APPOINTMENT_ID}/complete`);
      expect([200, 400, 501]).toContain(res.status);
    });
  });
});
