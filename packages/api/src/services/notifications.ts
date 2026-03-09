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

/**
 * Sends appointment reminder via email and SMS.
 * Queued via BullMQ — executes asynchronously.
 *
 * Uses BullMQ for async delivery. Patient contact info must be fetched
 * fresh, not cached, to respect data deletion requests.
 *
 * @param appointmentId - The appointment to send a reminder for
 */
export async function sendAppointmentReminder(appointmentId: string): Promise<void> {
  // TODO: implement
  // - Fetch appointment details with patient and doctor info
  // - Fetch patient contact info FRESH (do not use cached data)
  // - Queue email job: appointment date, doctor name, clinic address
  // - Queue SMS job: brief reminder with appointment time
  // - Do NOT include patient medical details in notification content
  void appointmentId;
}

/**
 * Sends appointment confirmation after successful booking.
 *
 * @param appointmentId - The newly booked appointment
 */
export async function sendAppointmentConfirmation(appointmentId: string): Promise<void> {
  // TODO: implement
  // - Fetch appointment details
  // - Queue confirmation email with: date, time, doctor, location
  // - Queue confirmation SMS
  void appointmentId;
}

/**
 * Sends password reset email with secure reset link.
 *
 * @param userId - The user requesting password reset
 * @param token - The password reset token (1h expiry)
 *
 * @security Reset link must use HTTPS. Token is single-use and time-limited.
 */
export async function sendPasswordReset(userId: string, token: string): Promise<void> {
  // TODO: implement
  // - Fetch user email (fresh from database)
  // - Build reset URL: ${FRONTEND_URL}/reset-password?token=${token}
  // - Queue email with reset link
  // - Do NOT include the token in logs
  void userId;
  void token;
}
