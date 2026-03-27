# AWS Fargate to Azure Container Apps - Assessment Guide

## Assessment Checklist

### 1. Container Configuration Analysis

#### Task Definition Review
- **CPU/Memory**: Extract from task definition
  - Fargate CPU: 0.25, 0.5, 1, 2, 4 vCPU → Container Apps: 0.25-4 vCPU
  - Fargate Memory: Task-level allocation → Container Apps: Per-container allocation
- **Container Images**: List all images and tags
  - Image registry location (ECR region)
  - Image size and layers
  - Base image and dependencies
- **Port Mappings**: Document exposed ports and protocols

#### Environment Configuration
- **Environment Variables**: Count and categorize:
  - Static configuration values
  - Secret references (AWS Secrets Manager ARNs)
  - Parameter Store references
  - Service discovery endpoints
- **Secrets**: Document secrets usage:
  - Number of secrets
  - Rotation requirements
  - Access patterns

### 2. Networking Analysis

#### VPC Configuration
- **Subnets**: Public vs Private
- **Security Groups**: Document inbound/outbound rules
  - Source/destination IPs or security groups
  - Port ranges and protocols
- **Load Balancer**:
  - Type (ALB, NLB)
  - Listener rules and target groups
  - Health check configuration
  - SSL/TLS certificates

#### Service Connectivity
- **Upstream Dependencies**: Services this workload depends on
  - RDS databases (engine, version)
  - ElastiCache (Redis/Memcached)
  - S3 buckets
  - DynamoDB tables
  - SQS queues
  - SNS topics
  - API Gateway endpoints
- **Downstream Consumers**: Services that depend on this workload

### 3. IAM and Security

#### Task Role Analysis
- **IAM Policies**: Document permissions required
  - S3 access (buckets, operations)
  - DynamoDB access (tables, operations)
  - SQS/SNS permissions
  - Secrets Manager access
  - CloudWatch Logs write access
- **Task Execution Role**: Document container startup permissions
  - ECR pull permissions
  - CloudWatch Logs group creation
  - Secrets Manager read access

### 4. Scalability and Performance

#### Auto Scaling Configuration
- **Service Auto Scaling**:
  - Target tracking policies (CPU, memory, ALB requests)
  - Min/max task count
  - Scale-out/scale-in cooldown periods
- **Task-level Concurrency**: Connections per task

#### Performance Characteristics
- **Request Rate**: Average and peak requests per second
- **Response Time**: P50, P95, P99 latencies
- **Resource Utilization**: Actual CPU/memory usage vs allocation

### 5. Observability

#### CloudWatch Configuration
- **Log Groups**: Document log destinations and retention
- **Metrics**: CloudWatch metrics collected
- **Alarms**: Existing CloudWatch alarms and thresholds
- **Dashboards**: CloudWatch dashboards in use

#### Tracing
- **AWS X-Ray**: If enabled, document sampling rules
- **Application Performance Monitoring**: DataDog, New Relic, etc.

### 6. Deployment and CI/CD

#### Current Deployment Process
- **Tool**: ECS CLI, CloudFormation, Terraform, CDK
- **Pipeline**: CodePipeline, Jenkins, GitHub Actions, etc.
- **Deployment Strategy**: Rolling update, blue/green, canary
- **Rollback Procedure**: Automated or manual

### 7. Cost Analysis

#### Current AWS Costs
- **Fargate Costs**: vCPU-hours and memory-hours
- **Data Transfer**: Cross-AZ, internet egress
- **Load Balancer**: ALB/NLB costs
- **CloudWatch**: Logs ingestion and storage
- **ECR**: Storage and data transfer

## Azure Container Apps Equivalent

### Resource Mapping

#### AWS ECS Task Definition (JSON)

```json
{
  "family": "my-app",
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:v1.0",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:db-password"
        }
      ]
    }
  ]
}
```

**Mapping Notes:**
- CPU: "512" (0.5 vCPU) → 0.5 in Container Apps
- Memory: "1024" MB → 1Gi in Container Apps
- Secrets Manager ARN → Azure Key Vault URL

#### Azure Container Apps Equivalent (YAML)

```yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      transport: http
    secrets:
      - name: db-password
        keyVaultUrl: https://myvault.vault.azure.net/secrets/db-password
  template:
    containers:
      - name: app
        image: myregistry.azurecr.io/my-app:v1.0
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: ENV
            value: production
          - name: DB_PASSWORD
            secretRef: db-password
```

### Service Dependencies Mapping

| AWS Service | Azure Equivalent | Migration Approach |
|-------------|------------------|-------------------|
| Amazon RDS (PostgreSQL) | Azure Database for PostgreSQL | Connection string update |
| Amazon RDS (MySQL) | Azure Database for MySQL | Connection string update |
| Amazon RDS (SQL Server) | Azure SQL Database | Connection string update |
| DynamoDB | Azure Cosmos DB | API compatibility layer or code changes |
| S3 | Azure Blob Storage | SDK change (boto3 → azure-storage-blob) |
| ElastiCache (Redis) | Azure Cache for Redis | Connection string update |
| SQS | Azure Queue Storage or Service Bus | SDK change |
| SNS | Azure Service Bus Topics or Event Grid | SDK change |
| Parameter Store | Azure App Configuration | SDK change |
| Secrets Manager | Azure Key Vault | Managed identity integration |
| CloudWatch Logs | Azure Monitor Logs | Auto-configured |
| CloudWatch Metrics | Azure Monitor Metrics | Auto-configured |
| X-Ray | Application Insights | SDK change |

## Assessment Report Template

```markdown
# AWS Fargate to Azure Container Apps - Migration Assessment

## Executive Summary
- **Workload**: [Name and description]
- **Current Environment**: AWS Fargate (ECS/EKS)
- **Migration Complexity**: [Low/Medium/High]
- **Estimated Timeline**: [Days/weeks]
- **Estimated Azure Cost**: [Monthly estimate]

## Current State Analysis

### Container Configuration
- **CPU**: [value] vCPU
- **Memory**: [value] GB
- **Images**: [count] container images
- **Ports**: [list exposed ports]

### Dependencies
[List all service dependencies]

### Security
- **IAM Roles**: [count]
- **Secrets**: [count]
- **Network Security**: [security group rules summary]

## Azure Target Architecture

### Container Apps Configuration
[Describe target configuration]

### Required Azure Resources
- Resource Group
- Container Apps Environment
- Azure Container Registry
- Azure Key Vault
- Log Analytics Workspace
- [Other resources]

## Migration Approach

### Phase 1: Preparation
[Detailed steps]

### Phase 2: Migration
[Detailed steps]

### Phase 3: Validation
[Detailed steps]

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Mitigation strategy] |

## Cost Comparison

### AWS Current Costs
- Fargate: $[amount]/month
- Other services: $[amount]/month
- **Total**: $[amount]/month

### Azure Projected Costs
- Container Apps: $[amount]/month
- Other services: $[amount]/month
- **Total**: $[amount]/month
- **Difference**: [+/-][amount]/month ([percentage]%)

## Timeline and Milestones

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Assessment | [days] | This report |
| Preparation | [days] | Infrastructure ready |
| Migration | [days] | Apps deployed |
| Validation | [days] | Testing complete |
| **Total** | **[days]** | Production ready |

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Next Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]
```

## Complexity Rating Guide

### Low Complexity
- Single container per task
- No VPC dependencies
- Standard environment variables only
- Public load balancer
- No custom IAM policies
- Standard logging to CloudWatch

### Medium Complexity
- Multiple containers per task
- VPC with private connectivity
- Mix of environment variables and secrets
- Internal load balancer
- Custom IAM policies with managed services
- CloudWatch Logs with custom log groups

### High Complexity
- Multiple interdependent tasks
- Complex VPC networking with VPN/Direct Connect
- Extensive secret management
- Multi-region deployment
- Complex IAM policies with cross-account access
- Custom observability stack (X-Ray, custom metrics)
- Stateful workloads requiring persistent storage
- Complex deployment strategies (canary, blue/green)
