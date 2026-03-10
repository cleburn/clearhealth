# ==============================================================================
# ClearHealth — AWS Infrastructure (Terraform)
# ==============================================================================
# Defines the cloud infrastructure for the ClearHealth platform.
#
# Architecture:
# - VPC with public + private subnets across 2 AZs
# - ECS Fargate for containerized API service
# - RDS PostgreSQL in private subnet (encrypted storage)
# - ElastiCache Redis in private subnet (session store + job queue)
# - S3 bucket for patient documents (encrypted, versioned)
# - ALB with HTTPS termination
# - Security groups with minimal access rules
#
# Patient data at rest is encrypted via RDS encryption + application-level AES-256-GCM
# ==============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30"
    }
  }

  backend "s3" {
    bucket         = "clearhealth-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "clearhealth-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ClearHealth"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA"
    }
  }
}

# ==============================================================================
# VPC & Networking
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "clearhealth-${var.environment}-vpc"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "clearhealth-${var.environment}-public-a"
    Tier = "public"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name = "clearhealth-${var.environment}-public-b"
    Tier = "public"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "clearhealth-${var.environment}-private-a"
    Tier = "private"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "clearhealth-${var.environment}-private-b"
    Tier = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "clearhealth-${var.environment}-igw"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "clearhealth-${var.environment}-nat"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "clearhealth-${var.environment}-nat-eip"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "clearhealth-${var.environment}-public-rt"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "clearhealth-${var.environment}-private-rt"
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

# ==============================================================================
# Security Groups
# ==============================================================================

resource "aws_security_group" "alb" {
  name_prefix = "clearhealth-${var.environment}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "clearhealth-${var.environment}-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name_prefix = "clearhealth-${var.environment}-ecs-"
  description = "Security group for ECS tasks — only accepts traffic from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API port from ALB only"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "clearhealth-${var.environment}-ecs-sg"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "clearhealth-${var.environment}-rds-"
  description = "Security group for RDS — only accepts traffic from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "clearhealth-${var.environment}-rds-sg"
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "clearhealth-${var.environment}-redis-"
  description = "Security group for ElastiCache Redis — only accepts traffic from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = {
    Name = "clearhealth-${var.environment}-redis-sg"
  }
}

# ==============================================================================
# RDS PostgreSQL
# Patient data at rest is encrypted via RDS encryption + application-level AES-256-GCM
# ==============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "clearhealth-${var.environment}-db-subnet"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "clearhealth-${var.environment}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "clearhealth-${var.environment}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = 50
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true # HIPAA: encryption at rest

  db_name  = "clearhealth"
  username = "clearhealth_admin"
  password = var.db_password

  multi_az               = var.environment == "prod" ? true : false
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 90 # HIPAA: minimum 90-day backup retention
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment == "prod" ? false : true

  final_snapshot_identifier = var.environment == "prod" ? "clearhealth-${var.environment}-final" : null

  tags = {
    Name       = "clearhealth-${var.environment}-postgres"
    DataClass  = "PHI"
    Encrypted  = "true"
    Compliance = "HIPAA"
  }
}

# ==============================================================================
# ElastiCache Redis (session store + BullMQ job queue)
# ==============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "clearhealth-${var.environment}-redis-subnet"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "clearhealth-${var.environment}"
  description          = "ClearHealth Redis — session store and job queue"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1

  engine_version     = "7.0"
  port               = 6379
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = var.environment == "prod" ? true : false

  tags = {
    Name = "clearhealth-${var.environment}-redis"
  }
}

# ==============================================================================
# S3 Bucket (patient documents — encrypted, versioned)
# ==============================================================================

resource "aws_s3_bucket" "documents" {
  bucket = "clearhealth-${var.environment}-documents"

  tags = {
    Name       = "clearhealth-${var.environment}-documents"
    DataClass  = "PHI"
    Compliance = "HIPAA"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.documents.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "documents" {
  description             = "KMS key for ClearHealth patient document encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name       = "clearhealth-${var.environment}-documents-kms"
    Compliance = "HIPAA"
  }
}

resource "aws_kms_alias" "documents" {
  name          = "alias/clearhealth-${var.environment}-documents"
  target_key_id = aws_kms_key.documents.key_id
}

# ==============================================================================
# KMS — Application-level encryption key management
# ==============================================================================
# This KMS key is used to encrypt/decrypt the application ENCRYPTION_KEY stored
# in SSM Parameter Store. The actual patient data encryption (AES-256-GCM) is
# performed at the application level; KMS protects the key at rest.
# ==============================================================================

resource "aws_kms_key" "app_encryption" {
  description             = "KMS key for ClearHealth application encryption key management"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccountFullAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowECSTaskDecrypt"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name       = "clearhealth-${var.environment}-app-encryption-kms"
    Compliance = "HIPAA"
    Purpose    = "Patient data encryption key management"
  }
}

resource "aws_kms_alias" "app_encryption" {
  name          = "alias/clearhealth-${var.environment}-app-encryption"
  target_key_id = aws_kms_key.app_encryption.key_id
}

resource "aws_kms_key" "backup" {
  description             = "KMS key for ClearHealth database backup encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name       = "clearhealth-${var.environment}-backup-kms"
    Compliance = "HIPAA"
  }
}

resource "aws_kms_alias" "backup" {
  name          = "alias/clearhealth-${var.environment}-backup-key"
  target_key_id = aws_kms_key.backup.key_id
}

data "aws_caller_identity" "current" {}

# ==============================================================================
# ALB (Application Load Balancer)
# ==============================================================================

resource "aws_lb" "main" {
  name               = "clearhealth-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "clearhealth-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "clearhealth-${var.environment}-api-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ==============================================================================
# ECS Cluster + Service
# ==============================================================================

resource "aws_ecs_cluster" "main" {
  name = "clearhealth-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "clearhealth-${var.environment}-cluster"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "clearhealth-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${var.ecr_repository_url}:latest"
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "3001" },
        { name = "AUDIT_LOG_ENABLED", value = "true" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
        { name = "REDIS_URL", valueFrom = aws_ssm_parameter.redis_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
        { name = "JWT_REFRESH_SECRET", valueFrom = aws_ssm_parameter.jwt_refresh_secret.arn },
        { name = "ENCRYPTION_KEY", valueFrom = aws_ssm_parameter.encryption_key.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "clearhealth-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.environment == "prod" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }
}

# ==============================================================================
# IAM Roles
# ==============================================================================

resource "aws_iam_role" "ecs_execution" {
  name = "clearhealth-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "clearhealth-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "clearhealth-${var.environment}-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      }
    ]
  })
}

# Allow ECS execution role to read SSM parameters (secrets) and decrypt via KMS
resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "clearhealth-${var.environment}-ssm-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/clearhealth/${var.environment}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.app_encryption.arn
      }
    ]
  })
}

# ==============================================================================
# SSM Parameters (secrets)
# ==============================================================================

resource "aws_ssm_parameter" "database_url" {
  name  = "/clearhealth/${var.environment}/database-url"
  type  = "SecureString"
  value = "placeholder" # Set via AWS Console or CI/CD pipeline

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Compliance = "HIPAA"
  }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/clearhealth/${var.environment}/redis-url"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/clearhealth/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "/clearhealth/${var.environment}/jwt-refresh-secret"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "/clearhealth/${var.environment}/encryption-key"
  type  = "SecureString"
  value = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Compliance = "HIPAA"
    Purpose    = "Patient data encryption key (AES-256-GCM)"
  }
}

# ==============================================================================
# CloudWatch Logs
# ==============================================================================

resource "aws_cloudwatch_log_group" "api" {
  name              = "/clearhealth/${var.environment}/api"
  retention_in_days = 90 # HIPAA minimum

  tags = {
    Name       = "clearhealth-${var.environment}-api-logs"
    Compliance = "HIPAA"
  }
}

# ==============================================================================
# Outputs
# ==============================================================================

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for patient documents"
  value       = aws_s3_bucket.documents.id
}
