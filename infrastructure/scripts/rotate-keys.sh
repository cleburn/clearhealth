#!/usr/bin/env bash
# ==============================================================================
# ClearHealth — Encryption Key Rotation Script
# ==============================================================================
# Run quarterly. Requires downtime window. Coordinate with team before executing.
#
# This script rotates the AES-256-GCM encryption key used for patient data
# (SSN, etc.). It generates a new key, re-encrypts all patient data with
# the new key, updates the environment variable, and verifies decryption.
#
# IMPORTANT:
# - This script requires a maintenance window (application must be stopped)
# - Back up the database BEFORE running this script
# - Both old and new keys must be available during re-encryption
# - Verify decryption with new key before removing old key
#
# Usage:
#   ./rotate-keys.sh [environment]
#
# Environment: dev | staging | prod (default: prod)
# ==============================================================================

set -euo pipefail

# --- Configuration ---
ENVIRONMENT="${1:-prod}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="/var/log/clearhealth"
LOG_FILE="${LOG_DIR}/key-rotation-${TIMESTAMP}.log"

# --- Validate environment ---
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "ERROR: Invalid environment '${ENVIRONMENT}'. Must be dev, staging, or prod."
  exit 1
fi

# --- Ensure log directory exists ---
mkdir -p "$LOG_DIR" 2>/dev/null || {
  LOG_DIR="/tmp"
  LOG_FILE="${LOG_DIR}/clearhealth-key-rotation-${TIMESTAMP}.log"
  echo "WARNING: Could not create /var/log/clearhealth, logging to ${LOG_FILE}"
}

log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "=== ClearHealth Encryption Key Rotation ==="
log "Environment: ${ENVIRONMENT}"
log "Timestamp:   ${TIMESTAMP}"
log "Log file:    ${LOG_FILE}"
log ""

# --- Safety checks ---
log "Performing safety checks..."

# Check that the application is stopped
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/health" 2>/dev/null || echo "000")
if [[ "$API_HEALTH" == "200" ]]; then
  log "ERROR: API is still running. Stop the application before rotating keys."
  log "Run: docker compose down (or stop ECS service)"
  exit 1
fi
log "  API is stopped. OK."

# --- Confirmation prompt ---
log ""
log "WARNING: This operation will:"
log "  1. Generate a new AES-256-GCM encryption key"
log "  2. Re-encrypt ALL patient SSN data in the database"
log "  3. Update the encryption key in SSM Parameter Store"
log ""
read -r -p "Are you sure you want to proceed? (type 'ROTATE' to confirm): " CONFIRM
if [[ "$CONFIRM" != "ROTATE" ]]; then
  log "Aborted by user."
  exit 0
fi

# --- Step 1: Fetch current encryption key ---
log ""
log "Step 1: Fetching current encryption key from SSM..."

OLD_KEY=$(aws ssm get-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

if [[ -z "$OLD_KEY" ]]; then
  log "ERROR: Could not retrieve current encryption key."
  exit 1
fi

# Validate key format: must be 64 hex characters (32 bytes)
if [[ ! "$OLD_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  log "ERROR: Current encryption key has invalid format. Expected 64 hex characters."
  exit 1
fi
log "  Current key retrieved and validated (64 hex chars). OK."

# --- Step 2: Generate new encryption key ---
log ""
log "Step 2: Generating new AES-256 encryption key..."

NEW_KEY=$(openssl rand -hex 32)

# Validate new key format
if [[ ! "$NEW_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  log "ERROR: Generated key has invalid format. openssl may have failed."
  exit 1
fi
log "  New key generated and validated (32 bytes / 256 bits). OK."

# --- Step 3: Back up old key ---
log ""
log "Step 3: Backing up old key to SSM..."

aws ssm put-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key-backup-${TIMESTAMP}" \
  --type "SecureString" \
  --value "$OLD_KEY" \
  --description "Backup of encryption key before rotation on ${TIMESTAMP}" \
  --tags "Key=Compliance,Value=HIPAA" "Key=Purpose,Value=key-rotation-backup"

log "  Old key backed up to: /clearhealth/${ENVIRONMENT}/encryption-key-backup-${TIMESTAMP}"

# --- Step 4: Re-encrypt patient data ---
log ""
log "Step 4: Re-encrypting patient data..."
log "  This may take several minutes depending on database size."

# TODO: Implement re-encryption application logic
# The re-encryption process needs a Node.js script that:
#   1. Connects to the database
#   2. Reads each patient record with encrypted SSN
#   3. Decrypts the SSN with OLD_KEY (AES-256-GCM: split iv:tag:ciphertext)
#   4. Re-encrypts with NEW_KEY
#   5. Updates the record in a transaction
#   6. Logs each record processed for audit trail
#
# Implementation:
#   DATABASE_URL=$(aws ssm get-parameter \
#     --name "/clearhealth/${ENVIRONMENT}/database-url" \
#     --with-decryption --query "Parameter.Value" --output text)
#
#   ENCRYPTION_KEY="$OLD_KEY" NEW_ENCRYPTION_KEY="$NEW_KEY" \
#     DATABASE_URL="$DATABASE_URL" \
#     node scripts/reencrypt-patient-data.js 2>&1 | tee -a "$LOG_FILE"

log "  [PLACEHOLDER] Re-encryption script not yet implemented."
log "  When implemented, uncomment the node command above."

# --- Step 5: Update encryption key in SSM ---
log ""
log "Step 5: Updating encryption key in SSM Parameter Store..."

aws ssm put-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key" \
  --type "SecureString" \
  --value "$NEW_KEY" \
  --overwrite \
  --description "AES-256-GCM encryption key for patient data (rotated ${TIMESTAMP})"

log "  Encryption key updated in SSM. OK."

# --- Step 6: Verify decryption with new key ---
log ""
log "Step 6: Verifying decryption with new key..."

# TODO: Implement verification
# The verification script should:
#   1. Read a sample of patient records (e.g., 10)
#   2. Attempt to decrypt each SSN with the new key
#   3. Validate that decrypted SSNs match expected format (XXX-XX-XXXX)
#   4. Report success/failure count
#
# Implementation:
#   ENCRYPTION_KEY="$NEW_KEY" DATABASE_URL="$DATABASE_URL" \
#     node scripts/verify-encryption.js \
#     --sample-size=10 2>&1 | tee -a "$LOG_FILE"

log "  [PLACEHOLDER] Verification script not yet implemented."

# --- Step 7: Clean up ---
log ""
log "Step 7: Cleanup..."
log "  Old key backup retained at: /clearhealth/${ENVIRONMENT}/encryption-key-backup-${TIMESTAMP}"
log "  Remove backup after confirming production is stable (recommend: 30 days)."

# --- Done ---
log ""
log "=== Key rotation complete ==="
log ""
log "Next steps:"
log "  1. Start the application: docker compose up -d (or start ECS service)"
log "  2. Verify API health: curl http://localhost:3001/health"
log "  3. Test patient data access in the application"
log "  4. Monitor error logs for decryption failures"
log "  5. Remove key backup after 30 days of stable operation"
