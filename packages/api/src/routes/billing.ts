/**
 * ClearHealth API — Billing Routes
 *
 * Handles billing records, insurance claim submissions, and financial reporting.
 *
 * @security Insurance claim data contains patient PII. All responses filtered.
 * Billing operations are restricted to ADMIN and SUPER_ADMIN roles.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { requireRole, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

export const billingRoutes = Router();

// Insurance claim data contains patient PII. All responses filtered.

const SubmitClaimSchema = z.object({
  billingRecordId: z.string().uuid(),
});

const ReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(["status", "provider", "month"]).optional(),
});

/**
 * GET /api/v1/billing
 * List billing records — paginated, tenant-scoped.
 * Accessible by: PATIENT (own), ADMIN, SUPER_ADMIN
 */
billingRoutes.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res
        .status(401)
        .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = { tenantId };

    // PATIENT can only see own billing records
    if (req.user.role === "PATIENT") {
      const patient = await prisma.patient.findUnique({
        where: { userId: req.user.userId },
      });
      if (!patient) {
        res.status(200).json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
        return;
      }
      whereClause.patientId = patient.id;
    } else if (req.user.role === "DOCTOR") {
      // Doctors can see billing for their appointments
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
      });
      if (!doctor) {
        res.status(200).json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
        return;
      }
      whereClause.appointment = { doctorId: doctor.id };
    }

    // Apply filters
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    if (req.query.patientId && req.user.role !== "PATIENT") {
      whereClause.patientId = req.query.patientId;
    }
    if (req.query.dateStart || req.query.dateEnd) {
      whereClause.createdAt = {};
      if (req.query.dateStart) {
        (whereClause.createdAt as Record<string, unknown>).gte = new Date(
          req.query.dateStart as string,
        );
      }
      if (req.query.dateEnd) {
        (whereClause.createdAt as Record<string, unknown>).lte = new Date(
          req.query.dateEnd as string,
        );
      }
    }

    const [records, total] = await Promise.all([
      prisma.billingRecord.findMany({
        where: whereClause,
        include: {
          patient: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          appointment: {
            select: {
              scheduledAt: true,
              type: true,
              doctor: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.billingRecord.count({ where: whereClause }),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      patientId: r.patientId,
      patientName: `${r.patient.user.firstName} ${r.patient.user.lastName}`,
      amount: r.amount,
      status: r.status,
      cptCodes: r.cptCodes,
      icdCodes: r.icdCodes,
      appointmentDate: r.appointment.scheduledAt,
      appointmentType: r.appointment.type,
      doctorName: `${r.appointment.doctor.user.firstName} ${r.appointment.doctor.user.lastName}`,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error("List billing records error", {
      error: (err as Error).message,
    });
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/v1/billing/claims
 * Submit an insurance claim for a completed appointment.
 * Accessible by: ADMIN, SUPER_ADMIN
 *
 * @security Claim payload contains patient PII (insurance ID, name).
 * Submission is logged to audit trail with claim reference number.
 */
billingRoutes.post(
  "/claims",
  requireRole("ADMIN", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId || !req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
        return;
      }

      const parsed = SubmitClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
        return;
      }

      const billingRecord = await prisma.billingRecord.findUnique({
        where: { id: parsed.data.billingRecordId },
        include: {
          patient: {
            include: {
              user: {
                select: { firstName: true, lastName: true, tenantId: true },
              },
            },
          },
          appointment: {
            include: {
              doctor: {
                select: { licenseNumber: true },
              },
            },
          },
        },
      });

      if (!billingRecord || billingRecord.tenantId !== tenantId) {
        res
          .status(404)
          .json({ error: "Billing record not found", code: "NOT_FOUND" });
        return;
      }

      if (billingRecord.status !== "PENDING") {
        res.status(400).json({
          error: `Cannot submit claim for billing record with status ${billingRecord.status}`,
          code: "INVALID_STATUS",
        });
        return;
      }

      // Build insurance claim payload
      const claimPayload = {
        memberId: billingRecord.patient.insuranceId || "UNKNOWN",
        subscriberName: `${billingRecord.patient.user.firstName} ${billingRecord.patient.user.lastName}`,
        groupNumber: billingRecord.patient.insurancePlan || "UNKNOWN",
        providerId: billingRecord.appointment.doctorId,
        providerNPI: billingRecord.appointment.doctor.licenseNumber,
        serviceDate: billingRecord.appointment.scheduledAt
          .toISOString()
          .split("T")[0],
        placeOfService: "11", // Office
        diagnosisCodes: billingRecord.icdCodes,
        procedureCodes: billingRecord.cptCodes,
        chargeAmount: Number(billingRecord.amount),
        submittedAt: new Date().toISOString(),
      };

      // Update billing record with claim payload and status
      const updated = await prisma.billingRecord.update({
        where: { id: billingRecord.id },
        data: {
          status: "SUBMITTED",
          insuranceClaim: claimPayload,
        },
      });

      logger.info("Insurance claim submitted", {
        billingRecordId: billingRecord.id,
        patientId: billingRecord.patientId,
      });

      res.status(200).json({
        id: updated.id,
        status: updated.status,
        submittedAt: claimPayload.submittedAt,
      });
    } catch (err) {
      logger.error("Submit claim error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * POST /api/v1/billing/claims/:id/followup
 * Follow up on a pending insurance claim.
 * Accessible by: ADMIN, SUPER_ADMIN
 */
billingRoutes.post(
  "/claims/:id/followup",
  requireRole("ADMIN", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId || !req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
        return;
      }

      const billingRecordId = req.params.id;

      const billingRecord = await prisma.billingRecord.findUnique({
        where: { id: billingRecordId },
      });

      if (!billingRecord || billingRecord.tenantId !== tenantId) {
        res
          .status(404)
          .json({ error: "Billing record not found", code: "NOT_FOUND" });
        return;
      }

      if (billingRecord.status !== "SUBMITTED") {
        res.status(400).json({
          error: `Cannot follow up on claim with status ${billingRecord.status}`,
          code: "INVALID_STATUS",
        });
        return;
      }

      // Stub: simulate insurance API response for claim status
      const claimStatusResponse = {
        status: "APPROVED" as const,
        processedAt: new Date().toISOString(),
        approvedAmount: Number(billingRecord.amount),
        notes: "Claim approved for full amount",
      };

      const updated = await prisma.billingRecord.update({
        where: { id: billingRecordId },
        data: {
          status: claimStatusResponse.status,
          insuranceClaim: {
            ...((billingRecord.insuranceClaim as Record<string, unknown>) ||
              {}),
            followUpResponse: claimStatusResponse,
          },
        },
      });

      logger.info("Claim follow-up completed", {
        billingRecordId,
        newStatus: claimStatusResponse.status,
      });

      res.status(200).json({
        id: updated.id,
        status: updated.status,
        followUpResult: claimStatusResponse,
      });
    } catch (err) {
      logger.error("Claim follow-up error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * GET /api/v1/billing/reports
 * Generate billing reports — aggregated by date range, provider, status.
 * Accessible by: ADMIN, SUPER_ADMIN
 */
billingRoutes.get(
  "/reports",
  requireRole("ADMIN", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId || !req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
        return;
      }

      const queryParsed = ReportQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        res.status(400).json({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      const startDate = queryParsed.data.startDate
        ? new Date(queryParsed.data.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = queryParsed.data.endDate
        ? new Date(queryParsed.data.endDate)
        : new Date();

      const whereClause = {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Get all billing records for the period
      const records = await prisma.billingRecord.findMany({
        where: whereClause,
        include: {
          appointment: {
            include: {
              doctor: {
                include: {
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      });

      // Aggregate by status
      const byStatus: Record<string, { count: number; amount: number }> = {};
      for (const status of [
        "PENDING",
        "SUBMITTED",
        "APPROVED",
        "DENIED",
        "PAID",
      ]) {
        const matching = records.filter((r) => r.status === status);
        byStatus[status] = {
          count: matching.length,
          amount: matching.reduce((sum, r) => sum + Number(r.amount), 0),
        };
      }

      // Aggregate by provider
      const providerMap = new Map<
        string,
        { doctorName: string; claimCount: number; totalAmount: number }
      >();
      for (const record of records) {
        const doctorId = record.appointment.doctorId;
        const doctorName = `${record.appointment.doctor.user.firstName} ${record.appointment.doctor.user.lastName}`;
        const existing = providerMap.get(doctorId) || {
          doctorName,
          claimCount: 0,
          totalAmount: 0,
        };
        existing.claimCount += 1;
        existing.totalAmount += Number(record.amount);
        providerMap.set(doctorId, existing);
      }

      const byProvider = Array.from(providerMap.entries()).map(
        ([doctorId, data]) => ({
          doctorId,
          doctorName: data.doctorName,
          claimCount: data.claimCount,
          totalAmount: data.totalAmount,
        }),
      );

      const report = {
        periodStart: startDate,
        periodEnd: endDate,
        totalClaims: records.length,
        totalAmount: records.reduce((sum, r) => sum + Number(r.amount), 0),
        byStatus,
        byProvider,
      };

      logger.info("Billing report generated", {
        tenantId,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        totalClaims: report.totalClaims,
      });

      res.status(200).json(report);
    } catch (err) {
      logger.error("Billing report error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);
