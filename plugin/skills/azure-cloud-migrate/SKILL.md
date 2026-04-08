---
name: azure-cloud-migrate
description: "Assess and migrate cross-cloud workloads to Azure with migration reports and code conversion. Supports AWS Lambda→Functions, AWS Fargate→Container Apps, and GCP Cloud Run→Container Apps. WHEN: migrate Lambda to Azure Functions, migrate AWS to Azure, Lambda migration assessment, convert serverless to Azure, migration readiness report, migrate from AWS, migrate from GCP, Cloud Run to Container Apps, Cloud Run migration assessment, migrate Fargate to Container Apps, ECS to Container Apps, Fargate migration assessment."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.3"
---

# Azure Cloud Migrate

> This skill handles **assessment and code migration** of existing cloud workloads to Azure.

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment before any code migration
3. Load the scenario reference and follow its rules
4. Use `mcp_azure_mcp_get_bestpractices` and `mcp_azure_mcp_documentation` MCP tools
5. Use the latest supported runtime for the target service
6. Destructive actions require `ask_user` — [global-rules](references/services/functions/global-rules.md)

## Migration Scenarios

| Source | Target | Reference |
|--------|--------|-----------|
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) ([assessment](references/services/functions/assessment.md), [code-migration](references/services/functions/code-migration.md)) |
| AWS Fargate (ECS/EKS) | Azure Container Apps | [fargate-to-container-apps.md](references/services/container-apps/fargate-to-container-apps.md) |
| GCP Cloud Run | Azure Container Apps | [cloudrun-to-container-apps.md](references/services/container-apps/cloudrun-to-container-apps.md) |

> No matching scenario? Use `mcp_azure_mcp_documentation` and `mcp_azure_mcp_get_bestpractices` tools.

## Output Directory

All output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.

## Steps

1. **Create** `<source-folder>-azure/` at workspace root
2. **Assess** — Analyze source, map services, generate report using scenario-specific assessment guide
3. **Migrate** — Convert code/config using scenario-specific migration guide
4. **Ask User** — "Migration complete. Test locally or deploy to Azure?"
5. **Hand off** to azure-prepare for infrastructure, testing, and deployment

Track progress in `migration-status.md` — see [workflow-details.md](references/workflow-details.md).
