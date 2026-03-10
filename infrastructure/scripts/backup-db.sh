#!/usr/bin/env bash
# ==============================================================================
# ClearHealth — Database Backup Script
# ==============================================================================
# Creates a pg_dump backup of the ClearHealth PostgreSQL database.
#
# Modes:
#   cloud  — Fetches credentials from AWS SSM, uploads to S3 (production use)
#   local  — Uses DATABASE_URL env var, saves to local directory (dev use)
#
# Usage:
#   ./backup-db.sh [environment] [--local]
#
# Examples:
#   ./backup-db.sh prod              # Cloud backup for production
#   ./backup-db.sh dev --local       # Local backup for development
#
# Environment: dev | staging | prod (default: prod)
#
# Cron (production):
#   0 3 * * * /opt/clearhealth/scripts/backup-db.sh prod >> /var/log/clearhealth/backup.log 2>&1
# ==============================================================================

set -euo pipefail

# --- Configuration ---
ENVIRONMENT="${1:-prod}"
LOCAL_MODE=false
if [[ "${2:-}" == "--local" ]]; then
  LOCAL_MODE=true
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30
TEMP_DIR=$(mktemp -d)
BACKUP_FILE="${TEMP_DIR}/clearhealth_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"

# Clean up temp files on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# --- Validate environment ---
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "ERROR: Invalid environment '${ENVIRONMENT}'. Must be dev, staging, or prod."
  exit 1
fi

# HIPAA: production backups retained for 90 days minimum
if [[ "$ENVIRONMENT" == "prod" ]]; then
  RETENTION_DAYS=90
fi

echo "=== ClearHealth Database Backup ==="
echo "Environment: ${ENVIRONMENT}"
echo "Timestamp:   ${TIMESTAMP}"
echo "Mode:        $(if $LOCAL_MODE; then echo 'local'; else echo 'cloud (S3)'; fi)"
echo "Retention:   ${RETENTION_DAYS} days"

# --- Get database URL ---
if $LOCAL_MODE; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL environment variable is required in local mode."
    exit 1
  fi
  echo "Using DATABASE_URL from environment."
else
  echo "Fetching database URL from SSM Parameter Store..."
  DATABASE_URL=$(aws ssm get-parameter \
    --name "/clearhealth/${ENVIRONMENT}/database-url" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text)

  if [[ -z "$DATABASE_URL" ]]; then
    echo "ERROR: Could not retrieve DATABASE_URL from SSM."
    aws sns publish \
      --topic-arn "arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID:-ACCOUNT_ID}:clearhealth-${ENVIRONMENT}-alerts" \
      --subject "BACKUP FAILED: ClearHealth ${ENVIRONMENT}" \
      --message "Database backup failed at ${TIMESTAMP}. Could not retrieve database credentials." \
      || true
    exit 1
  fi
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

# --- Store backup ---
if $LOCAL_MODE; then
  # Local mode: save to ./backups/ directory
  LOCAL_BACKUP_DIR="./backups/${ENVIRONMENT}"
  mkdir -p "$LOCAL_BACKUP_DIR"
  cp "$BACKUP_FILE" "${LOCAL_BACKUP_DIR}/"
  echo "Backup saved to: ${LOCAL_BACKUP_DIR}/$(basename "$BACKUP_FILE")"

  # Rotate old local backups
  echo "Cleaning up local backups older than ${RETENTION_DAYS} days..."
  find "$LOCAL_BACKUP_DIR" -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

else
  # Cloud mode: upload to S3
  BACKUP_BUCKET="clearhealth-${ENVIRONMENT}-backups"
  BACKUP_KEY="database/${TIMESTAMP}/clearhealth_${ENVIRONMENT}.sql.gz"

  echo "Uploading to s3://${BACKUP_BUCKET}/${BACKUP_KEY}..."
  aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_BUCKET}/${BACKUP_KEY}" \
    --sse aws:kms \
    --sse-kms-key-id "alias/clearhealth-${ENVIRONMENT}-backup-key" \
    --storage-class STANDARD_IA

  echo "Upload complete."

  # Rotate old S3 backups beyond retention period
  echo "Cleaning up S3 backups older than ${RETENTION_DAYS} days..."
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

  # Notify on success
  aws sns publish \
    --topic-arn "arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID:-ACCOUNT_ID}:clearhealth-${ENVIRONMENT}-alerts" \
    --subject "BACKUP SUCCESS: ClearHealth ${ENVIRONMENT}" \
    --message "Database backup completed at ${TIMESTAMP}. Size: ${BACKUP_SIZE}. Location: s3://${BACKUP_BUCKET}/${BACKUP_KEY}" \
    || true
fi

echo "Backup completed successfully."
echo "=== Done ==="
