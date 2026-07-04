---
name: azure-cloud-migrate
description: "Assess and migrate AWS/GCP workloads to Azure. WHEN: migrate Lambda to Azure Functions, migrate ECS or Cloud Run to Container Apps, migration readiness report, cross-cloud migration."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure Cloud Migrate

## Rules

1. Assess before code migration; keep all output in `<source-folder>-azure/`.
2. Load the scenario reference and follow its rules.
3. Use `mcp_azure_mcp_get_bestpractices` and `mcp_azure_mcp_documentation`.
4. Destructive actions require `ask_user` — [global-rules](references/services/functions/global-rules.md).

## Migration Scenarios

| Source | Target | Reference |
|--------|--------|-----------|
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) |
| AWS ECS/Fargate | Azure Container Apps | [ecs-to-container-apps.md](references/services/container-apps/ecs-to-container-apps.md) |
| GCP Cloud Run | Azure Container Apps | [cloud-run-to-container-apps.md](references/services/container-apps/cloud-run-to-container-apps.md) |

> No match? Use Azure MCP documentation and best-practices tools.

## Output Directory

Use `<source-folder>-azure/`; never modify source files.

## Steps

1. Create `<source-folder>-azure/`.
2. Assess and map services → [assessment.md](references/services/functions/assessment.md).
3. Migrate code/config → [code-migration.md](references/services/functions/code-migration.md).
4. Ask: "Migration complete. Test locally or deploy to Azure?"
5. Hand off to azure-prepare.

Track progress in `migration-status.md` — see [workflow-details.md](references/workflow-details.md).

Container Apps migrations must also load [global-rules.md](references/services/container-apps/global-rules.md), assess with [assessment.md](references/services/container-apps/assessment.md), then migrate with [code-migration.md](references/services/container-apps/code-migration.md).
