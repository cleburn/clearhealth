#!/usr/bin/env bash
# ==============================================================================
# ClearHealth — Database Backup Script
# ==============================================================================
# Runs nightly via cron. Backups encrypted with AWS KMS.
#
# Creates a pg_dump backup of the ClearHealth PostgreSQL database and
# uploads it to an encrypted S3 bucket. Retains backups for 90 days
# (HIPAA minimum retention period).
#
# Usage:
#   ./backup-db.sh [environment]
#
# Environment: dev | staging | prod (default: prod)
# ==============================================================================

set -euo pipefail

# --- Configuration ---
ENVIRONMENT="${1:-prod}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_BUCKET="clearhealth-${ENVIRONMENT}-backups"
BACKUP_KEY="database/${TIMESTAMP}/clearhealth_${ENVIRONMENT}.sql.gz"
RETENTION_DAYS=90  # HIPAA minimum backup retention
TEMP_DIR=$(mktemp -d)
BACKUP_FILE="${TEMP_DIR}/clearhealth_${ENVIRONMENT}.sql.gz"

# --- Validate environment ---
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "ERROR: Invalid environment '${ENVIRONMENT}'. Must be dev, staging, or prod."
  exit 1
fi

echo "=== ClearHealth Database Backup ==="
echo "Environment: ${ENVIRONMENT}"
echo "Timestamp:   ${TIMESTAMP}"
echo "Bucket:      s3://${BACKUP_BUCKET}/${BACKUP_KEY}"

# --- Fetch database credentials from SSM ---
echo "Fetching database URL from SSM Parameter Store..."
DATABASE_URL=$(aws ssm get-parameter \
  --name "/clearhealth/${ENVIRONMENT}/database-url" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: Could not retrieve DATABASE_URL from SSM."
  # Notify team of backup failure
  aws sns publish \
    --topic-arn "arn:aws:sns:us-east-1:ACCOUNT_ID:clearhealth-${ENVIRONMENT}-alerts" \
    --subject "BACKUP FAILED: ClearHealth ${ENVIRONMENT}" \
    --message "Database backup failed at ${TIMESTAMP}. Could not retrieve database credentials." \
    || true
  exit 1
fi

# --- Create backup ---
echo "Starting pg_dump..."
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  2>&1 | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# --- Upload to S3 (encrypted with KMS) ---
echo "Uploading to S3..."
aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_BUCKET}/${BACKUP_KEY}" \
  --sse aws:kms \
  --sse-kms-key-id "alias/clearhealth-${ENVIRONMENT}-backup-key" \
  --storage-class STANDARD_IA

echo "Upload complete."

# --- Clean up old backups beyond retention period ---
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +"%Y%m%d" 2>/dev/null || date -v-${RETENTION_DAYS}d +"%Y%m%d")

aws s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" \
  --prefix "database/" \
  --query "Contents[?LastModified<='${CUTOFF_DATE}'].Key" \
  --output text | tr '\t' '\n' | while read -r key; do
    if [[ -n "$key" && "$key" != "None" ]]; then
      echo "  Deleting: s3://${BACKUP_BUCKET}/${key}"
      aws s3 rm "s3://${BACKUP_BUCKET}/${key}"
    fi
  done

# --- Clean up temp files ---
rm -rf "$TEMP_DIR"

# --- Notify on success ---
echo "Backup completed successfully."
aws sns publish \
  --topic-arn "arn:aws:sns:us-east-1:ACCOUNT_ID:clearhealth-${ENVIRONMENT}-alerts" \
  --subject "BACKUP SUCCESS: ClearHealth ${ENVIRONMENT}" \
  --message "Database backup completed at ${TIMESTAMP}. Size: ${BACKUP_SIZE}. Location: s3://${BACKUP_BUCKET}/${BACKUP_KEY}" \
  || true

echo "=== Done ==="
