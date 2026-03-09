# ClearHealth — API Reference

## Base URL

```
Production: https://api.clearhealth.example.com/api/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All endpoints (except auth routes) require a valid JWT access token:

```
Authorization: Bearer <access_token>
```

Tokens expire after 15 minutes. Use the refresh endpoint to obtain a new token.

## Error Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

Common error codes:
| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `FORBIDDEN` | 403 | Insufficient role/permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

| Endpoint Group | Limit |
|---------------|-------|
| Auth (`/auth/*`) | 100 requests/minute |
| All authenticated endpoints | 1,000 requests/minute |

Rate limit headers are included in every response:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1706234400
```

---

## Auth Endpoints

### POST /auth/login

Authenticate with email and password.

**Request:**
```json
{
  "email": "doctor@clearview.clinic",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "dGhpcyBpcyBh...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "tenantId": "uuid",
    "email": "doctor@clearview.clinic",
    "role": "DOCTOR",
    "firstName": "Sarah",
    "lastName": "Chen"
  }
}
```

### POST /auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "dGhpcyBpcyBh..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "bmV3IHJlZnJlc2g...",
  "expiresIn": 900
}
```

### POST /auth/logout

Invalidate the current refresh token.

**Request:**
```json
{
  "refreshToken": "dGhpcyBpcyBh..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### POST /auth/forgot-password

Initiate password reset. Always returns 200 regardless of whether the email exists (prevents enumeration).

**Request:**
```json
{
  "email": "user@clearview.clinic"
}
```

**Response (200):**
```json
{
  "message": "If an account exists with this email, a reset link has been sent."
}
```

### POST /auth/reset-password

Complete password reset with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

## Patient Endpoints

### GET /patients

List patients (paginated, tenant-scoped).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| search | string | Search by name or MRN |

**Access:** DOCTOR (assigned only), ADMIN, SUPER_ADMIN

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "medicalRecordNumber": "MRN-2024-001",
      "insurancePlan": "Blue Cross PPO",
      "dateOfBirthYear": 1985,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /patients/:id

Get full patient record (PII included for authorized viewers).

**Access:** PATIENT (own), DOCTOR (assigned), ADMIN, SUPER_ADMIN

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "dateOfBirth": "1985-03-15",
  "ssn": "***-**-4567",
  "insuranceId": "INS-12345",
  "insurancePlan": "Blue Cross PPO",
  "medicalRecordNumber": "MRN-2024-001",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-0123",
  "notes": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-02-01T14:22:00Z"
}
```

Note: SSN is always masked in responses (`***-**-XXXX`).

### POST /patients

Create a new patient record.

**Access:** ADMIN, SUPER_ADMIN

**Request:**
```json
{
  "userId": "uuid",
  "dateOfBirth": "1985-03-15",
  "ssn": "123-45-6789",
  "insuranceId": "INS-12345",
  "insurancePlan": "Blue Cross PPO",
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-0123"
}
```

**Response (201):** Created patient object (SSN masked).

### PATCH /patients/:id

Update patient record.

**Access:** PATIENT (limited fields), ADMIN, SUPER_ADMIN

### DELETE /patients/:id

Soft delete patient (sets `isActive = false`).

**Access:** ADMIN, SUPER_ADMIN

### GET /patients/:id/history

Full appointment and visit history.

**Access:** PATIENT (own), DOCTOR (assigned), ADMIN, SUPER_ADMIN

---

## Appointment Endpoints

### GET /appointments

List appointments with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| doctorId | uuid | Filter by doctor |
| patientId | uuid | Filter by patient |
| dateStart | ISO date | Start of date range |
| dateEnd | ISO date | End of date range |
| status | enum | Filter by status |
| type | enum | Filter by type |
| page | number | Page number |
| limit | number | Items per page |

**Access:** PATIENT (own), DOCTOR (assigned), ADMIN, SUPER_ADMIN

### POST /appointments

Book a new appointment.

**Access:** PATIENT (self-booking), ADMIN, SUPER_ADMIN

**Request:**
```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "scheduledAt": "2024-03-20T10:00:00Z",
  "duration": 30,
  "type": "FOLLOW_UP",
  "notes": "Annual checkup"
}
```

### PATCH /appointments/:id

Update or cancel an appointment.

**Access:** PATIENT (cancel only), DOCTOR (assigned), ADMIN, SUPER_ADMIN

### POST /appointments/:id/checkin

Mark patient as checked in.

**Access:** ADMIN, SUPER_ADMIN

### POST /appointments/:id/complete

Complete appointment (triggers billing).

**Access:** DOCTOR (assigned), ADMIN, SUPER_ADMIN

---

## Billing Endpoints

### GET /billing

List billing records.

**Access:** PATIENT (own), ADMIN, SUPER_ADMIN

### POST /billing/claims

Submit an insurance claim.

**Access:** ADMIN, SUPER_ADMIN

### POST /billing/claims/:id/followup

Follow up on a pending claim.

**Access:** ADMIN, SUPER_ADMIN

### GET /billing/reports

Generate billing reports.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| dateStart | ISO date | Report period start |
| dateEnd | ISO date | Report period end |
| groupBy | string | provider, status, period |

**Access:** ADMIN, SUPER_ADMIN

---

## Health Check

### GET /health

Public endpoint for load balancer health checks.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T15:30:00Z"
}
```
