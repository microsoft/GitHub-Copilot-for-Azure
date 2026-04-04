# Google Cloud Run to Azure Container Apps - Assessment Guide

## Assessment Checklist

### 1. Service Configuration
- **CPU/Memory**: Cloud Run (1-4 vCPU, 128 MiB-32 GiB) → Container Apps (0.25-4 vCPU, 0.5-8 Gi)
- **Images**: Registry location, size, base image
- **Port**: Document exposed port (default 8080)
- **Environment Variables**: Static values, secret references, service URLs
- **Secrets**: Count, rotation requirements, access patterns

### 2. Request Handling
- **Concurrency**: Per instance (default 80, max 1000) → Container Apps (1-300)
- **Min/Max Instances**: 0-1000 → Container Apps 0-300 per revision
- **Timeout**: Max 60 min → Container Apps max 30 min (1800s)
- **CPU Allocation**: Request-based vs always → Container Apps always allocated
- **HTTP/2, WebSockets, gRPC**: Document if used

### 3. Networking
- **Ingress**: Public (all), internal (VPC), or internal + load balancing
- **Authentication**: Unauthenticated, IAM, or custom
- **Custom Domains**: List domains and SSL certificates
- **VPC Connector**: Document if used (region, IP range, connected VPC)
- **Dependencies**: Cloud SQL, Firestore, Cloud Storage, Pub/Sub, Redis, BigQuery, external APIs
- **Consumers**: HTTP callers, Eventarc triggers, Cloud Scheduler, Cloud Tasks

### 4. IAM and Security
- **Service Account**: Default or custom service account
- **IAM Roles**: Storage, Firestore, Pub/Sub, Secret Manager, Cloud SQL, logging permissions
- **Security**: Binary Authorization, ingress controls, VPC Service Controls

### 5. Observability
- **Logging**: Destinations, sampling, structured logs (JSON)
- **Monitoring**: Request metrics, CPU/memory, instance count, alerts, dashboards
- **Tracing**: Cloud Trace sampling, Error Reporting, Cloud Profiler

### 6. Event-Driven
- **Eventarc**: Pub/Sub triggers, Cloud Storage triggers, audit log triggers
- **Cloud Scheduler**: Schedule (cron), target endpoint, authentication

### 7. Deployment
- **Tool**: gcloud CLI, Cloud Build, Terraform, Pulumi
- **Pipeline**: Cloud Build triggers, GitHub Actions, GitLab CI
- **Strategy**: Gradual rollout, traffic splitting, blue/green
- **Rollback**: Automated or manual

### 8. Cost Analysis
- **Cloud Run**: Request charges, CPU/memory time, request volume
- **Data Transfer**: Egress charges
- **Cloud Logging**: Ingestion and storage
- **Container Registry**: Storage and data transfer

## Configuration Example

Cloud Run concurrency 80, timeout 300s, image `gcr.io/project/app:v1.0` → Container Apps concurrency 80, timeout 300s, image `registry.azurecr.io/app:v1.0`

## Service Dependency Mappings

| GCP Service | Azure Equivalent | Notes |
|-------------|------------------|-------|
| Cloud SQL (PostgreSQL) | Azure Database for PostgreSQL | Connection string + managed identity |
| Cloud SQL (MySQL) | Azure Database for MySQL | Connection string + managed identity |
| Firestore | Azure Cosmos DB | SDK change required |
| Cloud Storage | Azure Blob Storage | SDK change required |
| Cloud Memorystore (Redis) | Azure Cache for Redis | Connection string update |
| Pub/Sub | Azure Service Bus / Event Grid | SDK change required |
| Cloud Tasks | Azure Queue Storage / Service Bus | SDK change required |
| Secret Manager | Azure Key Vault | Managed identity integration |
| Cloud Logging | Azure Monitor Logs | Auto-configured |
| Cloud Monitoring | Azure Monitor Metrics | Auto-configured |
| Cloud Trace | Application Insights | SDK change or auto-instrumentation |
| Cloud Scheduler | Azure Logic Apps / Functions Timer | HTTP trigger to Container Apps |

## Critical Differences

| Feature | Cloud Run | Azure Container Apps | Impact |
|---------|-----------|---------------------|--------|
| Max Timeout | 60 minutes | 30 minutes (1800s) | Redesign long-running tasks |
| CPU Allocation | Request-based or always | Always allocated | Cost model changes |
| Max Instances | 0-1000 | 0-300 per revision | Validate instance needs |
| Concurrency | 1-1000 | 1-300 | Adjust concurrency settings |
| Cold Start | Highly optimized | Standard | May be slightly slower |
| Startup Time | 10 minutes max | 240s default | Validate startup time |

## Assessment Report Structure

Generate `assessment-report.md` with:

1. **Executive Summary**: Service name, complexity (Low/Medium/High), timeline, estimated Azure cost
2. **Current State**: CPU/memory, concurrency, min/max instances, timeout, image, request volume, dependencies
3. **Azure Target**: Required resources (resource group, Container Apps Environment, ACR, Key Vault, Log Analytics, VNet if needed)
4. **Migration Considerations**:
   - Feature parity table
   - Code changes (SDK updates, connection strings, authentication, timeout handling)
   - Operational changes (pipelines, monitoring, runbooks)

### Complexity Assessment Guidelines

#### Medium Complexity
- Internal ingress
- Pub/Sub or Eventarc triggers
- Custom service account with GCP service access
- Cloud Scheduler integration

#### High Complexity
- Complex traffic management (multiple revisions)
- Extensive VPC networking with Shared VPC
- Numerous secrets and configurations
- Multi-region deployment with Cloud Load Balancing
- Complex event-driven architecture (multiple Eventarc triggers)
- Binary Authorization policies
- Extensive GCP service integration (Cloud SQL, Firestore, Pub/Sub, etc.)
- Long-running requests (> 30 minutes timeout)
- Very high concurrency requirements (> 300 per instance)
- Very high instance count (> 300)
