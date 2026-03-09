# ClearHealth — Data Model Reference

## Overview

ClearHealth uses PostgreSQL 15 with Prisma ORM. The data model supports multi-tenancy, HIPAA-compliant record keeping, and comprehensive audit logging.

All models are defined in `prisma/schema.prisma`.

## Entity Relationship Diagram

```
Tenant
 ├── User (1:N)
 │    ├── Patient (1:1, optional)
 │    │    ├── Appointment (1:N)
 │    │    ├── BillingRecord (1:N)
 │    │    └── InsuranceVerification (1:N)
 │    ├── Doctor (1:1, optional)
 │    │    ├── Appointment (1:N)
 │    │    └── VisitNote (1:N)
 │    └── AuditLog (1:N)
 ├── Appointment (1:N)
 │    ├── VisitNote (1:1, optional)
 │    └── BillingRecord (1:1, optional)
 ├── BillingRecord (1:N)
 └── AuditLog (1:N)
```

## Models

### Tenant

Represents a clinic or healthcare organization. All data is scoped to a tenant for isolation.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Organization display name |
| slug | String | Unique URL-friendly identifier |
| settings | JSON | Tenant configuration (timezone, hours, defaults) |
| createdAt | DateTime | Record creation timestamp |

### User

Represents any authenticated user in the system. Role determines access level.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| email | String | Unique within tenant |
| passwordHash | String | **Sensitive** — bcrypt hash, never exposed in API |
| role | Enum | PATIENT, DOCTOR, ADMIN, SUPER_ADMIN |
| firstName | String | Display name |
| lastName | String | Display name |
| phone | String? | **PII** — Optional contact number |
| isActive | Boolean | Soft delete flag |
| lastLoginAt | DateTime? | Last successful authentication |

**Indexes:** tenantId, email, role

### Patient

Extended profile for users with the PATIENT role. Contains protected health information.

| Field | Type | PII | Notes |
|-------|------|-----|-------|
| id | UUID | | Primary key |
| userId | UUID | | FK to User (1:1) |
| dateOfBirth | DateTime | Yes | Date of birth |
| ssn | String | **Encrypted** | AES-256-GCM encrypted SSN. Never returned raw. |
| insuranceId | String? | Yes | Insurance member ID |
| insurancePlan | String? | | Plan name (e.g., "Blue Cross PPO") |
| medicalRecordNumber | String | | Unique internal MRN |
| emergencyContactName | String? | Yes | Emergency contact |
| emergencyContactPhone | String? | Yes | Emergency contact phone |
| notes | String? | | Administrative notes |

**Indexes:** medicalRecordNumber, insuranceId

### Doctor

Extended profile for users with the DOCTOR role.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK to User (1:1) |
| specialization | String | Medical specialty (e.g., "Family Medicine") |
| licenseNumber | String | Unique medical license — verified during onboarding |
| scheduleConfig | JSON | Weekly template: `{ dayOfWeek: { start, end, slotDuration } }` |

**Indexes:** specialization

### Appointment

Represents a scheduled patient-doctor interaction.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| patientId | UUID | FK to Patient |
| doctorId | UUID | FK to Doctor |
| scheduledAt | DateTime | Appointment date and time |
| duration | Int | Duration in minutes |
| status | Enum | SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW |
| type | Enum | INITIAL, FOLLOW_UP, URGENT, TELEHEALTH |
| notes | String? | Scheduling notes |

**Indexes:** tenantId, patientId, doctorId, scheduledAt, status

### VisitNote

SOAP-format clinical note attached to a completed appointment.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| appointmentId | UUID | FK to Appointment (1:1) |
| doctorId | UUID | FK to Doctor |
| subjective | String | Patient's reported symptoms |
| objective | String | Doctor's clinical observations |
| assessment | String | Diagnosis and assessment |
| plan | String | Treatment plan |
| isSigned | Boolean | Once signed, notes are immutable (legal medical record) |
| signedAt | DateTime? | Timestamp of signature |

**Important:** Signed visit notes cannot be modified. They are part of the legal medical record.

### BillingRecord

Tracks insurance claims and payment status for appointments.

| Field | Type | PII | Notes |
|-------|------|-----|-------|
| id | UUID | | Primary key |
| tenantId | UUID | | FK to Tenant |
| appointmentId | UUID | | FK to Appointment (1:1) |
| patientId | UUID | | FK to Patient |
| insuranceClaim | JSON | Yes | Full claim payload — contains patient PII |
| amount | Decimal | | Charge amount in dollars |
| status | Enum | | PENDING, SUBMITTED, APPROVED, DENIED, PAID |
| cptCodes | String[] | | CPT procedure codes |
| icdCodes | String[] | | ICD-10 diagnosis codes |

**Indexes:** tenantId, patientId, status

### AuditLog

Immutable access log for HIPAA compliance. Records every operation on patient data.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| userId | UUID | FK to User (acting user) |
| action | String | READ, CREATE, UPDATE, DELETE, LOGIN, EXPORT |
| resource | String | patient, appointment, billing, visit_note |
| resourceId | String? | ID of the affected record |
| metadata | JSON | Additional context (method, path, query params) |
| ipAddress | String | Client IP for access tracking |
| timestamp | DateTime | When the access occurred |

**Indexes:** tenantId, userId, (resource + resourceId), timestamp

**Important:** Audit logs are append-only. They cannot be modified or deleted through the application.

### InsuranceVerification

Cached results of insurance eligibility checks.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| patientId | UUID | FK to Patient |
| verifiedAt | DateTime | When verification was performed |
| status | String | ACTIVE, INACTIVE, PENDING, EXPIRED |
| response | JSON | Raw API response from insurance provider |
| expiresAt | DateTime | When this verification result expires |

**Indexes:** patientId, expiresAt

## PII Protection Summary

| Field | Model | Protection |
|-------|-------|------------|
| ssn | Patient | AES-256-GCM encryption, masked in API responses, hashed for lookup |
| dateOfBirth | Patient | Marked PII, year-only in list views |
| insuranceId | Patient | Marked PII, filtered from non-authorized responses |
| emergencyContactName | Patient | Marked PII |
| emergencyContactPhone | Patient | Marked PII |
| phone | User | Marked PII |
| passwordHash | User | bcrypt, never exposed in API |
| insuranceClaim | BillingRecord | Contains patient PII, filtered in responses |

## Soft Delete Strategy

HIPAA requires retention of medical records for a minimum of 6 years. ClearHealth uses soft deletes:

- `User.isActive` is set to `false` instead of deleting the record
- All related Patient, Appointment, and BillingRecord data is preserved
- Soft-deleted users cannot log in but their records remain queryable by admins
- Hard deletion (permanent removal) requires SUPER_ADMIN approval and is logged separately

## Query Patterns

All queries involving patient data follow these patterns:

1. **Tenant scoping:** `WHERE tenantId = :tenantId` on every query
2. **Role filtering:** PATIENT sees own data, DOCTOR sees assigned patients, ADMIN sees tenant-wide
3. **Audit logging:** Every query triggers an audit log entry via middleware
4. **PII masking:** SSN and other PII fields are masked/encrypted in responses
