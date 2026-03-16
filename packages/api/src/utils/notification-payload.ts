/**
 * ClearHealth API — Notification Payload Builder
 *
 * Builds tokenized notification payloads from patient and appointment data.
 * The backend is responsible for tokenizing all patient data before passing
 * payloads to the notifications service, per governance policy.
 *
 * @security
 * - No patient IDs or raw PII in the output payload
 * - Only display-safe template variables (first name, formatted dates)
 * - Delivery addresses are included for routing only — the notifications
 *   service must not persist them beyond a single delivery attempt
 */

import type { AppointmentType } from '@clearhealth/shared/types/appointment';

/** Template identifiers for notification types */
export enum NotificationTemplateId {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
  APPOINTMENT_CANCELLATION = 'appointment_cancellation',
}

/** Display-safe template variables — no raw PII */
export interface NotificationTemplateVariables {
  patientFirstName: string;
  doctorDisplayName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  durationMinutes: number;
}

/**
 * Tokenized notification payload ready for the notifications service.
 * Contains only delivery routing info, a template ID, and display-safe variables.
 * No patient IDs, SSNs, DOBs, or other raw PII.
 */
export interface NotificationPayload {
  deliveryAddress: {
    email: string;
    phone: string | null;
  };
  templateId: NotificationTemplateId;
  templateVariables: NotificationTemplateVariables;
}

/** Minimum patient + user fields needed to build a notification payload */
export interface PatientNotificationInput {
  user: {
    firstName: string;
    email: string;
    phone: string | null;
  };
}

/** Minimum appointment + doctor fields needed to build a notification payload */
export interface AppointmentNotificationInput {
  scheduledAt: Date;
  duration: number;
  type: AppointmentType;
  doctor: {
    user: {
      lastName: string;
    };
  };
}

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Initial Visit',
  FOLLOW_UP: 'Follow-Up',
  URGENT: 'Urgent',
  TELEHEALTH: 'Telehealth',
};

/**
 * Formats a Date into a display-friendly date string.
 * Uses "Month Day, Year" format (e.g., "March 15, 2026").
 */
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a Date into a display-friendly time string.
 * Uses 12-hour format with AM/PM (e.g., "2:30 PM").
 */
function formatDisplayTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Builds a tokenized notification payload from patient and appointment data.
 *
 * This is the single point where patient data is tokenized before being
 * passed to the notifications service. The output contains:
 * - Delivery address (email/phone) for routing only
 * - A template ID identifying which notification to send
 * - Display-safe template variables (first name, formatted dates, etc.)
 *
 * No patient IDs, SSNs, DOBs, insurance info, or other raw PII appear
 * in the output.
 *
 * @param patient - Patient with associated user record (firstName, email, phone)
 * @param appointment - Appointment with associated doctor user record
 * @param templateId - Which notification template to use
 * @returns Tokenized payload safe for the notifications service
 */
export function buildNotificationPayload(
  patient: PatientNotificationInput,
  appointment: AppointmentNotificationInput,
  templateId: NotificationTemplateId,
): NotificationPayload {
  return {
    deliveryAddress: {
      email: patient.user.email,
      phone: patient.user.phone,
    },
    templateId,
    templateVariables: {
      patientFirstName: patient.user.firstName,
      doctorDisplayName: `Dr. ${appointment.doctor.user.lastName}`,
      appointmentDate: formatDisplayDate(appointment.scheduledAt),
      appointmentTime: formatDisplayTime(appointment.scheduledAt),
      appointmentType: APPOINTMENT_TYPE_LABELS[appointment.type] ?? appointment.type,
      durationMinutes: appointment.duration,
    },
  };
}
