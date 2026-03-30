# Google Cloud Run to Azure Container Apps - Assessment Guide

## Assessment Checklist

### 1. Service Configuration Analysis

#### Cloud Run Service Review
- **CPU/Memory**: Extract from service configuration
  - Cloud Run CPU: 1-4 vCPU → Container Apps: 0.25-4 vCPU
  - Cloud Run Memory: 128 MiB - 32 GiB → Container Apps: 0.5 Gi - 8 Gi
- **Container Images**: List all images and tags
  - Image registry location (GCR/Artifact Registry region)
  - Image size and layers
  - Base image and dependencies
- **Port Configuration**: Document exposed port (default 8080)

#### Environment Configuration
- **Environment Variables**: Count and categorize:
  - Static configuration values
  - Secret references (Secret Manager)
  - Service URLs and endpoints
- **Secrets**: Document secrets usage:
  - Number of secrets mounted as env vars or volumes
  - Rotation requirements
  - Access patterns

### 2. Request Handling Analysis

#### Concurrency and Scaling
- **Concurrency**: Requests per container instance (default 80, max 1000)
  - Map to Container Apps max concurrent requests (1-300)
- **Min Instances**: Scale-to-zero or minimum instances (0-1000)
  - Container Apps: 0-300 per revision
- **Max Instances**: Maximum instances for auto-scaling
- **CPU Allocation**: 
  - "CPU always allocated" vs "CPU allocated only during request"
  - Container Apps: Always allocated (note the difference)

#### Request Configuration
- **Timeout**: Request timeout (default 300s, max 60 minutes)
  - Container Apps max: 1800s (30 minutes) - note the difference
- **HTTP/2**: Whether HTTP/2 is enabled
- **WebSockets**: If long-lived connections are used
- **gRPC**: If gRPC services are exposed

### 3. Networking Analysis

#### Ingress Configuration
- **Ingress Type**: 
  - All (public internet)
  - Internal (VPC only)
  - Internal and Cloud Load Balancing
- **Authentication**:
  - Allow unauthenticated invocations
  - Require authentication (IAM)
  - Custom authentication via service code
- **Custom Domains**: List custom domains and SSL certificates

#### VPC Connectivity
- **VPC Connector**: If using VPC connector for private networking
  - Connector region and IP range
  - Connected VPC network
  - Egress settings (route all traffic or only private ranges)

#### Service Connectivity
- **Upstream Dependencies**: Services this workload depends on
  - Cloud SQL (engine, version, connection method)
  - Firestore/Datastore
  - Cloud Storage buckets
  - Pub/Sub topics/subscriptions
  - Cloud Memorystore (Redis/Memcached)
  - BigQuery datasets
  - Other Cloud Run services
  - External APIs
- **Downstream Consumers**: Services that depend on this workload
  - Direct HTTP/gRPC callers
  - Eventarc triggers
  - Cloud Scheduler jobs
  - Cloud Tasks queues

### 4. IAM and Security

#### Service Account Analysis
- **Service Identity**: Document service account configuration
  - Default Compute Engine service account
  - Custom service account
- **IAM Roles**: Document permissions required
  - Cloud Storage (buckets, operations)
  - Firestore access (database, operations)
  - Pub/Sub permissions
  - Secret Manager access
  - Cloud SQL IAM authentication
  - Logging/Monitoring write access

#### Security Settings
- **Binary Authorization**: If policy enforcement is enabled
- **Ingress Controls**: IP restrictions or Cloud Armor policies
- **VPC Service Controls**: If perimeter security is configured

### 5. Observability

#### Cloud Logging Configuration
- **Log Routing**: Document log destinations and sinks
- **Log Sampling**: If sampling is configured
- **Structured Logging**: JSON-formatted logs

#### Cloud Monitoring
- **Metrics**: Cloud Monitoring metrics collected
  - Request count, latency, error rate
  - Container CPU/memory utilization
  - Instance count (active instances)
- **Alerts**: Existing alerting policies and thresholds
- **Dashboards**: Cloud Monitoring dashboards in use

#### Tracing
- **Cloud Trace**: If enabled, document sampling configuration
- **Error Reporting**: If Cloud Error Reporting is used
- **Cloud Profiler**: If continuous profiling is enabled

### 6. Event-Driven Configuration

#### Eventarc Triggers
- **Pub/Sub Triggers**: Document topic subscriptions
- **Cloud Storage Triggers**: Bucket notification configurations
- **Audit Log Triggers**: Resource type and method filters
- **Direct Events**: Other event sources

#### Scheduled Invocations
- **Cloud Scheduler**: Document scheduled jobs
  - Schedule (cron format)
  - Target endpoint
  - Authentication method

### 7. Deployment and CI/CD

#### Current Deployment Process
- **Tool**: gcloud CLI, Cloud Build, Terraform, Pulumi
- **Pipeline**: Cloud Build triggers, GitHub Actions, GitLab CI, etc.
- **Deployment Strategy**: Gradual rollout (traffic splitting), blue/green
- **Traffic Management**: Traffic splitting between revisions
- **Rollback Procedure**: Automated or manual

### 8. Cost Analysis

#### Current GCP Costs
- **Cloud Run Costs**: 
  - Request charges
  - CPU allocation time
  - Memory allocation time
  - Request volume
- **Data Transfer**: Egress charges
- **Cloud Logging**: Ingestion and storage
- **Container Registry**: Storage and data transfer

## Azure Container Apps Equivalent

### Configuration Mapping

```yaml
# Example Cloud Run Service to Container Apps mapping

# Google Cloud Run Service (YAML)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-app
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/my-project/my-app:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: ENV
          value: production
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-password
              key: latest
        resources:
          limits:
            cpu: "1"
            memory: 512Mi

# Azure Container Apps Equivalent (YAML)
properties:
  configuration:
    activeRevisionsMode: single
    ingress:
      external: true
      targetPort: 8080
      transport: auto
      allowInsecure: false
    secrets:
      - name: db-password
        keyVaultUrl: https://myvault.vault.azure.net/secrets/db-password
  template:
    scale:
      minReplicas: 0
      maxReplicas: 10
      rules:
        - name: http-rule
          http:
            metadata:
              concurrentRequests: "80"
    containers:
      - name: my-app
        image: myregistry.azurecr.io/my-app:v1.0
        resources:
          cpu: 1
          memory: 1Gi
        env:
          - name: ENV
            value: production
          - name: DB_PASSWORD
            secretRef: db-password
```

### Service Dependencies Mapping

| GCP Service | Azure Equivalent | Migration Approach |
|-------------|------------------|-------------------|
| Cloud SQL (PostgreSQL) | Azure Database for PostgreSQL | Connection string + managed identity |
| Cloud SQL (MySQL) | Azure Database for MySQL | Connection string + managed identity |
| Cloud SQL (SQL Server) | Azure SQL Database | Connection string + managed identity |
| Firestore | Azure Cosmos DB | API change (Firestore SDK → Cosmos SDK) |
| Cloud Storage | Azure Blob Storage | SDK change (google-cloud-storage → azure-storage-blob) |
| Cloud Memorystore (Redis) | Azure Cache for Redis | Connection string update |
| Pub/Sub | Azure Service Bus or Event Grid | SDK change |
| Cloud Tasks | Azure Queue Storage or Service Bus Queues | SDK change |
| Secret Manager | Azure Key Vault | Managed identity integration |
| Cloud Logging | Azure Monitor Logs | Auto-configured, structured logging supported |
| Cloud Monitoring | Azure Monitor Metrics | Auto-configured |
| Cloud Trace | Application Insights | SDK change or auto-instrumentation |
| Cloud Scheduler | Azure Logic Apps or Functions Timer | Reconfigure as HTTP trigger to Container Apps |

### Important Feature Differences

| Feature | Cloud Run | Azure Container Apps | Migration Notes |
|---------|-----------|---------------------|-----------------|
| **Scale to Zero** | Default behavior | Configurable with minReplicas: 0 | Same capability |
| **Max Timeout** | 60 minutes | 30 minutes (1800s) | Apps with long requests need redesign |
| **CPU Allocation** | Request-based or always | Always allocated | Cost model changes |
| **Min Instances** | 0-1000 | 0-300 per revision | Check if you exceed 300 instances |
| **Concurrency** | 1-1000 | 1-300 | Map concurrency settings appropriately |
| **Cold Start** | Highly optimized | Standard | May experience slightly longer cold starts |
| **Request Size** | 32 MB | 28.6 MB | Nearly equivalent |
| **Startup Time** | 10 minutes max | 240s default | Cloud Run allows longer startup |

## Assessment Report Template

```markdown
# Google Cloud Run to Azure Container Apps - Migration Assessment

## Executive Summary
- **Service**: [Name and description]
- **Current Environment**: Google Cloud Run
- **Migration Complexity**: [Low/Medium/High]
- **Estimated Timeline**: [Days/weeks]
- **Estimated Azure Cost**: [Monthly estimate]

## Current State Analysis

### Service Configuration
- **CPU**: [value] vCPU
- **Memory**: [value] GB
- **Concurrency**: [value] requests per instance
- **Min/Max Instances**: [min] - [max]
- **Timeout**: [value] seconds
- **Image**: [registry/image:tag]

### Request Characteristics
- **Average Requests/sec**: [value]
- **Peak Requests/sec**: [value]
- **P95 Latency**: [value] ms
- **Average Request Duration**: [value] ms

### Dependencies
[List all service dependencies with connection methods]

### Security
- **Service Account**: [email]
- **IAM Roles**: [list]
- **Secrets**: [count]
- **Ingress**: [public/internal]
- **Authentication**: [required/optional]

## Azure Target Architecture

### Container Apps Configuration
[Describe target configuration]

### Required Azure Resources
- Resource Group
- Container Apps Environment
- Azure Container Registry
- Azure Key Vault (if secrets are used)
- Log Analytics Workspace
- Virtual Network (if VPC connector is used)
- [Other resources based on dependencies]

## Migration Considerations

### Feature Parity
| Feature | Cloud Run | Container Apps | Action Required |
|---------|-----------|----------------|-----------------|
| [Feature] | [Status] | [Status] | [Action] |

### Code Changes Required
- [ ] Update SDK imports (if GCP client libraries used)
- [ ] Update connection strings
- [ ] Update authentication (service account → managed identity)
- [ ] Review timeout handling (if > 30 minutes)
- [ ] Update logging format (if relying on Cloud Logging structure)
- [ ] Update monitoring/alerting queries

### Operational Changes
- [ ] Update deployment pipelines
- [ ] Reconfigure monitoring and alerting
- [ ] Update runbooks and documentation
- [ ] Train team on Azure tools

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Timeout constraint (30m vs 60m) | High | Low | Redesign long-running tasks |
| Cold start latency increase | Med | Med | Use min instances > 0 for critical services |
| Concurrency limit (300 vs 1000) | Med | Low | Validate max concurrency requirements |
| Instance count limit (300 vs 1000) | Med | Low | Consider multi-region if needed |

## Cost Comparison

### GCP Current Costs
- Cloud Run: $[amount]/month
  - Request charges: $[amount]
  - CPU time: $[amount]
  - Memory time: $[amount]
- Other services: $[amount]/month
- **Total**: $[amount]/month

### Azure Projected Costs
- Container Apps: $[amount]/month
  - vCPU hours: $[amount]
  - Memory hours: $[amount]
  - Requests: $[amount]
- Other services: $[amount]/month
- **Total**: $[amount]/month
- **Difference**: [+/-][amount]/month ([percentage]%)

**Note**: Azure Container Apps charges for CPU time rather than request + CPU time separately. Always-allocated CPU may increase costs for low-traffic services.

## Timeline and Milestones

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Assessment | [days] | This report |
| Preparation | [days] | Infrastructure + image migration |
| Migration | [days] | Service deployed to Azure |
| Validation | [days] | Testing complete |
| Optimization | [days] | Performance tuned |
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
- Single container service
- No VPC connectivity
- Standard environment variables only
- Public ingress
- No event triggers
- Standard authentication
- Minimal GCP service dependencies

### Medium Complexity
- Multiple revisions with traffic splitting
- VPC connector for private networking
- Mix of environment variables and secrets
- Internal ingress
- Pub/Sub or Eventarc triggers
- Custom service account with GCP service access
- Cloud Scheduler integration

### High Complexity
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
