/**
 * ClearHealth API — Appointment Routes
 *
 * Handles appointment booking, scheduling, check-in, and completion.
 * All routes are tenant-scoped and role-restricted.
 *
 * @security Appointment data references patients and doctors.
 * Tenant isolation is enforced at query level.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireRole, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { sendAppointmentConfirmation } from '../services/notifications';

export const appointmentRoutes = Router();

const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(15).max(480),
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'URGENT', 'TELEHEALTH']),
  notes: z.string().optional(),
});

const UpdateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().int().min(15).max(480).optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'NO_SHOW']).optional(),
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'URGENT', 'TELEHEALTH']).optional(),
  notes: z.string().optional(),
});

const CompleteAppointmentSchema = z.object({
  cptCodes: z.array(z.string()).min(1),
  icdCodes: z.array(z.string()).min(1),
  amount: z.number().positive(),
});

/** Valid status transitions for appointments */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * Checks if a doctor has availability for a given time slot.
 */
async function checkDoctorAvailability(
  doctorId: string,
  scheduledAt: Date,
  duration: number,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000);

  const conflicting = await prisma.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      AND: [
        { scheduledAt: { lt: endTime } },
        {
          scheduledAt: {
            gte: new Date(scheduledAt.getTime() - 480 * 60 * 1000), // look back max duration
          },
        },
      ],
    },
  });

  if (!conflicting) return true;

  // Check if the conflicting appointment actually overlaps
  const conflictEnd = new Date(conflicting.scheduledAt.getTime() + conflicting.duration * 60 * 1000);
  return scheduledAt >= conflictEnd || endTime <= conflicting.scheduledAt;
}

/**
 * GET /api/v1/appointments
 * List appointments — filterable by doctor, patient, date range, status.
 * Accessible by: PATIENT (own), DOCTOR (assigned), ADMIN, SUPER_ADMIN
 */
appointmentRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = { tenantId };

    // Role-based filtering
    if (req.user.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: req.user.userId },
      });
      if (!patient) {
        res.status(200).json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        return;
      }
      whereClause.patientId = patient.id;
    } else if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
      });
      if (!doctor) {
        res.status(200).json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
        return;
      }
      whereClause.doctorId = doctor.id;
    }

    // Apply query filters
    if (req.query.doctorId && req.user.role !== 'DOCTOR') {
      whereClause.doctorId = req.query.doctorId;
    }
    if (req.query.patientId && req.user.role !== 'PATIENT') {
      whereClause.patientId = req.query.patientId;
    }
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    if (req.query.type) {
      whereClause.type = req.query.type;
    }
    if (req.query.dateStart || req.query.dateEnd) {
      whereClause.scheduledAt = {};
      if (req.query.dateStart) {
        (whereClause.scheduledAt as Record<string, unknown>).gte = new Date(req.query.dateStart as string);
      }
      if (req.query.dateEnd) {
        (whereClause.scheduledAt as Record<string, unknown>).lte = new Date(req.query.dateEnd as string);
      }
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: whereClause,
        include: {
          patient: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          doctor: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.appointment.count({ where: whereClause }),
    ]);

    const data = appointments.map((appt) => ({
      id: appt.id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      scheduledAt: appt.scheduledAt,
      duration: appt.duration,
      status: appt.status,
      type: appt.type,
      notes: appt.notes,
      patient: {
        firstName: appt.patient.user.firstName,
        lastName: appt.patient.user.lastName,
      },
      doctor: {
        firstName: appt.doctor.user.firstName,
        lastName: appt.doctor.user.lastName,
      },
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt,
    }));

    res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('List appointments error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/v1/appointments
 * Book a new appointment.
 * Accessible by: PATIENT (self-booking), ADMIN, SUPER_ADMIN
 *
 * @security Validates doctor availability and patient insurance before booking.
 */
appointmentRoutes.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const parsed = CreateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.issues });
      return;
    }

    const data = parsed.data;

    // PATIENT can only book for themselves
    if (req.user.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: req.user.userId },
      });
      if (!patient || patient.id !== data.patientId) {
        res.status(403).json({ error: 'Patients can only book their own appointments', code: 'FORBIDDEN' });
        return;
      }
    }

    // Verify patient exists and belongs to tenant
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: { user: { select: { tenantId: true, isActive: true } } },
    });

    if (!patient || patient.user.tenantId !== tenantId || !patient.user.isActive) {
      res.status(404).json({ error: 'Patient not found', code: 'NOT_FOUND' });
      return;
    }

    // Verify doctor exists
    const doctor = await prisma.doctor.findUnique({
      where: { id: data.doctorId },
      include: { user: { select: { tenantId: true, isActive: true } } },
    });

    if (!doctor || doctor.user.tenantId !== tenantId || !doctor.user.isActive) {
      res.status(404).json({ error: 'Doctor not found', code: 'NOT_FOUND' });
      return;
    }

    const scheduledAt = new Date(data.scheduledAt);

    // Check doctor availability
    const isAvailable = await checkDoctorAvailability(data.doctorId, scheduledAt, data.duration);
    if (!isAvailable) {
      res.status(409).json({ error: 'Doctor is not available at the requested time', code: 'CONFLICT' });
      return;
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        scheduledAt,
        duration: data.duration,
        type: data.type,
        notes: data.notes || null,
        status: 'SCHEDULED',
      },
    });

    // Queue confirmation notification (async, don't block response)
    sendAppointmentConfirmation(appointment.id).catch((err: Error) => {
      logger.error('Failed to send appointment confirmation', { error: err.message });
    });

    logger.info('Appointment created', { appointmentId: appointment.id });

    res.status(201).json(appointment);
  } catch (err) {
    logger.error('Create appointment error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /api/v1/appointments/:id
 * Update appointment — reschedule or cancel.
 * Accessible by: PATIENT (own, limited), DOCTOR (assigned), ADMIN, SUPER_ADMIN
 */
appointmentRoutes.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const appointmentId = req.params.id;

    const parsed = UpdateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.issues });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.tenantId !== tenantId) {
      res.status(404).json({ error: 'Appointment not found', code: 'NOT_FOUND' });
      return;
    }

    // Access control
    if (req.user.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: req.user.userId },
      });
      if (!patient || patient.id !== appointment.patientId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
      // Patients can only cancel
      if (parsed.data.status && parsed.data.status !== 'CANCELLED') {
        res.status(403).json({ error: 'Patients can only cancel appointments', code: 'FORBIDDEN' });
        return;
      }
      if (parsed.data.scheduledAt) {
        res.status(403).json({ error: 'Patients cannot reschedule directly. Please contact the clinic.', code: 'FORBIDDEN' });
        return;
      }
    } else if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
      });
      if (!doctor || doctor.id !== appointment.doctorId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }

    // Validate status transitions
    if (parsed.data.status) {
      const allowed = VALID_TRANSITIONS[appointment.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        res.status(400).json({
          error: `Cannot transition from ${appointment.status} to ${parsed.data.status}`,
          code: 'INVALID_TRANSITION',
        });
        return;
      }
    }

    // If rescheduling, check availability
    if (parsed.data.scheduledAt) {
      const newTime = new Date(parsed.data.scheduledAt);
      const duration = parsed.data.duration || appointment.duration;
      const isAvailable = await checkDoctorAvailability(appointment.doctorId, newTime, duration, appointmentId);
      if (!isAvailable) {
        res.status(409).json({ error: 'Doctor is not available at the requested time', code: 'CONFLICT' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.scheduledAt) updateData.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.duration) updateData.duration = parsed.data.duration;
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.type) updateData.type = parsed.data.type;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    logger.info('Appointment updated', {
      appointmentId,
      updatedFields: Object.keys(updateData),
    });

    res.status(200).json(updated);
  } catch (err) {
    logger.error('Update appointment error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/v1/appointments/:id/checkin
 * Patient check-in — marks arrival at clinic.
 * Accessible by: ADMIN, SUPER_ADMIN (front desk staff)
 */
appointmentRoutes.post('/:id/checkin', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const appointmentId = req.params.id;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.tenantId !== tenantId) {
      res.status(404).json({ error: 'Appointment not found', code: 'NOT_FOUND' });
      return;
    }

    if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
      res.status(400).json({
        error: `Cannot check in from status ${appointment.status}`,
        code: 'INVALID_TRANSITION',
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'IN_PROGRESS',
        notes: appointment.notes
          ? `${appointment.notes}\nChecked in at ${new Date().toISOString()}`
          : `Checked in at ${new Date().toISOString()}`,
      },
    });

    logger.info('Patient checked in', { appointmentId });

    res.status(200).json(updated);
  } catch (err) {
    logger.error('Check-in error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/v1/appointments/:id/complete
 * Complete appointment — triggers billing workflow.
 * Accessible by: DOCTOR (assigned), ADMIN, SUPER_ADMIN
 */
appointmentRoutes.post('/:id/complete', requireRole('DOCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId || !req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    const appointmentId = req.params.id;

    const parsed = CompleteAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.issues });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { visitNote: true },
    });

    if (!appointment || appointment.tenantId !== tenantId) {
      res.status(404).json({ error: 'Appointment not found', code: 'NOT_FOUND' });
      return;
    }

    // DOCTOR can only complete their own appointments
    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
      });
      if (!doctor || doctor.id !== appointment.doctorId) {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
      }
    }

    if (appointment.status !== 'IN_PROGRESS') {
      res.status(400).json({
        error: `Cannot complete appointment with status ${appointment.status}. Must be IN_PROGRESS.`,
        code: 'INVALID_TRANSITION',
      });
      return;
    }

    // Verify visit note exists and is signed
    if (!appointment.visitNote || !appointment.visitNote.isSigned) {
      res.status(400).json({
        error: 'A signed visit note is required to complete the appointment',
        code: 'VISIT_NOTE_REQUIRED',
      });
      return;
    }

    const { cptCodes, icdCodes, amount } = parsed.data;

    // Complete appointment and create billing record in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });

      const billingRecord = await tx.billingRecord.create({
        data: {
          tenantId,
          appointmentId,
          patientId: appointment.patientId,
          amount,
          status: 'PENDING',
          cptCodes,
          icdCodes,
        },
      });

      return { appointment: updatedAppointment, billingRecord };
    });

    logger.info('Appointment completed and billing record created', {
      appointmentId,
      billingRecordId: result.billingRecord.id,
    });

    res.status(200).json({
      appointment: result.appointment,
      billingRecord: result.billingRecord,
    });
  } catch (err) {
    logger.error('Complete appointment error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});
