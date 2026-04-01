# AWS ECS/Fargate to Azure Container Apps Migration

Detailed guidance for migrating AWS ECS and Fargate workloads to Azure Container Apps.

## Service Mapping

| AWS Service | Azure Equivalent |
|-------------|------------------|
| ECS Service | Container App |
| ECS Task Definition | Container App revision template |
| ECS Task | Container App replica |
| Fargate | Container Apps Consumption plan |
| ECS Capacity Provider | Container Apps Dedicated workload profile |
| ECR | Azure Container Registry (ACR) |
| ALB / NLB | Container Apps ingress |
| ECS Service Connect | Container Apps internal DNS / Dapr |
| App Mesh | Dapr (service invocation, pub/sub, state) |
| CloudWatch Logs | Log Analytics |
| CloudWatch Metrics | Azure Monitor Metrics |
| CloudWatch Alarms | Azure Monitor Alerts |
| X-Ray | Application Insights (distributed tracing) |
| Task IAM Role | Managed Identity + RBAC |
| Execution Role | ACR pull via Managed Identity |
| Secrets Manager | Azure Key Vault |
| Parameter Store | Azure App Configuration |
| ECS Service Auto Scaling | Container Apps scale rules |
| AWS CloudMap | Container Apps internal DNS |
| EFS | Azure Files |
| CloudFormation / CDK | Bicep / ARM Templates |
| CodePipeline / CodeBuild | Azure DevOps Pipelines / GitHub Actions |

## Task Definition → Container App Template

### ECS Task Definition (source)

```json
{
  "family": "my-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "api",
    "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/my-api:v1",
    "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
    "environment": [
      { "name": "NODE_ENV", "value": "production" }
    ],
    "secrets": [
      { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:db-pass" }
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3
    },
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/my-api",
        "awslogs-region": "us-east-1"
      }
    }
  }]
}
```

### Container App YAML (target)

```yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      transport: auto
    secrets:
      - name: db-password
        keyVaultUrl: https://myvault.vault.azure.net/secrets/db-password
        identity: <managed-identity-resource-id>
    registries:
      - server: myacr.azurecr.io
        identity: <managed-identity-resource-id>
  template:
    containers:
      - image: myacr.azurecr.io/my-api:v1
        name: api
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: NODE_ENV
            value: production
          - name: DB_PASSWORD
            secretRef: db-password
        probes:
          - type: liveness
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
    scale:
      minReplicas: 1
      maxReplicas: 10
```

## Resource Mapping

| ECS (Fargate) | Container Apps |
|---------------|---------------|
| `cpu: "256"` (0.25 vCPU) | `cpu: 0.25` |
| `cpu: "512"` (0.5 vCPU) | `cpu: 0.5` |
| `cpu: "1024"` (1 vCPU) | `cpu: 1.0` |
| `cpu: "2048"` (2 vCPU) | `cpu: 2.0` |
| `cpu: "4096"` (4 vCPU) | `cpu: 4.0` (Dedicated plan) |
| `memory: "512"` (MB) | `memory: 0.5Gi` |
| `memory: "1024"` (MB) | `memory: 1Gi` |
| `memory: "2048"` (MB) | `memory: 2Gi` |
| `memory: "4096"` (MB) | `memory: 4Gi` |

> ⚠️ Container Apps Consumption plan supports up to 4 vCPU / 8 GiB. For larger workloads, use Dedicated workload profiles.

## Networking & Ingress

| ECS Pattern | Container Apps Equivalent |
|-------------|--------------------------|
| ALB with path-based routing | Multiple Container Apps with ingress rules |
| ALB with host-based routing | Custom domains on Container Apps |
| NLB (TCP) | Container Apps TCP ingress |
| Internal ALB | `external: false` ingress |
| Public ALB | `external: true` ingress |
| Security Groups | NSG on Container Apps Environment VNet |
| VPC | VNet-integrated Container Apps Environment |

## ECS Service Connect → Service Discovery

| ECS Pattern | Container Apps Equivalent |
|-------------|--------------------------|
| Service Connect (HTTP) | Internal ingress (`external: false`) |
| Service Connect (gRPC) | Internal ingress with `transport: http2` |
| CloudMap DNS | `<app-name>.internal.<env-domain>` |
| App Mesh virtual service | Dapr service invocation |
| App Mesh virtual router | Dapr pub/sub routing |

Internal service discovery URL pattern:
```
https://<app-name>.internal.<unique-id>.<region>.azurecontainerapps.io
```

## Autoscaling Mapping

| ECS Auto Scaling | Container Apps Scale Rule |
|------------------|--------------------------|
| Target tracking (CPU) | Custom scale rule with CPU metric |
| Target tracking (requests) | HTTP scale rule (`concurrentRequests`) |
| SQS queue depth | Queue scale rule (Service Bus / Storage Queue) |
| Step scaling | Custom scale rule with thresholds |
| Scheduled scaling | KEDA cron scale rule |
| `desiredCount` minimum | `minReplicas` |
| `desiredCount` maximum | `maxReplicas` |

## ECR → ACR Migration

```bash
# Import directly (no local Docker needed)
az acr import --name <acr-name> \
  --source <account>.dkr.ecr.<region>.amazonaws.com/<repo>:<tag> \
  --username AWS \
  --password $(aws ecr get-login-password --region <region>)

# Configure managed identity pull
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role AcrPull \
  --scope <acr-resource-id>
```

## IAM Role → Managed Identity

| AWS IAM | Azure RBAC |
|---------|------------|
| Task Role | User Assigned Managed Identity |
| Execution Role (ECR pull) | `AcrPull` on ACR |
| S3 access | `Storage Blob Data Contributor` on Storage Account |
| SQS access | `Service Bus Data Receiver` on Service Bus |
| Secrets Manager access | `Key Vault Secrets User` on Key Vault |
| DynamoDB access | Cosmos DB RBAC data role |
| CloudWatch Logs | `Monitoring Metrics Publisher` on App Insights |

## Monitoring Mapping

| AWS | Azure | Notes |
|-----|-------|-------|
| CloudWatch Logs (`awslogs`) | Log Analytics | Container stdout/stderr auto-collected |
| CloudWatch Metrics | Azure Monitor Metrics | CPU, memory, requests built-in |
| CloudWatch Alarms | Azure Monitor Alerts | KQL-based alert rules |
| X-Ray | Application Insights | Distributed tracing via OpenTelemetry |
| Container Insights | Container Apps metrics | Built-in dashboard in Azure Portal |

## Reference Links

- [Container Apps overview](https://learn.microsoft.com/en-us/azure/container-apps/overview)
- [Container Apps YAML reference](https://learn.microsoft.com/en-us/azure/container-apps/azure-resource-manager-api-spec)
- [Ingress configuration](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview)
- [Dapr integration](https://learn.microsoft.com/en-us/azure/container-apps/dapr-overview)
- [Managed identity with ACR](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity)
- [Scale rules](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
