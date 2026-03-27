/**
 * ClearHealth API — Patient Routes
 *
 * Handles CRUD operations for patient records. All routes are
 * protected by authentication and tenant-scoped.
 *
 * @security
 * CRITICAL: All patient data responses must pass through PII filtering.
 * Never return raw SSN. Log access to audit trail.
 *
 * - SSN is encrypted before storage and masked in responses
 * - All access is logged via audit middleware
 * - Soft delete only — HIPAA requires record retention
 * - Tenant isolation enforced at query level
 */

import { Router, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { requireRole, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { encrypt, decrypt } from "../services/encryption";

export const patientRoutes = Router();

// CRITICAL: All patient data responses must pass through PII filtering.
// Never return raw SSN. Log access to audit trail.

const BCRYPT_ROUNDS = 12;

const CreatePatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  ssn: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{4}$/, "SSN must be XXX-XX-XXXX format"),
  insuranceId: z.string().optional(),
  insurancePlan: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
});

const UpdatePatientSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ssn: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{4}$/)
    .optional(),
  insuranceId: z.string().optional(),
  insurancePlan: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
  phone: z.string().optional(),
});

/** Fields that PATIENT role can update on their own record */
const PATIENT_UPDATABLE_FIELDS = [
  "emergencyContactName",
  "emergencyContactPhone",
  "phone",
  "insuranceId",
];

/**
 * Masks an SSN to show only the last 4 digits: ***-**-1234
 */
function maskSSN(ssn: string): string {
  if (ssn.length >= 4) {
    return `***-**-${ssn.slice(-4)}`;
  }
  return "***-**-****";
}

/**
 * Generates a unique Medical Record Number.
 */
function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MRN-${timestamp}-${random}`;
}

/**
 * GET /api/v1/patients
 * List patients — paginated, tenant-scoped.
 * Accessible by: DOCTOR (assigned only), ADMIN, SUPER_ADMIN
 */
patientRoutes.get(
  "/",
  requireRole("DOCTOR", "ADMIN", "SUPER_ADMIN"),
  async (req: AuthenticatedRequest, res: Response) => {
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

      // Build where clause based on role
      const whereClause: Record<string, unknown> = {
        user: {
          tenantId,
          isActive: true,
        },
      };

      // DOCTOR role: filter to only patients with appointments assigned to this doctor
      if (req.user.role === "DOCTOR") {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
        });

        if (!doctor) {
          res
            .status(403)
            .json({ error: "Doctor profile not found", code: "FORBIDDEN" });
          return;
        }

        whereClause.appointments = {
          some: {
            doctorId: doctor.id,
            tenantId,
          },
        };
      }

      const [patients, total] = await Promise.all([
        prisma.patient.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.patient.count({ where: whereClause }),
      ]);

      const summaries = patients.map((p) => ({
        id: p.id,
        userId: p.userId,
        medicalRecordNumber: p.medicalRecordNumber,
        insurancePlan: p.insurancePlan,
        dateOfBirthYear: p.dateOfBirth.getFullYear(),
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        createdAt: p.createdAt,
      }));

      res.status(200).json({
        data: summaries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("List patients error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * GET /api/v1/patients/:id
 * Get patient by ID — includes decrypted PII for authorized viewers.
 * Accessible by: PATIENT (own record), DOCTOR (assigned), ADMIN, SUPER_ADMIN
 */
patientRoutes.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res
        .status(401)
        .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }

    const patientId = req.params.id;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!patient || patient.user.tenantId !== tenantId) {
      res.status(404).json({ error: "Patient not found", code: "NOT_FOUND" });
      return;
    }

    // Access control checks
    if (req.user.role === "PATIENT" && patient.userId !== req.user.userId) {
      res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
      return;
    }

    if (req.user.role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
      });

      if (!doctor) {
        res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      const hasAppointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          doctorId: doctor.id,
          tenantId,
        },
      });

      if (!hasAppointment) {
        res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
        return;
      }
    }

    // Decrypt SSN and mask for display
    let maskedSSN = "***-**-****";
    try {
      const decryptedSSN = decrypt(patient.ssn);
      maskedSSN = maskSSN(decryptedSSN);
    } catch {
      logger.error("Failed to decrypt SSN", { patientId });
    }

    res.status(200).json({
      id: patient.id,
      userId: patient.userId,
      firstName: patient.user.firstName,
      lastName: patient.user.lastName,
      email: patient.user.email,
      phone: patient.user.phone,
      dateOfBirth: patient.dateOfBirth,
      ssn: maskedSSN,
      insuranceId: patient.insuranceId,
      insurancePlan: patient.insurancePlan,
      medicalRecordNumber: patient.medicalRecordNumber,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      notes: patient.notes,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    });
  } catch (err) {
    logger.error("Get patient error", { error: (err as Error).message });
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

/**
 * POST /api/v1/patients
 * Create a new patient record.
 * Accessible by: ADMIN, SUPER_ADMIN
 *
 * @security SSN must be encrypted before storage using the encryption service.
 */
patientRoutes.post(
  "/",
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

      const parsed = CreatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: "Invalid input",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          });
        return;
      }

      const data = parsed.data;

      // Check for existing user with same email in this tenant
      const existingUser = await prisma.user.findFirst({
        where: { email: data.email, tenantId },
      });

      if (existingUser) {
        res
          .status(409)
          .json({
            error: "A user with this email already exists",
            code: "CONFLICT",
          });
        return;
      }

      // Encrypt SSN before storage
      const encryptedSSN = encrypt(data.ssn);
      const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
      const medicalRecordNumber = generateMRN();

      // Create User + Patient in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: uuidv4(),
            tenantId,
            email: data.email,
            passwordHash,
            role: "PATIENT",
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
          },
        });

        const patient = await tx.patient.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            dateOfBirth: new Date(data.dateOfBirth),
            ssn: encryptedSSN,
            insuranceId: data.insuranceId || null,
            insurancePlan: data.insurancePlan || null,
            medicalRecordNumber,
            emergencyContactName: data.emergencyContactName || null,
            emergencyContactPhone: data.emergencyContactPhone || null,
            notes: data.notes || null,
          },
        });

        return { user, patient };
      });

      logger.info("Patient created", {
        patientId: result.patient.id,
        userId: result.user.id,
      });

      res.status(201).json({
        id: result.patient.id,
        userId: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        medicalRecordNumber: result.patient.medicalRecordNumber,
        ssn: maskSSN(data.ssn),
        dateOfBirth: result.patient.dateOfBirth,
        createdAt: result.patient.createdAt,
      });
    } catch (err) {
      logger.error("Create patient error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * PATCH /api/v1/patients/:id
 * Update patient record.
 * Accessible by: PATIENT (own limited fields), ADMIN, SUPER_ADMIN
 */
patientRoutes.patch(
  "/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId || !req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
        return;
      }

      const patientId = req.params.id;

      const parsed = UpdatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: "Invalid input",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          });
        return;
      }

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { tenantId: true, id: true } } },
      });

      if (!patient || patient.user.tenantId !== tenantId) {
        res.status(404).json({ error: "Patient not found", code: "NOT_FOUND" });
        return;
      }

      // PATIENT role can only update limited fields on their own record
      if (req.user.role === "PATIENT") {
        if (patient.userId !== req.user.userId) {
          res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
          return;
        }

        const requestedFields = Object.keys(parsed.data);
        const disallowedFields = requestedFields.filter(
          (f) => !PATIENT_UPDATABLE_FIELDS.includes(f),
        );
        if (disallowedFields.length > 0) {
          res.status(403).json({
            error: `Patients can only update: ${PATIENT_UPDATABLE_FIELDS.join(", ")}`,
            code: "FORBIDDEN",
          });
          return;
        }
      } else if (req.user.role === "DOCTOR") {
        res
          .status(403)
          .json({
            error: "Doctors cannot update patient records",
            code: "FORBIDDEN",
          });
        return;
      }

      const updateData = parsed.data;
      const patientUpdate: Record<string, unknown> = {};
      const userUpdate: Record<string, unknown> = {};

      if (updateData.dateOfBirth) {
        patientUpdate.dateOfBirth = new Date(updateData.dateOfBirth);
      }
      if (updateData.ssn) {
        patientUpdate.ssn = encrypt(updateData.ssn);
      }
      if (updateData.insuranceId !== undefined) {
        patientUpdate.insuranceId = updateData.insuranceId;
      }
      if (updateData.insurancePlan !== undefined) {
        patientUpdate.insurancePlan = updateData.insurancePlan;
      }
      if (updateData.emergencyContactName !== undefined) {
        patientUpdate.emergencyContactName = updateData.emergencyContactName;
      }
      if (updateData.emergencyContactPhone !== undefined) {
        patientUpdate.emergencyContactPhone = updateData.emergencyContactPhone;
      }
      if (updateData.notes !== undefined) {
        patientUpdate.notes = updateData.notes;
      }
      if (updateData.phone !== undefined) {
        userUpdate.phone = updateData.phone;
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(patientUpdate).length > 0) {
          await tx.patient.update({
            where: { id: patientId },
            data: patientUpdate,
          });
        }
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: patient.userId },
            data: userUpdate,
          });
        }
      });

      logger.info("Patient updated", {
        patientId,
        updatedFields: Object.keys({ ...patientUpdate, ...userUpdate }),
      });

      res.status(200).json({ message: "Patient updated successfully" });
    } catch (err) {
      logger.error("Update patient error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * DELETE /api/v1/patients/:id
 * Soft delete a patient record — sets isActive = false.
 * Accessible by: ADMIN, SUPER_ADMIN
 *
 * @security HIPAA requires record retention. This performs a soft delete only.
 * Hard deletion requires SUPER_ADMIN approval and is logged separately.
 */
patientRoutes.delete(
  "/:id",
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

      const patientId = req.params.id;

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { tenantId: true, id: true } } },
      });

      if (!patient || patient.user.tenantId !== tenantId) {
        res.status(404).json({ error: "Patient not found", code: "NOT_FOUND" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        // Soft delete: set user.isActive = false
        await tx.user.update({
          where: { id: patient.userId },
          data: { isActive: false },
        });

        // Cancel any future appointments
        await tx.appointment.updateMany({
          where: {
            patientId,
            tenantId,
            status: { in: ["SCHEDULED", "CONFIRMED"] },
            scheduledAt: { gt: new Date() },
          },
          data: { status: "CANCELLED" },
        });
      });

      logger.info("Patient soft-deleted", {
        patientId,
        userId: patient.userId,
      });

      res.status(200).json({ message: "Patient record deactivated" });
    } catch (err) {
      logger.error("Delete patient error", { error: (err as Error).message });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);

/**
 * GET /api/v1/patients/:id/history
 * Full appointment and visit history for a patient.
 * Accessible by: PATIENT (own), DOCTOR (assigned), ADMIN, SUPER_ADMIN
 */
patientRoutes.get(
  "/:id/history",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId || !req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
        return;
      }

      const patientId = req.params.id;

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { tenantId: true, id: true } } },
      });

      if (!patient || patient.user.tenantId !== tenantId) {
        res.status(404).json({ error: "Patient not found", code: "NOT_FOUND" });
        return;
      }

      // Access control
      if (req.user.role === "PATIENT" && patient.userId !== req.user.userId) {
        res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
        return;
      }

      if (req.user.role === "DOCTOR") {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
        });

        if (!doctor) {
          res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
          return;
        }

        const hasAppointment = await prisma.appointment.findFirst({
          where: {
            patientId,
            doctorId: doctor.id,
            tenantId,
          },
        });

        if (!hasAppointment) {
          res.status(403).json({ error: "Access denied", code: "FORBIDDEN" });
          return;
        }
      }

      const appointments = await prisma.appointment.findMany({
        where: {
          patientId,
          tenantId,
        },
        include: {
          doctor: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          visitNote: {
            select: {
              id: true,
              subjective: true,
              objective: true,
              assessment: true,
              plan: true,
              isSigned: true,
              signedAt: true,
              createdAt: true,
            },
          },
          billingRecord: {
            select: {
              id: true,
              amount: true,
              status: true,
              cptCodes: true,
              icdCodes: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
      });

      const history = appointments.map((appt) => ({
        id: appt.id,
        scheduledAt: appt.scheduledAt,
        duration: appt.duration,
        status: appt.status,
        type: appt.type,
        notes: appt.notes,
        doctor: {
          id: appt.doctorId,
          firstName: appt.doctor.user.firstName,
          lastName: appt.doctor.user.lastName,
        },
        visitNote: appt.visitNote,
        billing: appt.billingRecord,
      }));

      res.status(200).json({ data: history });
    } catch (err) {
      logger.error("Get patient history error", {
        error: (err as Error).message,
      });
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  },
);
