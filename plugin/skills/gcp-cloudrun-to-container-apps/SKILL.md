---
name: gcp-cloudrun-to-container-apps
description: "Migrate containerized workloads from Google Cloud Run to Azure Container Apps with assessment reports and deployment guidance. WHEN: migrate Cloud Run to Azure, migrate GCP containers to Azure, Cloud Run to Container Apps, assess Google Cloud migration, convert Cloud Run to Azure, cross-cloud container migration from GCP, migrate serverless containers to Azure."
license: MIT
metadata:
  version: "1.0.1"
  author: Microsoft
---

# Google Cloud Run to Azure Container Apps Migration

> Assess and migrate Cloud Run services to Azure Container Apps with service mapping and deployment automation.

## Rules

1. Follow phases sequentially — assessment before migration
2. Generate assessment report before changes
3. Create output `<source-folder>-azure/` at workspace root
4. Never modify source GCP files
5. Use MCP tools for Azure documentation
6. Destructive actions require user confirmation

## Required Inputs

- Cloud Run configuration location
- Target subscription, resource group, region
- Networking (VNet yes/no)
- Scaling (min/max replicas)

## Migration Workflow

### Phase 1: Assessment
Analyze Cloud Run config, dependencies → generate assessment report

[See assessment-guide.md](references/assessment-guide.md)

### Phase 2: Image Migration
Pull from GCR/Artifact Registry → push to Azure Container Registry

### Phase 3: Configuration
Convert YAML, map secrets to Key Vault, create Bicep/Terraform

### Phase 4: Deployment
Deploy Container Apps, configure ingress/scaling, validate

[See deployment-guide.md](references/deployment-guide.md)

## Key Mappings

Cloud Run → Container Apps | GCR → ACR | Secret Manager → Key Vault | Cloud Logging → Monitor Logs | Service Account → Managed Identity | VPC Connector → VNet

Details in [assessment-guide.md](references/assessment-guide.md).

## Critical Differences

- Timeout: 60min → 30min
- Concurrency: 1000 → 300
- Max instances: 1000 → 300

## MCP Tools

`mcp_azure_mcp_documentation`, `mcp_azure_mcp_get_bestpractices`

## Completion

Ask: **"Migration complete. Test or optimize costs?"**
