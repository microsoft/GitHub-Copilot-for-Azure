---
name: gcp-cloudrun-to-container-apps
description: Migrate containerized workloads from Google Cloud Run to Azure Container Apps with assessment reports and deployment guidance. WHEN: migrate Cloud Run to Azure, migrate GCP containers to Azure, Cloud Run to Container Apps, assess Google Cloud migration, convert Cloud Run to Azure, cross-cloud container migration from GCP, migrate serverless containers to Azure.
license: MIT
metadata:
  version: 1.0.0
  author: GitHub Copilot for Azure
---

# Google Cloud Run to Azure Container Apps Migration

> **MIGRATION SKILL** — Assess and migrate containerized workloads from Google Cloud Run to Azure Container Apps with comprehensive analysis, service mapping, and deployment guidance.

## Quick Reference

| Item | Details |
|------|---------|
| Best for | Migrating Google Cloud Run services to Azure Container Apps |
| Source | Google Cloud Run (managed, serverless containers) |
| Target | Azure Container Apps |
| MCP Tools | mcp_azure_mcp_documentation, mcp_azure_mcp_get_bestpractices |
| CLI | az containerapp create, az containerapp update, az acr build |
| Related skills | azure-deploy, azure-cloud-migrate, azure-kubernetes |

## When to Use This Skill

Activate this skill when the user wants to:

- Migrate Google Cloud Run services to Azure Container Apps
- Assess GCP Cloud Run workloads for Azure migration
- Convert Cloud Run YAML to Azure Container Apps configuration
- Migrate serverless container workloads from GCP to Azure
- Plan cross-cloud container migration from Google Cloud to Azure
- Understand service mapping between Cloud Run and Azure Container Apps

## Rules

1. Follow migration phases sequentially — assessment before migration
2. Generate comprehensive assessment report before any code changes
3. Create output directory `<source-folder>-azure/` at workspace root
4. Never modify source GCP configuration files
5. Use Azure MCP tools for documentation and best practices
6. Map GCP service dependencies to Azure equivalents
7. Validate container image compatibility
8. Destructive actions (deployments) require user confirmation
9. Track progress in `migration-status.md`

## Required Inputs (Ask only what's needed)

If the user is unsure, provide safe defaults or guide discovery:

- Google Cloud Run configuration location (service YAML, gcloud commands)
- Target Azure subscription and resource group
- Target Azure region
- Container registry preference (Azure Container Registry or existing)
- Networking requirements (VNet integration, ingress/egress)
- Environment variables and secrets strategy
- Scaling requirements (min/max replicas, concurrency)

## Migration Workflow

### Phase 1: Discovery & Assessment

1. **Locate GCP Configuration**: Find Cloud Run service YAML, gcloud commands, or console configurations
2. **Analyze Components**:
   - Container images and Artifact Registry/GCR locations
   - CPU/memory allocations and limits
   - Environment variables and secrets (Secret Manager)
   - Service accounts and IAM permissions
   - Networking (VPC connectors, Cloud Load Balancing)
   - Service dependencies (Cloud SQL, Cloud Storage, Pub/Sub, Firestore, etc.)
   - Request concurrency and timeouts
   - Logging and monitoring (Cloud Logging, Cloud Monitoring)
   - Auto-scaling configuration (min/max instances, CPU utilization)
   - Request authentication and authorization
3. **Generate Assessment Report** → `<source-folder>-azure/assessment-report.md`:
   - Source workload inventory
   - Service mapping (GCP → Azure)
   - Compatibility analysis
   - Migration complexity rating
   - Cost estimation
   - Recommended Azure services
   - Required changes and considerations

📋 **See detailed assessment checklist**: [references/assessment-guide.md](references/assessment-guide.md)

### Phase 2: Service Mapping

Map Google Cloud Run components to Azure equivalents:

| GCP Service | Azure Equivalent | Notes |
|-------------|------------------|-------|
| Cloud Run | Azure Container Apps | Serverless container platform with similar features |
| Google Container Registry (GCR) | Azure Container Registry | Private container registry |
| Artifact Registry | Azure Container Registry | Modern container registry |
| Cloud Load Balancing | Container Apps Ingress | Built-in with automatic HTTPS and custom domains |
| Secret Manager | Azure Key Vault | Managed secrets with Container Apps integration |
| Cloud Logging | Azure Monitor/Log Analytics | Built-in Container Apps integration |
| Cloud Monitoring | Azure Monitor Metrics | Auto-configured for Container Apps |
| Service Account | Managed Identity | Azure AD integration for authentication |
| VPC Connector | Virtual Network Integration | VNet connectivity for Container Apps |
| Cloud IAM | Azure RBAC + Managed Identity | Identity and access management |
| Concurrency Settings | Container Apps concurrency | Max concurrent requests per replica |
| Cloud Scheduler | Azure Logic Apps/Functions Timer | Scheduled invocations |
| Cloud Tasks | Azure Queue Storage + Container Apps | Background job processing |
| Eventarc | Azure Event Grid | Event-driven triggers |

### Phase 3: Configuration Conversion

1. **Convert Cloud Run Services**:
   - Transform Cloud Run YAML to Container Apps YAML
   - Map CPU/memory to Container Apps resource limits
   - Convert environment variables
   - Update secret references to Key Vault
   - Map concurrency settings
   - Convert request timeout settings
2. **Create Infrastructure Files** in `<source-folder>-azure/`:
   - `containerapp.yaml` — Container Apps configuration
   - `main.bicep` or `main.tf` — Infrastructure as Code (prefer Bicep)
   - `env-vars.yaml` — Environment configuration
   - `secrets.txt` — List of secrets to configure (values not included)
3. **Migration Scripts**:
   - `deploy.sh` or `deploy.ps1` — Deployment automation
   - `setup-resources.sh` — Resource group, registry, environment setup

### Phase 4: Pre-Migration Preparation

1. **Container Registry**:
   - Create or use existing Azure Container Registry
   - Migrate container images from GCR/Artifact Registry to ACR
   - Update image references in configurations
   - Configure ACR authentication
2. **Azure Resources**:
   - Create resource group
   - Create Container Apps Environment
   - Configure Virtual Network (if VPC connector was used)
   - Set up Azure Key Vault for secrets
   - Configure Log Analytics workspace
3. **Dependencies**:
   - Identify and migrate/map dependent services:
     - Cloud SQL → Azure Database for PostgreSQL/MySQL
     - Cloud Storage → Azure Blob Storage
     - Firestore → Azure Cosmos DB
     - Pub/Sub → Azure Service Bus or Event Grid
   - Update connection strings and endpoints
   - Configure managed identities for authentication

### Phase 5: Deployment

1. **Deploy Container Apps**:
   - Create Container Apps with converted configuration
   - Configure ingress rules (public or internal)
   - Set up custom domains and SSL certificates
   - Configure scaling rules (HTTP, CPU, memory)
   - Set concurrency limits per replica
   - Configure request timeout and startup probes
2. **Configure Monitoring**:
   - Enable Azure Monitor integration
   - Set up log streaming and queries
   - Configure alerts and dashboards
   - Map Cloud Monitoring metrics to Azure Monitor
3. **Testing Checklist** in `<source-folder>-azure/testing-checklist.md`:
   - Container startup and health checks
   - Application functionality and endpoints
   - Environment variables and secrets access
   - Authentication and authorization
   - Network connectivity to dependencies
   - Scaling behavior (scale to zero, scale out)
   - Request concurrency handling
   - Timeout behavior
   - Logging and monitoring
   - Performance comparison with Cloud Run

🚀 **See detailed deployment instructions**: [references/deployment-guide.md](references/deployment-guide.md)

### Phase 6: Optimization

1. **Review and optimize**:
   - Cost analysis and optimization
   - Performance tuning (CPU/memory allocation)
   - Security hardening (managed identities, network policies)
   - Scaling rules refinement
   - Cold start optimization
2. **Document**:
   - Architecture changes and differences
   - Operational procedures (deployment, rollback)
   - Monitoring and alerting setup
   - Cost management strategies
   - Rollback plan to Cloud Run (if needed)

## Output Directory Structure

All migration artifacts created in `<source-folder>-azure/`:

```
<source-folder>-azure/
├── migration-status.md          # Progress tracking
├── assessment-report.md         # Detailed analysis
├── containerapp.yaml            # Container Apps spec
├── main.bicep                   # Infrastructure as Code
├── env-vars.yaml                # Environment configuration
├── secrets.txt                  # Secrets reference list
├── testing-checklist.md         # Validation steps
├── deploy.sh                    # Deployment script
└── docs/
    ├── architecture.md          # Architecture documentation
    ├── service-mapping.md       # GCP to Azure mapping details
    ├── feature-comparison.md    # Cloud Run vs Container Apps features
    └── operational-guide.md     # Operations and maintenance
```

## Key Differences: Cloud Run vs Container Apps

Document these differences for user awareness:

| Feature | Cloud Run | Azure Container Apps | Notes |
|---------|-----------|---------------------|-------|
| Scale to Zero | Yes, default | Yes, configurable | Both support serverless scaling |
| Min Instances | 0-1000 | 0-300 per revision | Container Apps has lower max currently |
| Request Timeout | 60 min max | 240s default, 1800s max | Container Apps has shorter timeout |
| Concurrency | 1-1000 per instance | 1-300 per replica | Similar capability, different limits |
| Cold Start | Optimized | Standard | Cloud Run may have faster cold starts |
| WebSockets | Supported | Supported | Both support long-lived connections |
| gRPC | Native support | Supported | Both support gRPC services |
| CPU Allocation | Request-based or always | Always allocated | Container Apps always allocates CPU |
| Ingress | Automatic HTTPS | Automatic HTTPS | Similar capabilities |

## Guardrails / Safety

- Do not output secret values in files or logs
- Always ask for confirmation before deploying to Azure
- Never modify source GCP configurations
- Validate Azure region supports Container Apps
- Check Azure subscription quotas before deployment
- Use managed identities instead of connection strings when possible
- Enable HTTPS ingress by default
- Document differences in timeout and concurrency limits
- Warn about potential cold start differences
- Handle authentication differences (Cloud Run allows unauthenticated by default)

## MCP Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| mcp_azure_mcp_documentation | Get official Azure Container Apps documentation | Query for specific features and configurations |
| mcp_azure_mcp_get_bestpractices | Retrieve Container Apps best practices | Request guidance for security, networking, scaling |

## Error Handling

| Error | Likely Cause | Resolution |
|-------|--------------|------------|
| Image pull fails | ACR authentication or image not migrated | Verify ACR access, check image exists in ACR, configure managed identity |
| Container fails to start | Configuration mismatch or missing dependencies | Review logs with `az containerapp logs`, validate environment variables and secrets |
| Networking issues | VNet integration misconfigured | Verify subnet delegation, NSG rules, and private DNS configuration |
| Secrets not accessible | Key Vault permissions missing | Grant Container Apps managed identity access to Key Vault |
| Scaling not working | Invalid scaling rules or limits | Review and adjust scaling triggers, check min/max replica settings |
| Request timeout | Timeout too short for workload | Increase timeout setting (max 1800s), optimize application performance |
| Authentication fails | Managed identity not configured | Set up managed identity and grant appropriate RBAC permissions |

## Common Migration Patterns

### Pattern 1: Public HTTP Service
- Cloud Run with public access → Container Apps with public ingress
- No authentication → Configure Azure AD or API key authentication

### Pattern 2: Internal Service with VPC
- Cloud Run with VPC connector → Container Apps with VNet integration
- Internal load balancer → Internal ingress only

### Pattern 3: Event-Driven Service
- Pub/Sub → Cloud Run → Azure Event Grid/Service Bus → Container Apps
- Cloud Scheduler → Cloud Run → Azure Logic Apps/Functions Timer → Container Apps

### Pattern 4: Database-Connected Service
- Cloud SQL → Cloud Run → Azure Database → Container Apps
- Use managed identity for database authentication in Azure

## Completion Criteria

Before marking migration complete:

- [ ] Assessment report generated and reviewed
- [ ] All container images migrated to ACR
- [ ] Container Apps deployed successfully
- [ ] All environment variables and secrets configured
- [ ] Authentication and authorization tested
- [ ] Networking and ingress verified
- [ ] Dependent services connected and tested
- [ ] Scaling behavior validated (including scale to zero)
- [ ] Monitoring and logging operational
- [ ] Performance validated against Cloud Run baseline
- [ ] Documentation complete
- [ ] User confirms application functionality

Ask User: **"Migration complete. Would you like to review the deployment, optimize costs, or set up CI/CD pipelines?"**
