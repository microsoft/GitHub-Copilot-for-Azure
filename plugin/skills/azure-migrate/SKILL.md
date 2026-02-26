```skill
---
name: azure-migrate
description: "Assess and migrate existing cloud workloads to Azure, including AWS Lambda to Azure Functions migration. WHEN: \"migrate Lambda to Functions\", \"migrate AWS to Azure\", \"Lambda migration assessment\", \"convert serverless to Azure\", \"migration readiness report\", \"migrate code to Azure Functions\"."
license: MIT
metadata:
  version: "1.0"
---

# Azure Migrate

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill handles **assessment and code migration** of existing cloud workloads to Azure.
> After migration, hand off to **azure-prepare → azure-validate → azure-deploy** for infrastructure, validation, and deployment.

## Quick Reference

| Property | Value |
|----------|-------|
| **Best For** | Assessing & migrating AWS Lambda → Azure Functions code |
| **Prereqs** | Source project in workspace |
| **Outputs** | Assessment report, migrated function code, migration status |
| **MCP Tools** | `get_bestpractices`, `documentation` |
| **Handoff** | → azure-prepare → azure-validate → azure-deploy |

## Triggers

Activate this skill when user wants to:
- Migrate AWS Lambda functions to Azure Functions
- Assess an AWS Lambda project for Azure migration readiness
- Convert serverless code from AWS to Azure
- Generate a migration assessment report

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment report before any code migration
3. Use Azure Functions best practices from `get_bestpractices` tool
4. **Always use bindings and triggers instead of SDKs** — Use `input.storageBlob()`, `output.storageBlob()`, `app.storageQueue()`, etc. for all storage and queue operations. Only fall back to SDK when no binding exists for the target service (e.g., Azure AI Face API)
5. **Always use the latest supported language runtime** — Check [supported languages](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages) and use the newest GA version (e.g., Node.js 22, Python 3.11, .NET 8). Never default to older LTS versions when a newer one is supported
6. Update migration status after each phase
7. After code migration, hand off to **azure-prepare** for IaC generation
8. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)
9. **Blob trigger + EventGrid source on Flex Consumption requires always-ready** — Configure `alwaysReady: [{ name: 'blob', instanceCount: 1 }]` to avoid the bootstrap problem where the trigger group never starts
10. **EventGrid source blob triggers require queue endpoint** — Always provision `AzureWebJobsStorage__queueServiceUri` alongside the blob endpoint — the blob extension uses queues internally for poison-message tracking
11. **Deploy Event Grid subscriptions via Bicep/ARM, not CLI** — CLI webhook validation times out on Flex Consumption. Use `listKeys()` in Bicep to get the `blobs_extension` system key at deployment time
12. **UAMI requires explicit client ID in DefaultAzureCredential** — Always pass `{ managedIdentityClientId: process.env.AZURE_CLIENT_ID }` when using User Assigned Managed Identity
13. **Pin beta Azure SDK versions explicitly** — Some Azure SDKs (e.g., `@azure-rest/ai-vision-image-analysis`) are beta-only. Use exact versions like `1.0.0-beta.3` — semver ranges like `^1.0.0` won't resolve

## Migration Scenarios

| Scenario | Reference |
|----------|-----------|
| AWS Lambda → Azure Functions | [services/lambda-to-functions.md](references/services/lambda-to-functions.md) |

## Steps

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Assess** — Analyze source project, map services, generate assessment report | [assessment.md](references/assessment.md) |
| 2 | **Migrate Code** — Convert functions using target programming model | [code-migration.md](references/code-migration.md) |
| 3 | **Hand Off** — Invoke **azure-prepare** with assessment context for IaC, then **azure-validate** and **azure-deploy** | — |

## Handoff to Azure Pipeline

After completing assessment and code migration:

1. **→ azure-prepare** — Generates IaC (Bicep/Terraform), `azure.yaml`, security hardening, and `.azure/preparation-manifest.md`. The assessment report's service mapping table provides the requirements input, replacing the manual "gather requirements" step.
2. **→ azure-validate** — Validates IaC, code structure, and deployment readiness.
3. **→ azure-deploy** — Deploys validated project to Azure via `azd up` or equivalent.

> 💡 **Tip:** The assessment report produced in Phase 1 contains the service mapping and architecture that azure-prepare needs. Pass this context when invoking azure-prepare.

## MCP Tools

| Tool | Purpose | When |
|------|---------|------|
| `get_bestpractices` | Azure Functions code gen best practices | Phase 2 |
| `documentation` | Azure docs for service mapping | Phase 1 |

## Status Tracking

Maintain a `migration-status.md` file in the workspace root:

```markdown
# Migration Status
| Phase | Status | Notes |
|-------|--------|-------|
| Assessment | ⬜ Not Started | |
| Code Migration | ⬜ Not Started | |
| Handoff to azure-prepare | ⬜ Not Started | |
```

Update status: ⬜ Not Started → 🔄 In Progress → ✅ Complete → ❌ Failed

## Error Handling

| Error | Cause | Remediation |
|-------|-------|-------------|
| Unsupported runtime | Lambda runtime not available in Functions | Check [supported languages](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages) |
| Missing service mapping | AWS service has no direct Azure equivalent | Use closest Azure alternative, document in assessment |
| Code migration failure | Incompatible patterns or dependencies | Review scenario guide in [services/](references/services/) |
| Blob trigger never fires (Flex Consumption) | Missing always-ready config for EventGrid source | Add `alwaysReady: [{ name: 'blob', instanceCount: 1 }]` to Bicep |
| QueueServiceClient constructor error | Missing queue endpoint for EventGrid source blob trigger | Add `AzureWebJobsStorage__queueServiceUri` app setting |
| Event Grid subscription creation fails via CLI | Webhook validation handshake timeout | Deploy via Bicep/ARM instead — see [lambda-to-functions.md](references/services/lambda-to-functions.md) |
| DefaultAzureCredential auth failure | UAMI not specified, trying SystemAssigned | Pass `{ managedIdentityClientId: process.env.AZURE_CLIENT_ID }` |
| RequestDisallowedByPolicy on Cognitive Services | Enterprise policy requires `disableLocalAuth: true` | Set `disableLocalAuth: true`, use UAMI + Cognitive Services User RBAC |
| npm install resolves no version for `^1.0.0` | Azure SDK package is beta-only | Pin exact beta version (e.g., `1.0.0-beta.3`) |
| `azd init` refuses non-empty directory | azd requires clean directory for template init | Use temp directory approach: init in empty dir, copy files back |

## Next

**→ Invoke azure-prepare to generate infrastructure and prepare for deployment**

```
