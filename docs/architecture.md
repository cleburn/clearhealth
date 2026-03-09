# ClearHealth — System Architecture

## Monorepo Structure

ClearHealth is organized as an npm workspaces monorepo with three packages:

### packages/api (Express REST API)

The backend API handles all business logic, data access, and integrations:

- **Routes:** Express routers for patients, appointments, billing, and auth
- **Middleware:** Authentication (JWT), audit logging, PII guard
- **Services:** Encryption, insurance verification, notifications
- **Utils:** Structured logging with PII redaction

### packages/web (Next.js Frontend)

The frontend provides role-specific interfaces:

- **Patient Portal:** Appointment booking, medical records, insurance info
- **Doctor View:** Schedule management, visit notes (SOAP format), patient history
- **Admin Dashboard:** Billing management, staff administration, reporting

### packages/shared (Types & Constants)

Shared code used by both API and web packages:

- **Types:** Patient, Appointment, Billing, Auth interfaces
- **Constants:** User roles, RBAC permission matrix

## Request Flow

```
Browser
  │
  ├── Static Assets ──→ Next.js (packages/web) ──→ CDN (S3/CloudFront)
  │
  └── API Requests ──→ ALB (HTTPS/TLS 1.3)
                         │
                         └──→ Express API (packages/api)
                                │
                                ├── Middleware Pipeline:
                                │   1. Helmet (security headers)
                                │   2. CORS (origin validation)
                                │   3. PII Guard (response scrubbing)
                                │   4. Auth (JWT verification)
                                │   5. Audit (access logging)
                                │
                                ├── Route Handler
                                │   └── Business Logic
                                │
                                ├──→ Prisma ORM ──→ PostgreSQL (encrypted)
                                ├──→ Redis (sessions, cache)
                                └──→ BullMQ (async jobs) ──→ Redis
```

## Authentication Flow

```
1. Login:     POST /api/v1/auth/login
              │
              ├── Validate credentials (bcrypt compare)
              ├── Generate JWT access token (15m expiry)
              ├── Generate refresh token (7d expiry)
              ├── Store refresh token in Redis
              ├── Log login to audit trail
              └── Return { accessToken, refreshToken, user }

2. Requests:  Authorization: Bearer <accessToken>
              │
              └── Auth middleware verifies JWT on every request

3. Refresh:   POST /api/v1/auth/refresh
              │
              ├── Validate refresh token against Redis
              ├── Rotate: invalidate old token, issue new pair
              └── Return { accessToken, refreshToken }

4. Logout:    POST /api/v1/auth/logout
              │
              ├── Remove refresh token from Redis
              └── Log logout to audit trail
```

## Background Job Flow

```
API Request (e.g., book appointment)
  │
  └──→ BullMQ Queue (Redis)
         │
         ├── appointmentReminder ──→ SendGrid (email) + Twilio (SMS)
         ├── insuranceVerification ──→ External Insurance API
         ├── billingSubmission ──→ Insurance Claims API
         └── reportGeneration ──→ S3 (encrypted PDF storage)
```

Jobs are processed asynchronously to avoid blocking API responses. Patient contact information is fetched fresh from the database for each notification (never cached) to respect data deletion requests.

## Data Encryption

### At Rest

| Layer | Method | Scope |
|-------|--------|-------|
| Application | AES-256-GCM | Patient SSN, sensitive PII fields |
| Database | RDS encryption | Entire database volume |
| Storage | S3 + KMS | Patient documents |
| Backups | KMS | Database backups on S3 |

### In Transit

- TLS 1.3 between client and ALB
- TLS between ALB and ECS tasks
- TLS between ECS tasks and RDS/ElastiCache

### Key Management

- Encryption key stored in AWS SSM Parameter Store (SecureString)
- Key rotation quarterly via `infrastructure/scripts/rotate-keys.sh`
- Rotation requires downtime window for re-encryption of patient data
- Old keys backed up in SSM for rollback capability

## Multi-Tenancy

ClearHealth supports multiple clinics (tenants) on a shared infrastructure:

- **Database:** All tables include a `tenantId` foreign key
- **API:** Auth middleware extracts `tenantId` from JWT and attaches to request
- **Queries:** All database queries filter by `tenantId` (enforced by middleware)
- **Isolation:** Tenant A cannot access Tenant B's data at any layer
- **SUPER_ADMIN:** Only role that can access data across tenants (for platform operations)

## Infrastructure (AWS)

```
┌─────────────────────────────────────────────────────┐
│                      VPC                             │
│                                                     │
│  ┌─────────── Public Subnets ──────────┐            │
│  │  ALB (HTTPS) ← Internet Gateway    │            │
│  └────────────────────────────────────-─┘            │
│                    │                                 │
│  ┌─────────── Private Subnets ─────────┐            │
│  │  ECS Fargate (API containers)       │            │
│  │       │              │              │            │
│  │  RDS PostgreSQL  ElastiCache Redis  │            │
│  │  (encrypted)     (encrypted)        │            │
│  └─────────────────────────────────────┘            │
│                                                     │
│  S3 (patient documents, encrypted with KMS)         │
│  CloudWatch (logs, 90-day retention)                │
└─────────────────────────────────────────────────────┘
```
