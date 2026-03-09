# ==============================================================================
# ClearHealth — Terraform Variables
# ==============================================================================
# All variables used in the ClearHealth infrastructure configuration.
# Sensitive variables are marked accordingly and should be provided
# via environment variables or a .tfvars file (never committed to git).
# ==============================================================================

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL"
  type        = string
  default     = "db.t3.medium"
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL instance"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache node type for Redis"
  type        = string
  default     = "cache.t3.small"
}

variable "domain_name" {
  description = "Domain name for the ClearHealth application (e.g., app.clearhealth.example.com)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS on the ALB"
  type        = string
  sensitive   = true
}

variable "ecr_repository_url" {
  description = "URL of the ECR repository for the API Docker image"
  type        = string
  default     = ""
}
