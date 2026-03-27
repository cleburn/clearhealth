/**
 * ClearHealth API — Notification Service
 *
 * Handles appointment reminders, confirmations, and password reset emails.
 * Uses BullMQ for async delivery to avoid blocking API responses.
 *
 * @security
 * - Uses BullMQ for async delivery. Patient contact info must be fetched
 *   fresh, not cached, to respect data deletion requests.
 * - Email sent via SendGrid (SENDGRID_API_KEY)
 * - SMS sent via Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
 * - Notification content must not include full PII (use first name only)
 */

import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

/**
 * Sends appointment reminder via email and SMS.
 * Queued via BullMQ — executes asynchronously.
 *
 * Uses BullMQ for async delivery. Patient contact info must be fetched
 * fresh, not cached, to respect data deletion requests.
 *
 * @param appointmentId - The appointment to send a reminder for
 */
export async function sendAppointmentReminder(
  appointmentId: string,
): Promise<void> {
  // Fetch appointment details with patient and doctor info FRESH
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: {
        include: {
          user: {
            select: { firstName: true, email: true, phone: true },
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
  });

  if (!appointment) {
    logger.warn("Appointment not found for reminder", { appointmentId });
    return;
  }

  const patientFirstName = appointment.patient.user.firstName;
  const doctorName = `Dr. ${appointment.doctor.user.lastName}`;

  // Stub: log the notification instead of actually sending
  logger.info("Appointment reminder queued", {
    appointmentId,
    patientFirstName,
    doctorName,
    scheduledAt: appointment.scheduledAt.toISOString(),
    type: "reminder",
  });
}

/**
 * Sends appointment confirmation after successful booking.
 *
 * @param appointmentId - The newly booked appointment
 */
export async function sendAppointmentConfirmation(
  appointmentId: string,
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: {
        include: {
          user: {
            select: { firstName: true, email: true, phone: true },
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
  });

  if (!appointment) {
    logger.warn("Appointment not found for confirmation", { appointmentId });
    return;
  }

  const patientFirstName = appointment.patient.user.firstName;
  const doctorName = `Dr. ${appointment.doctor.user.lastName}`;

  logger.info("Appointment confirmation queued", {
    appointmentId,
    patientFirstName,
    doctorName,
    scheduledAt: appointment.scheduledAt.toISOString(),
    type: "confirmation",
  });
}

/**
 * Sends password reset email with secure reset link.
 *
 * @param userId - The user requesting password reset
 * @param token - The password reset token (1h expiry)
 *
 * @security Reset link must use HTTPS. Token is single-use and time-limited.
 */
export async function sendPasswordReset(
  userId: string,
  _token: string,
): Promise<void> {
  // Fetch user email fresh from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, email: true },
  });

  if (!user) {
    logger.warn("User not found for password reset", { userId });
    return;
  }

  // Build reset URL (do NOT log the token)
  const frontendUrl =
    process.env.FRONTEND_URL || "https://app.clearhealth.local";
  const _resetUrl = `${frontendUrl}/reset-password?token=***`;

  // Stub: log the action without the token or full email
  logger.info("Password reset email queued", {
    userId,
    recipientFirstName: user.firstName,
    type: "password_reset",
  });
}
