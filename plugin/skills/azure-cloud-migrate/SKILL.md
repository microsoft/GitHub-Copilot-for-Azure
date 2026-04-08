---
name: azure-cloud-migrate
description: "Assess and migrate cross-cloud workloads to Azure with migration reports and code conversion. WHEN: migrate Lambda to Functions, migrate AWS to Azure, migrate Beanstalk to App Service, migrate Heroku to Azure, migrate App Engine to Azure, migrate Cloud Run to Container Apps, migrate ECS to Container Apps, cross-cloud migration, migration readiness report."
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
---

# Azure Cloud Migrate

> This skill handles **assessment and code migration** of existing cloud workloads to Azure.

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment before any code migration
3. Load the scenario reference and follow its rules
4. Use `mcp_azure_mcp_get_bestpractices` and `mcp_azure_mcp_documentation` MCP tools
5. Use the latest supported runtime for the target service
6. Destructive actions require `ask_user` — [functions global-rules](references/services/functions/global-rules.md) | [app-service global-rules](references/services/app-service/global-rules.md)

## Migration Scenarios

| Source | Target | Reference |
|--------|--------|-----------|
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) |
| AWS Elastic Beanstalk | Azure App Service | [beanstalk-to-app-service.md](references/services/app-service/beanstalk-to-app-service.md) |
| Heroku | Azure App Service | [heroku-to-app-service.md](references/services/app-service/heroku-to-app-service.md) |
| Google App Engine | Azure App Service | [app-engine-to-app-service.md](references/services/app-service/app-engine-to-app-service.md) |

> No matching scenario? Use `mcp_azure_mcp_documentation` and `mcp_azure_mcp_get_bestpractices` tools.

## Output Directory

All output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.

## Steps

1. **Create** `<source-folder>-azure/` at workspace root
2. **Assess** — Analyze source, map services, generate report → [functions assessment](references/services/functions/assessment.md) | [app-service assessment](references/services/app-service/assessment.md)
3. **Migrate** — Convert code using target programming model → [functions code-migration](references/services/functions/code-migration.md) | [app-service code-migration](references/services/app-service/code-migration.md)
4. **Ask User** — "Migration complete. Test locally or deploy to Azure?"
5. **Hand off** to azure-prepare for infrastructure, testing, and deployment

Track progress in `migration-status.md` — see [workflow-details.md](references/workflow-details.md).
