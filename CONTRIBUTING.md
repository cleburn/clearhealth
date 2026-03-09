# Contributing to ClearHealth

Thank you for contributing to ClearHealth. This guide covers our development workflow, coding standards, and review process. Because ClearHealth handles Protected Health Information (PHI), we have strict requirements around security, PII handling, and compliance.

## Branch Naming Conventions

All branches must follow this naming scheme:

| Prefix | Use Case | Base Branch |
|--------|----------|-------------|
| `feat/` | New features | `staging` |
| `fix/` | Bug fixes | `staging` |
| `hotfix/` | Critical production fixes | `main` |
| `chore/` | Maintenance, dependencies, tooling | `staging` |

Examples:
- `feat/appointment-reminders`
- `fix/ssn-masking-in-billing`
- `hotfix/auth-token-expiry`
- `chore/upgrade-prisma`

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]

[optional footer]
```

Types:
- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance, dependencies, tooling
- `docs:` — Documentation changes
- `refactor:` — Code refactoring (no feature or fix)
- `test:` — Adding or updating tests
- `ci:` — CI/CD pipeline changes

Examples:
```
feat: add appointment reminder notifications via SMS

fix: mask SSN in billing report export

chore: upgrade Prisma to 5.9.0

docs: update API reference for billing endpoints
```

## Pull Request Process

### Workflow

1. **Create a draft PR** when you start work — this signals to the team what you're building
2. **Develop** on your feature branch with conventional commits
3. **Mark as ready for review** when implementation and tests are complete
4. **Address review feedback** with new commits (do not force-push during review)
5. **Squash merge** after approval — the PR title becomes the merge commit message

### PR Requirements

Before requesting review, ensure:

- [ ] All CI checks pass (lint, typecheck, tests, security audit, PII scan)
- [ ] New endpoints have corresponding tests
- [ ] New data structures have TypeScript types in `packages/shared`
- [ ] PR description explains what changed and why
- [ ] Screenshots included for UI changes

### Code Review Checklist

Reviewers should verify:

- [ ] **No PII in logs** — patient names, SSNs, DOBs, and insurance IDs must never appear in log output
- [ ] **No hardcoded secrets** — API keys, passwords, and tokens must come from environment variables
- [ ] **Tests for new endpoints** — all new API routes must have test coverage
- [ ] **Types for new data structures** — all new data shapes must have TypeScript interfaces in `packages/shared`
- [ ] **Tenant scoping** — all database queries involving patient data must filter by `tenantId`
- [ ] **Audit logging** — all patient data access must be logged via the audit middleware

### Security Review Required

The following changes **require an explicit security review** from a backend team lead before merge:

- Any change to authentication or authorization logic (`packages/api/src/middleware/auth.ts`)
- Any change to encryption services (`packages/api/src/services/encryption.ts`)
- Any change to patient data routes (`packages/api/src/routes/patients.ts`)
- Any change to PII guard middleware (`packages/api/src/middleware/pii-guard.ts`)
- Any infrastructure change (`infrastructure/`)
- Any change to the Prisma schema that adds or modifies PII fields
- Any change to CI/CD pipelines (`.github/workflows/`)

## Code Ownership

| Path | Owner | Review Required From |
|------|-------|---------------------|
| `packages/web/` | Frontend team | At least 1 frontend developer |
| `packages/api/` | Backend team | At least 1 backend developer |
| `packages/shared/` | Cross-team | 1 frontend + 1 backend developer |
| `prisma/` | Database engineer | Database engineer + 1 backend developer |
| `infrastructure/` | DevOps engineer | DevOps engineer + backend team lead |
| `.github/workflows/` | DevOps engineer | DevOps engineer |
| `docs/` | Any team member | At least 1 reviewer |

## Development Guidelines

### TypeScript

- Strict mode is enabled — no `any` types without justification
- All new data structures must be defined in `packages/shared/src/types/`
- Use Zod for runtime validation at API boundaries

### Security

- Never log PII (patient names, SSNs, DOBs, insurance IDs) — use `patient.id` for correlation
- Never store PII in frontend state beyond form submission
- Always use the encryption service for SSN storage
- Always apply audit middleware to patient-related routes
- Always scope database queries by `tenantId`

### Testing

- Use Vitest for unit and integration tests
- Use Supertest for API endpoint testing
- Test files go in `tests/` directory within each package
- Name test files as `*.test.ts` or `*.spec.ts`

## Getting Help

- Check [docs/architecture.md](docs/architecture.md) for system overview
- Check [docs/api-reference.md](docs/api-reference.md) for endpoint documentation
- Check [docs/compliance.md](docs/compliance.md) for HIPAA requirements
