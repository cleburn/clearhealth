# ClearHealth — HIPAA Compliance

This document describes how ClearHealth addresses HIPAA (Health Insurance Portability and Accountability Act) requirements for protecting patient health information (PHI).

## Access Controls

### Role-Based Access Control (RBAC)

ClearHealth enforces role-based access at both the API and frontend layers:

| Role | Access Scope |
|------|-------------|
| PATIENT | Own records only |
| DOCTOR | Assigned patient records only |
| ADMIN | All records within their tenant/clinic |
| SUPER_ADMIN | All records across all tenants (platform operations) |

The permission matrix is defined in `packages/shared/src/constants/permissions.ts` and enforced by:
- API middleware (`packages/api/src/middleware/auth.ts`)
- Frontend route guards (`packages/web/src/hooks/useAuth.ts`)

### Tenant Isolation

All data is scoped by tenant (clinic). Tenant isolation is enforced at:
- Database level: all queries include `WHERE tenantId = :tenantId`
- API level: `tenantId` extracted from JWT and injected into every query
- A user from Tenant A can never access Tenant B's data

### Authentication

- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens expire in 15 minutes
- Refresh tokens stored in Redis, rotated on each use (prevents replay)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- All authentication events logged in the audit trail

## Data Encryption

### At Rest

| Data | Method | Key Management |
|------|--------|---------------|
| Patient SSN | AES-256-GCM (application layer) | AWS SSM Parameter Store (SecureString) |
| Database volume | AWS RDS encryption | AWS KMS managed key |
| Patient documents | S3 server-side encryption | AWS KMS customer-managed key |
| Database backups | S3 + KMS encryption | AWS KMS managed key |

Application-level encryption (AES-256-GCM) provides defense in depth — even if database-level encryption is compromised, patient SSNs remain protected by a separate application-managed key.

### In Transit

| Connection | Protocol |
|-----------|----------|
| Client to ALB | TLS 1.3 (enforced via HSTS) |
| ALB to API | TLS |
| API to PostgreSQL | TLS (enforced by RDS) |
| API to Redis | TLS (enforced by ElastiCache) |

### Key Rotation

- Encryption keys are rotated quarterly
- Rotation process: `infrastructure/scripts/rotate-keys.sh`
- Requires a maintenance window (application stopped during re-encryption)
- Old keys are backed up in SSM for 30 days for rollback capability

## Audit Trail

### What Is Logged

Every access to patient data is recorded in the `AuditLog` table:

| Field | Description |
|-------|-------------|
| userId | Who performed the action |
| action | What they did (READ, CREATE, UPDATE, DELETE, LOGIN, EXPORT) |
| resource | What resource type (patient, appointment, billing, visit_note) |
| resourceId | Which specific record |
| ipAddress | Client IP address |
| timestamp | When it happened |
| metadata | Additional context (HTTP method, path, query parameters) |

### Implementation

- Audit middleware (`packages/api/src/middleware/audit.ts`) is applied to all patient-related routes
- Audit logs are append-only — they cannot be modified or deleted through the application
- Direct database deletion requires SUPER_ADMIN access and is itself audited at the infrastructure level

### Retention

- Audit logs are retained indefinitely in the database
- CloudWatch logs retained for 90 days
- Database backups retained for 90 days (HIPAA minimum)

## Data Retention

| Data Type | Retention Period | Rationale |
|-----------|-----------------|-----------|
| Medical records | 6 years minimum | HIPAA / state regulations |
| Audit logs | Indefinite | Compliance evidence |
| Database backups | 90 days | HIPAA minimum |
| CloudWatch logs | 90 days | Operational + compliance |
| Insurance verification cache | 24 hours | Redis TTL, re-verified as needed |

### Soft Deletes

Patient records are never hard-deleted through the application:
- `User.isActive` is set to `false` (soft delete)
- All associated data (appointments, visit notes, billing) is preserved
- Hard deletion requires SUPER_ADMIN approval and explicit justification

## Breach Notification

### Monitoring

- CloudWatch alarms for unusual API patterns (spike in patient data access)
- Failed login attempt tracking with automatic account lockout
- PII guard middleware (`packages/api/src/middleware/pii-guard.ts`) logs warnings when PII patterns are detected in responses

### Incident Response

1. **Detection:** Automated monitoring alerts or manual discovery
2. **Containment:** Revoke compromised credentials, isolate affected systems
3. **Assessment:** Determine scope of breach (which records, which patients)
4. **Notification:** Notify affected individuals within 60 days (HIPAA requirement)
5. **Remediation:** Fix vulnerability, update security controls, document lessons learned

### Contact

Security incidents should be reported immediately to the engineering team lead and compliance officer.

## PII Handling

### SSN (Social Security Number)

1. **Input:** Validated on intake forms (`XXX-XX-XXXX` format)
2. **Transmission:** Sent over TLS to the API
3. **Storage:** Encrypted with AES-256-GCM before database storage
4. **Retrieval:** Decrypted server-side, masked in API responses (`***-**-1234`)
5. **Logging:** Never logged — PII redaction runs on all log output
6. **Caching:** Never cached on the client or in Redis
7. **Lookup:** HMAC-SHA256 hash enables search without decryption

### Defense in Depth

Multiple layers prevent PII leakage:

1. **Application code:** Encryption service encrypts before storage, masks before response
2. **PII guard middleware:** Scans all outgoing responses for SSN patterns
3. **Logger:** PII redaction applied to all log output
4. **CI pipeline:** PII pattern scanner checks source code on every PR
5. **Infrastructure:** Database and storage encryption at rest

## Business Associate Agreements (BAA)

HIPAA requires BAAs with all third-party services that handle PHI:

| Service | Purpose | BAA Required |
|---------|---------|-------------|
| AWS | Infrastructure (RDS, S3, ECS) | Yes — AWS HIPAA BAA |
| SendGrid | Appointment reminder emails | Yes |
| Twilio | Appointment reminder SMS | Yes |
| Insurance Verification API | Insurance eligibility checks | Yes |

All third-party integrations that handle patient data must have a signed BAA before production use.
