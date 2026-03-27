/**
 * ClearHealth Web — Form Validation Schemas
 *
 * Zod schemas for validating user input in forms. Used with
 * react-hook-form for type-safe form handling.
 *
 * @security
 * - SSN validation only occurs in intake forms — SSN is never stored in frontend state
 * - All PII validation runs client-side only (no PII sent until form submission)
 * - Validators prevent malformed data from reaching the API
 */

import { z } from "zod";

// --- Primitive validators ---

/** Email address validator */
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters");

/** Phone number validator (US format) */
export const phoneSchema = z
  .string()
  .regex(
    /^\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
    "Please enter a valid phone number",
  )
  .optional();

/** Date of birth validator */
export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((date) => {
    const parsed = new Date(date);
    return parsed < new Date() && parsed > new Date("1900-01-01");
  }, "Please enter a valid date of birth");

/**
 * SSN format validator — for intake forms only.
 * SSN is never stored in frontend state beyond form submission.
 *
 * @security This validator runs on intake forms. The SSN value is sent
 * directly to the API for encryption and is immediately cleared from
 * the form state after submission.
 */
export const ssnSchema = z
  .string()
  .regex(/^\d{3}-\d{2}-\d{4}$/, "SSN must be in XXX-XX-XXXX format");

/** Password strength validator */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// --- Form schemas ---

/** Login form validation schema */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/** Patient intake form validation schema */
export const patientIntakeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: dateOfBirthSchema,
  /** @security — SSN cleared from form state immediately after submission */
  ssn: ssnSchema,
  insuranceId: z.string().optional(),
  insurancePlan: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: phoneSchema,
});

/** Appointment booking form validation schema */
export const appointmentSchema = z.object({
  doctorId: z.string().uuid("Please select a doctor"),
  scheduledAt: z.string().datetime("Please select a valid date and time"),
  duration: z.number().min(15).max(120).default(30),
  type: z.enum(["INITIAL", "FOLLOW_UP", "URGENT", "TELEHEALTH"]),
  notes: z.string().max(1000).optional(),
});

/** Inferred types from schemas for use with react-hook-form */
export type LoginFormData = z.infer<typeof loginSchema>;
export type PatientIntakeFormData = z.infer<typeof patientIntakeSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
