# AWS Fargate to Azure Container Apps Migration

Guidance for migrating AWS Fargate (ECS/EKS) containerized workloads to Azure Container Apps.

## Service Mapping

| AWS Service | Azure Equivalent | Notes |
|-------------|------------------|-------|
| ECS/EKS Fargate | Azure Container Apps | Serverless container platform |
| ECR | Azure Container Registry | Private container registry |
| Application Load Balancer | Container Apps Ingress | Built-in HTTPS |
| AWS Secrets Manager | Azure Key Vault | Managed identity integration |
| CloudWatch Logs | Azure Monitor/Log Analytics | Requires Log Analytics workspace on environment |
| CloudWatch Metrics | Azure Monitor Metrics | Available without Log Analytics workspace |
| IAM Roles (tasks) | Managed Identity | Azure AD integration |
| VPC | Virtual Network | VNet integration |
| Security Groups | NSG + Container Apps rules | Network security |
| Auto Scaling | Container Apps scaling rules | HTTP, CPU, memory, custom |
| Parameter Store | App Configuration or Key Vault | Configuration management |
| S3 | Azure Blob Storage | SDK change (boto3 → azure-storage-blob) |
| DynamoDB | Azure Cosmos DB | API compatibility or code changes |
| SQS | Azure Service Bus / Queue Storage | SDK change |
| SNS | Azure Event Grid / Service Bus Topics | SDK change |
| RDS | Azure Database for PostgreSQL/MySQL/SQL | Connection string update |
| ElastiCache (Redis) | Azure Cache for Redis | Connection string update |

## Resource Mapping

| ECS Task Definition | Container Apps Equivalent |
|---------------------|--------------------------|
| `cpu: "512"` (0.5 vCPU) | `cpu: 0.5` |
| `memory: "1024"` (MB) | `memory: 1Gi` |
| `containerPort` | `ingress.targetPort` |
| `environment` | `env` array |
| `secrets` (Secrets Manager ARN) | `secrets` (Key Vault URL + identity) |
| `logConfiguration` (awslogs) | Log Analytics (requires workspace on environment) |
| Service Auto Scaling | `scale.rules` (HTTP/CPU/memory/custom) |

## Migration Workflow

1. **Assess** — Analyze ECS task definitions, IAM roles, VPC config → [fargate-assessment-guide.md](fargate-assessment-guide.md)
2. **Migrate Images** — Pull from ECR, push to ACR
3. **Map Services** — Convert AWS dependencies to Azure equivalents
4. **Convert Config** — Transform task definitions to Container Apps YAML
5. **Deploy** — Create Container Apps environment and deploy → [fargate-deployment-guide.md](fargate-deployment-guide.md)
6. **Validate** — Health checks, scaling, monitoring

## Reference Links

- [Azure Container Apps overview](https://learn.microsoft.com/azure/container-apps/overview)
- [AWS to Azure services comparison](https://learn.microsoft.com/azure/architecture/aws-professional/services)
- [Container Apps scaling](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Container Apps managed identity](https://learn.microsoft.com/azure/container-apps/managed-identity)
