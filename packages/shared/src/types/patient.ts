/**
 * ClearHealth — Patient Type Definitions
 *
 * Defines the Patient data model and related input types.
 * PII fields are clearly marked for downstream handling by the
 * encryption service and PII guard middleware.
 *
 * @security Fields marked @pii are encrypted at rest and masked in API responses.
 * SSN is always stored encrypted (AES-256-GCM) and never returned in plain text.
 */

/**
 * Full Patient record as stored in the database.
 * Used internally by the API — never returned directly to clients.
 */
export interface Patient {
  id: string;
  userId: string;
  /** @pii — Date of birth is PII under HIPAA */
  dateOfBirth: Date;
  /** @pii @encrypted — Social Security Number, encrypted at rest with AES-256-GCM. Never return raw value. */
  ssn: string;
  /** @pii — Insurance member ID */
  insuranceId: string | null;
  insurancePlan: string | null;
  /** Internal Medical Record Number for cross-referencing */
  medicalRecordNumber: string;
  /** @pii — Emergency contact name */
  emergencyContactName: string | null;
  /** @pii — Emergency contact phone number */
  emergencyContactPhone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Non-PII subset of Patient for use in list views and summaries.
 * Safe to return to authorized users without additional masking.
 */
export interface PatientSummary {
  id: string;
  userId: string;
  medicalRecordNumber: string;
  insurancePlan: string | null;
  /** Masked DOB — only year or age range shown in list views */
  dateOfBirthYear: number;
  createdAt: Date;
}

/**
 * Input for creating a new patient record.
 * SSN will be encrypted by the API before storage.
 */
export interface CreatePatientInput {
  userId: string;
  /** @pii — Must be validated as a real date, not in the future */
  dateOfBirth: string;
  /** @pii — Must match XXX-XX-XXXX format. Encrypted before storage. */
  ssn: string;
  insuranceId?: string;
  insurancePlan?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

/**
 * Input for updating an existing patient record.
 * All fields optional — only provided fields are updated.
 * SSN changes require re-encryption.
 */
export interface UpdatePatientInput {
  dateOfBirth?: string;
  /** @pii — If provided, must be re-encrypted before storage */
  ssn?: string;
  insuranceId?: string;
  insurancePlan?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}
