/**
 * ClearHealth — Billing Type Definitions
 *
 * Defines billing records, insurance claims, and related types.
 *
 * @security Billing records contain patient PII indirectly through
 * insurance claim data. All billing responses must pass through PII filtering.
 */

/** Insurance claim processing status */
export enum ClaimStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  PAID = 'PAID',
}

/** Full billing record */
export interface BillingRecord {
  id: string;
  tenantId: string;
  appointmentId: string;
  patientId: string;
  /** Full claim payload sent to insurance provider — may contain PII */
  insuranceClaim: InsuranceClaim | null;
  /** Amount in dollars */
  amount: number;
  status: ClaimStatus;
  /** CPT procedure codes */
  cptCodes: string[];
  /** ICD-10 diagnosis codes */
  icdCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Insurance claim payload submitted to insurance providers */
export interface InsuranceClaim {
  /** @pii — Patient insurance member ID */
  memberId: string;
  /** @pii — Patient name as it appears on insurance card */
  subscriberName: string;
  groupNumber: string;
  providerId: string;
  providerNPI: string;
  serviceDate: string;
  placeOfService: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  chargeAmount: number;
  submittedAt: string;
}

/** Result of an insurance verification check */
export interface InsuranceVerification {
  id: string;
  patientId: string;
  verifiedAt: Date;
  /** Verification status: ACTIVE, INACTIVE, PENDING, EXPIRED */
  status: string;
  /** Raw response from insurance verification API */
  response: Record<string, unknown>;
  expiresAt: Date;
}

/** Billing report summary for admin views */
export interface BillingReport {
  periodStart: Date;
  periodEnd: Date;
  totalClaims: number;
  totalAmount: number;
  byStatus: Record<ClaimStatus, { count: number; amount: number }>;
  byProvider: Array<{
    doctorId: string;
    doctorName: string;
    claimCount: number;
    totalAmount: number;
  }>;
}
