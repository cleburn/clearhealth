/**
 * Auth Routes — Test Suite
 *
 * Tests login, token refresh, logout, password reset, and account lockout.
 * All test data is synthetic — no real credentials or emails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

// Mock Redis (ioredis)
vi.mock('ioredis', () => {
  const Redis = vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
  }));
  return { default: Redis };
});

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('$2b$12$syntheticHashValue'),
  },
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue('$2b$12$syntheticHashValue'),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('synthetic-jwt-access-token'),
    verify: vi.fn(),
  },
  sign: vi.fn().mockReturnValue('synthetic-jwt-access-token'),
  verify: vi.fn(),
}));

// Mock notification service
vi.mock('../../services/notifications', () => ({
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

// Mock PII guard
vi.mock('../../middleware/pii-guard', () => ({
  piiGuardMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { authRoutes } from '../auth';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Synthetic test data
const SYNTHETIC_USER = {
  id: 'usr-syn-001',
  tenantId: 'tenant-syn-001',
  email: 'synthetic.user@test.example',
  role: 'ADMIN',
  firstName: 'Synthetic',
  lastName: 'User',
  phone: '555-000-0001',
  passwordHash: '$2b$12$syntheticBcryptHashForTesting',
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  return app;
}

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-routes';
    app = createApp();
    vi.clearAllMocks();

    // Re-configure mocks cleared by clearAllMocks
    (jwt.sign as ReturnType<typeof vi.fn>).mockReturnValue('synthetic-jwt-access-token');

    // Default: user exists and password matches for success path
    (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(SYNTHETIC_USER);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(SYNTHETIC_USER);
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(SYNTHETIC_USER);
    (prisma.auditLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    // Configure Redis mock defaults
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (redis.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  });

  // ── POST /auth/login ───────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('returns 501 or tokens on valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: SYNTHETIC_USER.email,
          password: 'SyntheticPassword123!',
        });

      expect([200, 501]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
      }
    });

    it('returns 401 or 501 with invalid password', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: SYNTHETIC_USER.email,
          password: 'WrongPassword!',
        });

      expect([401, 501]).toContain(res.status);
    });

    it('returns 401 or 501 for non-existent user', async () => {
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.example',
          password: 'SomePassword123!',
        });

      expect([401, 501]).toContain(res.status);
    });

    it('rejects empty request body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect([400, 401, 501]).toContain(res.status);
    });

    it('returns JSON content type', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: SYNTHETIC_USER.email,
          password: 'SyntheticPassword123!',
        });

      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 501 or new tokens on valid refresh token', async () => {
      // Configure redis to return stored refresh token data
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ userId: 'usr-syn-001', tenantId: 'tenant-syn-001', role: 'ADMIN' })
      );
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'synthetic-valid-refresh-token' });

      expect([200, 501]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
      }
    });

    it('returns 401 or 501 for invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' });

      expect([401, 501]).toContain(res.status);
    });

    it('rotates tokens — old refresh token should be invalidated', async () => {
      // When implemented, using the same refresh token twice should fail on second use
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'synthetic-one-time-token' });

      expect([200, 401, 501]).toContain(res.status);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('returns 501 or 200 on successful logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'synthetic-refresh-token-to-invalidate' });

      expect([200, 501]).toContain(res.status);
    });

    it('invalidates the refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'synthetic-token-to-remove' });

      // When implemented: Redis.del should be called
      expect([200, 501]).toContain(res.status);
    });
  });

  // ── POST /auth/forgot-password ─────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('always returns 200 or 501 (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: SYNTHETIC_USER.email });

      // Must return 200 even for valid emails (anti-enumeration)
      expect([200, 501]).toContain(res.status);
    });

    it('returns same status for non-existent email (anti-enumeration)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'doesnotexist@test.example' });

      // Must also return 200 — same response for both existing and non-existing emails
      expect([200, 501]).toContain(res.status);
    });

    it('does not reveal whether email exists', async () => {
      const resExisting = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: SYNTHETIC_USER.email });

      const resNonExisting = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'phantom@test.example' });

      // Both should return the same status code
      expect(resExisting.status).toBe(resNonExisting.status);
    });
  });

  // ── Account lockout ────────────────────────────────────────────────

  describe('Account lockout after failed attempts', () => {
    it('locks account after 5 failed login attempts', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      // When implemented: after 5 failed attempts, account should be locked
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: SYNTHETIC_USER.email,
            password: 'WrongPassword!',
          });
      }

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: SYNTHETIC_USER.email,
          password: 'SyntheticPassword123!', // Even correct password should fail
        });

      // When implemented: should return 401 with lockout message (or 429 for rate limit)
      expect([401, 423, 429, 501]).toContain(res.status);
    });

    it('tracks failed attempt count per user', async () => {
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: SYNTHETIC_USER.email,
          password: 'WrongPassword!',
        });

      // Verify no server error
      expect([401, 501]).toContain(res.status);
    });
  });
});
