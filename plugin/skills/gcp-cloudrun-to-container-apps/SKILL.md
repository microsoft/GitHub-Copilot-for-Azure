---
name: gcp-cloudrun-to-container-apps
description: "Migrate containerized workloads from Google Cloud Run to Azure Container Apps with assessment reports and deployment guidance. WHEN: migrate Cloud Run to Azure, migrate GCP containers to Azure, Cloud Run to Container Apps, assess Google Cloud migration, convert Cloud Run to Azure, cross-cloud container migration from GCP, migrate serverless containers to Azure."
license: MIT
metadata:
  version: "1.0.1"
  author: Microsoft
---

# Google Cloud Run to Azure Container Apps Migration

> Assess and migrate Google Cloud Run services to Azure Container Apps with service mapping and deployment automation.

## Rules

1. Follow phases sequentially — assessment before migration
2. Generate assessment report before any changes
3. Create output directory `<source-folder>-azure/` at workspace root
4. Never modify source GCP configuration files
5. Use MCP tools for Azure documentation and best practices
6. Destructive actions require user confirmation
7. Track progress in `migration-status.md`

## Required Inputs

Ask only what's needed:

- Cloud Run configuration location (YAML, gcloud commands)
- Target Azure subscription and resource group
- Target Azure region
- Networking requirements (VNet integration yes/no)
- Scaling requirements (min/max replicas)

## Migration Workflow

### Phase 1: Assessment
1. Analyze Cloud Run configuration and dependencies
2. Generate assessment report → `<source-folder>-azure/assessment-report.md`
3. Document service mappings and compatibility

**See details**: [references/assessment-guide.md](references/assessment-guide.md)

### Phase 2: Image Migration
1. Pull images from GCR/Artifact Registry
2. Push to Azure Container Registry
3. Update image references

### Phase 3: Configuration
1. Convert Cloud Run YAML to Container Apps configuration
2. Map environment variables and secrets to Key Vault
3. Create Bicep/Terraform infrastructure files
4. Generate deployment scripts

### Phase 4: Deployment
1. Create Azure Container Apps Environment
2. Deploy Container Apps with converted configuration
3. Configure ingress, scaling, and monitoring
4. Validate functionality and performance

**See details**: [references/deployment-guide.md](references/deployment-guide.md)

## Key Service Mappings

| GCP Service | Azure Equivalent |
|-------------|------------------|
| Cloud Run | Azure Container Apps |
| GCR/Artifact Registry | Azure Container Registry |
| Secret Manager | Azure Key Vault |
| Cloud Logging | Azure Monitor Logs |
| Service Account | Managed Identity |
| VPC Connector | VNet Integration |

Complete mappings in [assessment-guide.md](references/assessment-guide.md).

## Important Differences

- **Timeout**: Cloud Run 60min max vs Container Apps 30min max
- **Concurrency**: Cloud Run 1000 vs Container Apps 300 per replica
- **Max Instances**: Cloud Run 1000 vs Container Apps 300 per revision

## MCP Tools

- `mcp_azure_mcp_documentation` — Azure Container Apps documentation
- `mcp_azure_mcp_get_bestpractices` — Best practices guidance

## Output Directory

```
<source-folder>-azure/
├── assessment-report.md
├── containerapp.yaml
├── main.bicep
├── deploy.sh
└── migration-status.md
```

## Completion

After deployment ask: **"Migration complete. Test locally or optimize costs?"**
