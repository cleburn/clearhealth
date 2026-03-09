# ClearHealth

Multi-tenant appointment management platform for small clinic networks. Built for healthcare organizations that need secure, HIPAA-compliant scheduling, patient records, and billing management.

## Overview

ClearHealth enables clinics to manage their entire patient workflow:

- **Patients** book appointments, view medical records, and manage insurance information
- **Doctors** manage schedules, write SOAP-format visit notes, and view patient histories
- **Clinic Administrators** handle billing, insurance claims, staff management, and reporting
- **Background Jobs** process appointment reminders, insurance verification, and report generation

## Team Structure

| Role | Scope | Count |
|------|-------|-------|
| Frontend Developers | Patient portal + admin dashboard (`packages/web`) | 2 |
| Backend Developers | API, business logic, integrations (`packages/api`) | 2 |
| Database/Data Engineer | Schema design, migrations, data pipelines (`prisma/`) | 1 |
| DevOps Engineer | Infrastructure, CI/CD, monitoring (`infrastructure/`) | 1 |
| QA Lead | Test strategy, compliance validation | 1 |

## Architecture

ClearHealth is organized as a monorepo with three packages:

```
clearhealth/
├── packages/
│   ├── api/          # Express REST API (Node.js, TypeScript)
│   ├── web/          # Next.js 14 frontend (App Router, Tailwind, shadcn/ui)
│   └── shared/       # Shared TypeScript types and constants
├── prisma/           # Database schema and migrations (PostgreSQL via Prisma)
├── infrastructure/   # Terraform (AWS) and operational scripts
├── docs/             # Architecture, compliance, and API documentation
└── data/             # Synthetic test data (local development only)
```

### Request Flow

```
Client (Browser)
  → Next.js Frontend (packages/web)
  → Application Load Balancer (HTTPS/TLS 1.3)
  → Express API (packages/api)
  → Prisma ORM
  → PostgreSQL (encrypted at rest)
```

### Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend:** Node.js 20, Express, TypeScript
- **Database:** PostgreSQL 15 via Prisma ORM
- **Cache/Queue:** Redis 7 (session store + BullMQ job queue)
- **Auth:** JWT with refresh token rotation, bcrypt password hashing
- **Infrastructure:** AWS (ECS Fargate, RDS, ElastiCache, S3), Terraform
- **CI/CD:** GitHub Actions
- **Containerization:** Docker with multi-stage builds

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm 10+

### Getting Started

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd clearhealth
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

3. **Start infrastructure services:**
   ```bash
   npm run docker:up
   # Starts PostgreSQL (port 5432) and Redis (port 6379)
   ```

4. **Run database migrations and seed:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development servers:**
   ```bash
   npm run dev
   # API: http://localhost:3001
   # Web: http://localhost:3000
   ```

### Environment Variables

See `.env.example` for all required environment variables with descriptions. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Token signing keys
- `ENCRYPTION_KEY` — AES-256-GCM key for patient data encryption

**Never commit `.env` files with real values.**

## Branch Strategy

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production releases | No direct pushes, requires PR + approval + passing CI |
| `staging` | Pre-production testing | No direct pushes, requires PR + approval |
| `feat/*` | New features | Created from `staging` |
| `fix/*` | Bug fixes | Created from `staging` |
| `hotfix/*` | Critical production fixes | Created from `main` only |

### Pull Request Requirements

- At least one approval from a code owner
- All CI checks passing (lint, typecheck, tests, security audit, PII scan)
- No direct pushes to `main` or `staging`
- Squash merge only

## Compliance

ClearHealth handles Protected Health Information (PHI) and must comply with HIPAA regulations:

- **Access Controls:** Role-based access (RBAC) with tenant isolation and mandatory audit logging
- **Encryption:** Patient data encrypted at rest (AES-256-GCM) and in transit (TLS 1.3)
- **Audit Trail:** Every access to patient data is logged with userId, action, timestamp, and IP address
- **Data Retention:** Medical records retained for minimum 6 years; database backups retained 90 days
- **PII Handling:** SSNs encrypted, masked in API responses, never logged, never cached on the client
- **Security Reviews:** Required for changes to authentication, encryption, patient data routes, or infrastructure

For full compliance documentation, see [docs/compliance.md](docs/compliance.md).

## Project Documentation

- [Architecture Overview](docs/architecture.md)
- [Data Model Reference](docs/data-model.md)
- [HIPAA Compliance](docs/compliance.md)
- [API Reference](docs/api-reference.md)
- [Contributing Guide](CONTRIBUTING.md)
