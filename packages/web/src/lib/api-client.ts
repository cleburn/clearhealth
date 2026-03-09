/**
 * ClearHealth Web — Typed API Client
 *
 * Provides type-safe methods for communicating with the ClearHealth API.
 * Handles JWT attachment, token refresh on 401, and error formatting.
 *
 * @security
 * - Access token attached to every request via Authorization header
 * - On 401: automatically attempts token refresh and retries the request
 * - Never stores tokens in localStorage (memory only)
 * - API base URL from environment variable
 */

import type { LoginRequest, LoginResponse, RefreshResponse } from '@clearhealth/shared/types/auth';
import type { Patient, PatientSummary, CreatePatientInput, UpdatePatientInput } from '@clearhealth/shared/types/patient';
import type { Appointment, CreateAppointmentInput, UpdateAppointmentInput } from '@clearhealth/shared/types/appointment';
import type { BillingRecord, BillingReport } from '@clearhealth/shared/types/billing';

/** API error response shape */
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/** Base URL for API requests */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/** In-memory access token storage */
let accessToken: string | null = null;

/**
 * Sets the access token for API requests.
 * Token is stored in memory only — never persisted to localStorage or cookies.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Makes an authenticated API request.
 * Automatically attaches JWT and handles 401 -> refresh -> retry flow.
 *
 * @param endpoint - API endpoint path (e.g., '/patients')
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError on non-2xx responses
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // TODO: implement
  // - Build full URL from API_BASE_URL + endpoint
  // - Attach Authorization: Bearer <token> header
  // - Set Content-Type: application/json
  // - Make fetch request
  // - On 401: attempt token refresh, retry request once
  // - On error: parse error response and throw ApiError
  // - On success: parse and return JSON body
  throw new Error('Not implemented');
}

// --- Auth API ---

export const authApi = {
  login: (_credentials: LoginRequest): Promise<LoginResponse> => {
    // TODO: implement — POST /auth/login
    throw new Error('Not implemented');
  },
  refresh: (): Promise<RefreshResponse> => {
    // TODO: implement — POST /auth/refresh
    throw new Error('Not implemented');
  },
  logout: (): Promise<void> => {
    // TODO: implement — POST /auth/logout
    throw new Error('Not implemented');
  },
};

// --- Patient API ---

export const patientApi = {
  list: (_params?: { page?: number; limit?: number }): Promise<PatientSummary[]> => {
    // TODO: implement — GET /patients
    throw new Error('Not implemented');
  },
  getById: (_id: string): Promise<Patient> => {
    // TODO: implement — GET /patients/:id
    throw new Error('Not implemented');
  },
  create: (_input: CreatePatientInput): Promise<Patient> => {
    // TODO: implement — POST /patients
    throw new Error('Not implemented');
  },
  update: (_id: string, _input: UpdatePatientInput): Promise<Patient> => {
    // TODO: implement — PATCH /patients/:id
    throw new Error('Not implemented');
  },
  delete: (_id: string): Promise<void> => {
    // TODO: implement — DELETE /patients/:id (soft delete)
    throw new Error('Not implemented');
  },
  getHistory: (_id: string): Promise<Appointment[]> => {
    // TODO: implement — GET /patients/:id/history
    throw new Error('Not implemented');
  },
};

// --- Appointment API ---

export const appointmentApi = {
  list: (_params?: { doctorId?: string; patientId?: string; status?: string; dateStart?: string; dateEnd?: string }): Promise<Appointment[]> => {
    // TODO: implement — GET /appointments
    throw new Error('Not implemented');
  },
  create: (_input: CreateAppointmentInput): Promise<Appointment> => {
    // TODO: implement — POST /appointments
    throw new Error('Not implemented');
  },
  update: (_id: string, _input: UpdateAppointmentInput): Promise<Appointment> => {
    // TODO: implement — PATCH /appointments/:id
    throw new Error('Not implemented');
  },
  checkin: (_id: string): Promise<Appointment> => {
    // TODO: implement — POST /appointments/:id/checkin
    throw new Error('Not implemented');
  },
  complete: (_id: string): Promise<Appointment> => {
    // TODO: implement — POST /appointments/:id/complete
    throw new Error('Not implemented');
  },
};

// --- Billing API ---

export const billingApi = {
  list: (_params?: { status?: string; dateStart?: string; dateEnd?: string }): Promise<BillingRecord[]> => {
    // TODO: implement — GET /billing
    throw new Error('Not implemented');
  },
  submitClaim: (_billingRecordId: string): Promise<BillingRecord> => {
    // TODO: implement — POST /billing/claims
    throw new Error('Not implemented');
  },
  followUpClaim: (_claimId: string): Promise<BillingRecord> => {
    // TODO: implement — POST /billing/claims/:id/followup
    throw new Error('Not implemented');
  },
  getReports: (_params: { dateStart: string; dateEnd: string }): Promise<BillingReport> => {
    // TODO: implement — GET /billing/reports
    throw new Error('Not implemented');
  },
};
