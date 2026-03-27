/**
 * Auth Middleware — Test Suite
 *
 * Validates JWT verification and role-based access control.
 * All tokens and user data are synthetic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Response, NextFunction } from "express";

// Mock jsonwebtoken
vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor() {
        super("jwt expired");
        this.name = "TokenExpiredError";
      }
    },
  },
  verify: vi.fn(),
}));

// Mock logger to prevent winston import
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

import jwt from "jsonwebtoken";
import { authMiddleware, requireRole } from "../auth";
import type { AuthenticatedRequest } from "../auth";

const MOCK_SECRET = "test-jwt-secret-key-for-testing";

function createMockReq(
  headers: Record<string, string> = {},
): Partial<AuthenticatedRequest> {
  return {
    headers: { ...headers },
    user: undefined,
    tenantId: undefined,
    ip: "127.0.0.1",
    path: "/test",
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("Auth Middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction;
    process.env.JWT_SECRET = MOCK_SECRET;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ── authMiddleware ─────────────────────────────────────────────────

  describe("authMiddleware", () => {
    it("accepts a valid JWT and attaches user context to req", () => {
      const payload = {
        userId: "usr-001",
        tenantId: "tenant-001",
        role: "ADMIN",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

      const req = createMockReq({ authorization: "Bearer valid-token-123" });
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user).toEqual(payload);
      expect((req as AuthenticatedRequest).tenantId).toBe("tenant-001");
    });

    it("returns 401 when Authorization header is missing", () => {
      const req = createMockReq({});
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 for malformed Authorization header (no Bearer prefix)", () => {
      const req = createMockReq({ authorization: "Basic abc123" });
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when JWT verification throws (invalid signature)", () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("invalid signature");
      });

      const req = createMockReq({ authorization: "Bearer bad-token" });
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when token is expired", () => {
      (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        const err = new jwt.TokenExpiredError("jwt expired", new Date());
        throw err;
      });

      const req = createMockReq({ authorization: "Bearer expired-token" });
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("sets req.tenantId from decoded JWT payload", () => {
      const payload = {
        userId: "usr-002",
        tenantId: "tenant-xyz",
        role: "DOCTOR",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(payload);

      const req = createMockReq({ authorization: "Bearer valid-token" });
      const res = createMockRes();

      authMiddleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).tenantId).toBe("tenant-xyz");
    });
  });

  // ── requireRole() ─────────────────────────────────────────────────

  describe("requireRole()", () => {
    it("allows a user with a matching role", () => {
      const middleware = requireRole("ADMIN", "SUPER_ADMIN");

      const req = createMockReq() as AuthenticatedRequest;
      req.user = {
        userId: "usr-001",
        tenantId: "tenant-001",
        role: "ADMIN" as never,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const res = createMockRes();

      middleware(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("rejects a user with a non-matching role with 403", () => {
      const middleware = requireRole("ADMIN", "SUPER_ADMIN");

      const req = createMockReq() as AuthenticatedRequest;
      req.user = {
        userId: "usr-002",
        tenantId: "tenant-001",
        role: "PATIENT" as never,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const res = createMockRes();

      middleware(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when req.user is not set (auth middleware did not run)", () => {
      const middleware = requireRole("ADMIN");

      const req = createMockReq() as AuthenticatedRequest;
      const res = createMockRes();

      middleware(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows SUPER_ADMIN when SUPER_ADMIN is in the role list", () => {
      const middleware = requireRole("SUPER_ADMIN");

      const req = createMockReq() as AuthenticatedRequest;
      req.user = {
        userId: "usr-sa",
        tenantId: "tenant-global",
        role: "SUPER_ADMIN" as never,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const res = createMockRes();

      middleware(req, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("rejects DOCTOR when only ADMIN is allowed", () => {
      const middleware = requireRole("ADMIN");

      const req = createMockReq() as AuthenticatedRequest;
      req.user = {
        userId: "usr-doc",
        tenantId: "tenant-001",
        role: "DOCTOR" as never,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const res = createMockRes();

      middleware(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
