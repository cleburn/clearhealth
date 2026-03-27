/**
 * ClearHealth — Appointment Type Definitions
 *
 * Defines appointment, visit note, and scheduling types used across
 * the API and web packages.
 *
 * @security Appointment data may reference patient PII indirectly.
 * Always ensure tenant scoping when querying appointments.
 */

/** Appointment lifecycle status */
export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

/** Type of appointment */
export enum AppointmentType {
  INITIAL = "INITIAL",
  FOLLOW_UP = "FOLLOW_UP",
  URGENT = "URGENT",
  TELEHEALTH = "TELEHEALTH",
}

/** Full Appointment record */
export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  /** Duration in minutes */
  duration: number;
  status: AppointmentStatus;
  type: AppointmentType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for booking a new appointment */
export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  duration: number;
  type: AppointmentType;
  notes?: string;
}

/** Input for updating/rescheduling an appointment */
export interface UpdateAppointmentInput {
  scheduledAt?: string;
  duration?: number;
  status?: AppointmentStatus;
  type?: AppointmentType;
  notes?: string;
}

/**
 * SOAP-format visit note attached to a completed appointment.
 * Once signed, visit notes are immutable — they become part of the
 * legal medical record.
 */
export interface VisitNote {
  id: string;
  appointmentId: string;
  doctorId: string;
  /** Patient's reported symptoms and concerns */
  subjective: string;
  /** Doctor's clinical observations and measurements */
  objective: string;
  /** Diagnosis and clinical assessment */
  assessment: string;
  /** Treatment plan and follow-up instructions */
  plan: string;
  /** Signed notes are legally binding and immutable */
  isSigned: boolean;
  signedAt: Date | null;
  createdAt: Date;
}

/** Input for creating or updating a visit note (before signing) */
export interface CreateVisitNoteInput {
  appointmentId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
