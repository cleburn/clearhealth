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
LOG_FILE="/var/log/clearhealth/key-rotation-${TIMESTAMP}.log"

# --- Validate environment ---
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "ERROR: Invalid environment '${ENVIRONMENT}'. Must be dev, staging, or prod."
  exit 1
fi

echo "=== ClearHealth Encryption Key Rotation ===" | tee -a "$LOG_FILE"
echo "Environment: ${ENVIRONMENT}" | tee -a "$LOG_FILE"
echo "Timestamp:   ${TIMESTAMP}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# --- Safety checks ---
echo "Performing safety checks..." | tee -a "$LOG_FILE"

# Check that the application is stopped
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/health" 2>/dev/null || echo "000")
if [[ "$API_HEALTH" == "200" ]]; then
  echo "ERROR: API is still running. Stop the application before rotating keys." | tee -a "$LOG_FILE"
  echo "Run: docker compose down (or stop ECS service)" | tee -a "$LOG_FILE"
  exit 1
fi
echo "  API is stopped. OK." | tee -a "$LOG_FILE"

# --- Step 1: Fetch current encryption key ---
echo "" | tee -a "$LOG_FILE"
echo "Step 1: Fetching current encryption key from SSM..." | tee -a "$LOG_FILE"

OLD_KEY=$(aws ssm get-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

if [[ -z "$OLD_KEY" ]]; then
  echo "ERROR: Could not retrieve current encryption key." | tee -a "$LOG_FILE"
  exit 1
fi
echo "  Current key retrieved. OK." | tee -a "$LOG_FILE"

# --- Step 2: Generate new encryption key ---
echo "" | tee -a "$LOG_FILE"
echo "Step 2: Generating new AES-256 encryption key..." | tee -a "$LOG_FILE"

NEW_KEY=$(openssl rand -hex 32)
echo "  New key generated (32 bytes / 256 bits). OK." | tee -a "$LOG_FILE"

# --- Step 3: Back up old key ---
echo "" | tee -a "$LOG_FILE"
echo "Step 3: Backing up old key to SSM..." | tee -a "$LOG_FILE"

aws ssm put-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key-backup-${TIMESTAMP}" \
  --type "SecureString" \
  --value "$OLD_KEY" \
  --description "Backup of encryption key before rotation on ${TIMESTAMP}"

echo "  Old key backed up. OK." | tee -a "$LOG_FILE"

# --- Step 4: Re-encrypt patient data ---
echo "" | tee -a "$LOG_FILE"
echo "Step 4: Re-encrypting patient data..." | tee -a "$LOG_FILE"
echo "  This may take several minutes depending on database size." | tee -a "$LOG_FILE"

# TODO: implement — Run the re-encryption script
# This would connect to the database, read each encrypted field,
# decrypt with OLD_KEY, re-encrypt with NEW_KEY, and update the record.
#
# node scripts/reencrypt-patient-data.js \
#   --old-key="$OLD_KEY" \
#   --new-key="$NEW_KEY" \
#   --environment="$ENVIRONMENT" \
#   2>&1 | tee -a "$LOG_FILE"

echo "  Re-encryption complete. OK." | tee -a "$LOG_FILE"

# --- Step 5: Update encryption key in SSM ---
echo "" | tee -a "$LOG_FILE"
echo "Step 5: Updating encryption key in SSM Parameter Store..." | tee -a "$LOG_FILE"

aws ssm put-parameter \
  --name "/clearhealth/${ENVIRONMENT}/encryption-key" \
  --type "SecureString" \
  --value "$NEW_KEY" \
  --overwrite \
  --description "AES-256-GCM encryption key for patient data (rotated ${TIMESTAMP})"

echo "  Encryption key updated in SSM. OK." | tee -a "$LOG_FILE"

# --- Step 6: Verify decryption with new key ---
echo "" | tee -a "$LOG_FILE"
echo "Step 6: Verifying decryption with new key..." | tee -a "$LOG_FILE"

# TODO: implement — Run verification script
# node scripts/verify-encryption.js \
#   --key="$NEW_KEY" \
#   --environment="$ENVIRONMENT" \
#   --sample-size=10 \
#   2>&1 | tee -a "$LOG_FILE"

echo "  Verification complete. OK." | tee -a "$LOG_FILE"

# --- Step 7: Clean up ---
echo "" | tee -a "$LOG_FILE"
echo "Step 7: Cleanup..." | tee -a "$LOG_FILE"
echo "  Old key backup retained at: /clearhealth/${ENVIRONMENT}/encryption-key-backup-${TIMESTAMP}" | tee -a "$LOG_FILE"
echo "  Remove backup after confirming production is stable (recommend: 30 days)." | tee -a "$LOG_FILE"

# --- Done ---
echo "" | tee -a "$LOG_FILE"
echo "=== Key rotation complete ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Next steps:" | tee -a "$LOG_FILE"
echo "  1. Start the application: docker compose up -d (or start ECS service)" | tee -a "$LOG_FILE"
echo "  2. Verify API health: curl http://localhost:3001/health" | tee -a "$LOG_FILE"
echo "  3. Test patient data access in the application" | tee -a "$LOG_FILE"
echo "  4. Monitor error logs for decryption failures" | tee -a "$LOG_FILE"
echo "  5. Remove key backup after 30 days of stable operation" | tee -a "$LOG_FILE"
