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

/** Flag to prevent concurrent refresh attempts */
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Sets the access token for API requests.
 * Token is stored in memory only — never persisted to localStorage or cookies.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Returns the current access token (for use by auth provider) */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Attempts to refresh the access token.
 * Deduplicates concurrent refresh calls to avoid race conditions.
 */
async function attemptRefresh(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send httpOnly refresh cookie
      });

      if (!response.ok) {
        accessToken = null;
        return null;
      }

      const data: RefreshResponse = await response.json();
      accessToken = data.accessToken;
      return data.accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include httpOnly cookies for refresh token
  });

  // On 401: attempt token refresh and retry the request once
  if (response.status === 401) {
    const newToken = await attemptRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      const errorBody: ApiError = {
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      };
      throw errorBody;
    }
  }

  // Handle no-content responses (e.g., DELETE)
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json();

  if (!response.ok) {
    const errorBody: ApiError = {
      error: body.error || body.message || 'An unexpected error occurred',
      code: body.code || `HTTP_${response.status}`,
      details: body.details,
    };
    throw errorBody;
  }

  return body as T;
}

// --- Auth API ---

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const body = await response.json();

    if (!response.ok) {
      const errorBody: ApiError = {
        error: body.error || 'Invalid email or password',
        code: body.code || 'AUTH_FAILED',
      };
      throw errorBody;
    }

    const data = body as LoginResponse;
    accessToken = data.accessToken;
    return data;
  },

  refresh: async (): Promise<RefreshResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const errorBody: ApiError = {
        error: (body as Record<string, string>).error || 'Session expired',
        code: (body as Record<string, string>).code || 'REFRESH_FAILED',
      };
      throw errorBody;
    }

    const data: RefreshResponse = await response.json();
    accessToken = data.accessToken;
    return data;
  },

  logout: async (): Promise<void> => {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
    accessToken = null;
  },
};

// --- Patient API ---

export const patientApi = {
  list: (params?: { page?: number; limit?: number }): Promise<PatientSummary[]> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return apiRequest<PatientSummary[]>(`/patients${query ? `?${query}` : ''}`);
  },

  getById: (id: string): Promise<Patient> => {
    return apiRequest<Patient>(`/patients/${id}`);
  },

  create: (input: CreatePatientInput): Promise<Patient> => {
    return apiRequest<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: UpdatePatientInput): Promise<Patient> => {
    return apiRequest<Patient>(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  delete: (id: string): Promise<void> => {
    return apiRequest<void>(`/patients/${id}`, { method: 'DELETE' });
  },

  getHistory: (id: string): Promise<Appointment[]> => {
    return apiRequest<Appointment[]>(`/patients/${id}/history`);
  },
};

// --- Appointment API ---

export const appointmentApi = {
  list: (params?: { doctorId?: string; patientId?: string; status?: string; dateStart?: string; dateEnd?: string }): Promise<Appointment[]> => {
    const searchParams = new URLSearchParams();
    if (params?.doctorId) searchParams.set('doctorId', params.doctorId);
    if (params?.patientId) searchParams.set('patientId', params.patientId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.dateStart) searchParams.set('dateStart', params.dateStart);
    if (params?.dateEnd) searchParams.set('dateEnd', params.dateEnd);
    const query = searchParams.toString();
    return apiRequest<Appointment[]>(`/appointments${query ? `?${query}` : ''}`);
  },

  create: (input: CreateAppointmentInput): Promise<Appointment> => {
    return apiRequest<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: UpdateAppointmentInput): Promise<Appointment> => {
    return apiRequest<Appointment>(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  checkin: (id: string): Promise<Appointment> => {
    return apiRequest<Appointment>(`/appointments/${id}/checkin`, { method: 'POST' });
  },

  complete: (id: string): Promise<Appointment> => {
    return apiRequest<Appointment>(`/appointments/${id}/complete`, { method: 'POST' });
  },
};

// --- Billing API ---

export const billingApi = {
  list: (params?: { status?: string; dateStart?: string; dateEnd?: string }): Promise<BillingRecord[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.dateStart) searchParams.set('dateStart', params.dateStart);
    if (params?.dateEnd) searchParams.set('dateEnd', params.dateEnd);
    const query = searchParams.toString();
    return apiRequest<BillingRecord[]>(`/billing${query ? `?${query}` : ''}`);
  },

  submitClaim: (billingRecordId: string): Promise<BillingRecord> => {
    return apiRequest<BillingRecord>('/billing/claims', {
      method: 'POST',
      body: JSON.stringify({ billingRecordId }),
    });
  },

  followUpClaim: (claimId: string): Promise<BillingRecord> => {
    return apiRequest<BillingRecord>(`/billing/claims/${claimId}/followup`, {
      method: 'POST',
    });
  },

  getReports: (params: { dateStart: string; dateEnd: string }): Promise<BillingReport> => {
    const searchParams = new URLSearchParams();
    searchParams.set('dateStart', params.dateStart);
    searchParams.set('dateEnd', params.dateEnd);
    return apiRequest<BillingReport>(`/billing/reports?${searchParams.toString()}`);
  },
};
