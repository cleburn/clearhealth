/**
 * ClearHealth API — Insurance Verification Service
 *
 * Integrates with external insurance verification API to check
 * patient coverage eligibility and verify active insurance status.
 *
 * @security
 * - Calls external insurance verification API (INSURANCE_API_URL)
 * - API key stored in INSURANCE_API_KEY env var
 * - Responses cached in Redis for 24h to reduce external calls
 * - Patient PII (insurance ID, name) is sent to the external API
 *   under the terms of the BAA (Business Associate Agreement)
 */

import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/** Result of an insurance verification check */
export interface VerificationResult {
  isVerified: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'EXPIRED';
  planName: string;
  groupNumber: string;
  effectiveDate: string;
  terminationDate: string | null;
  copay: number;
  deductible: number;
  deductibleMet: number;
  rawResponse: Record<string, unknown>;
}

/** Result of an eligibility check for a specific procedure */
export interface EligibilityResult {
  isEligible: boolean;
  cptCode: string;
  coveragePercent: number;
  estimatedPatientCost: number;
  preAuthRequired: boolean;
  notes: string;
}

/**
 * Stub for external insurance API call.
 * In production, this would make an HTTP request to the insurance verification service.
 */
async function callInsuranceAPI(
  insuranceId: string,
  plan: string,
): Promise<VerificationResult> {
  // Stub: simulate external API response
  logger.info('Calling external insurance verification API', {
    insuranceId: '[FILTERED]',
    plan,
  });

  return {
    isVerified: true,
    status: 'ACTIVE',
    planName: plan,
    groupNumber: 'GRP-001',
    effectiveDate: '2025-01-01',
    terminationDate: null,
    copay: 25,
    deductible: 1500,
    deductibleMet: 750,
    rawResponse: {
      source: 'stub',
      timestamp: new Date().toISOString(),
      insuranceId: '[FILTERED]',
    },
  };
}

/**
 * Verifies a patient's insurance coverage status.
 * Calls external insurance verification API. Responses cached in Redis for 24h.
 *
 * @param patientId - The patient's internal ID
 * @param insuranceId - The insurance member ID
 * @param plan - The insurance plan name
 * @returns Verification result with coverage details
 */
export async function verifyInsurance(
  patientId: string,
  insuranceId: string,
  plan: string,
): Promise<VerificationResult> {
  const cacheKey = `insurance:verify:${patientId}`;

  // Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    logger.debug('Insurance verification cache hit', { patientId });
    return JSON.parse(cached) as VerificationResult;
  }

  // Call external API
  const result = await callInsuranceAPI(insuranceId, plan);

  // Cache result with 24h TTL
  await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);

  // Write InsuranceVerification record to database
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + CACHE_TTL_SECONDS);

  await prisma.insuranceVerification.create({
    data: {
      patientId,
      status: result.status,
      response: result.rawResponse,
      expiresAt,
    },
  });

  logger.info('Insurance verification completed', {
    patientId,
    status: result.status,
  });

  return result;
}

/**
 * Checks eligibility for a specific CPT code under the patient's plan.
 *
 * @param patientId - The patient's internal ID
 * @param cptCode - The CPT procedure code to check
 * @returns Eligibility result with cost estimates
 */
export async function checkEligibility(
  patientId: string,
  cptCode: string,
): Promise<EligibilityResult> {
  // Look up patient insurance info
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { insuranceId: true, insurancePlan: true },
  });

  if (!patient || !patient.insuranceId) {
    return {
      isEligible: false,
      cptCode,
      coveragePercent: 0,
      estimatedPatientCost: 0,
      preAuthRequired: false,
      notes: 'No insurance information on file',
    };
  }

  // Stub: simulate eligibility check
  logger.info('Checking eligibility', { patientId, cptCode });

  return {
    isEligible: true,
    cptCode,
    coveragePercent: 80,
    estimatedPatientCost: 50,
    preAuthRequired: false,
    notes: 'Coverage confirmed under current plan',
  };
}
