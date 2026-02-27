---
name: azure-migrate
description: "Assess and migrate existing cloud workloads to Azure. Handles cross-cloud migration from AWS, GCP, or other providers to Azure services. USE FOR: migrate Lambda to Azure Functions, migrate AWS to Azure, Lambda migration assessment, convert serverless to Azure, migration readiness report, migrate code to Azure Functions, AWS to Azure migration, migrate from AWS, migrate from GCP, cross-cloud migration, migrate workloads to Azure, Lambda to Functions, migrate existing app to Azure."
---

# Azure Migrate

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill handles **assessment and code migration** of existing cloud workloads to Azure.
> After migration completes, the user reviews the migrated code. Deployment is a separate user-initiated step.

## Quick Reference

| Property | Value |
|----------|-------|
| **Best For** | Assessing & migrating cloud workloads from AWS, GCP, or other providers to Azure |
| **Prereqs** | Source project in workspace |
| **Outputs** | Assessment report, migrated code, migration status |
| **MCP Tools** | `get_bestpractices`, `documentation` |

## Triggers

Activate this skill when user wants to:
- Migrate existing cloud workloads to Azure
- Assess a project for Azure migration readiness
- Convert code from another cloud provider to Azure services
- Generate a migration assessment report

## Rules

1. Follow phases sequentially — do not skip
2. Generate assessment report before any code migration
3. Load the scenario-specific reference (see **Migration Scenarios**) and follow its rules
4. Use `get_bestpractices` tool for Azure-specific code gen guidance
5. **Always use the latest supported runtime** for the target Azure service
6. Update migration status after each phase
7. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/services/functions/global-rules.md)

## Migration Scenarios

Match the user's source workload to a scenario below, then load the corresponding reference for scenario-specific rules, service mappings, and code patterns.

| Source Workload | Target Azure Service | Reference |
|----------------|---------------------|-----------|
| AWS Lambda | Azure Functions | [lambda-to-functions.md](references/services/functions/lambda-to-functions.md) |

> 💡 **No matching scenario?** Use the generic Steps below with `documentation` and `get_bestpractices` tools to research the target Azure service.

## Output Directory

All migration output (assessment report, migrated code, config files) goes into a **new folder at the workspace root**:

```
<aws-project-folder>-azure/     ← workspace root, NOT inside the AWS directory
```

Example: if the source project is `serverless-face-blur-service/`, the output folder is `serverless-face-blur-service-azure/`.

> ⛔ **NEVER modify the original AWS project directory.** The source code must remain untouched for reference.

## Steps

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Create output directory** — Create `<aws-folder>-azure/` at the workspace root | — |
| 2 | **Assess** — Analyze source project, map services to Azure equivalents, generate assessment report into the output directory | Scenario reference (see table above) + [assessment.md](references/services/functions/assessment.md) |
| 3 | **Migrate Code** — Convert code into the output directory using the target Azure programming model and scenario-specific patterns | Scenario reference (see table above) + [code-migration.md](references/services/functions/code-migration.md) |
| 4 | **Ask User** — Use `ask_user` to ask: "Migration complete. Would you like to **test locally** or **deploy to Azure**?" | — |
| 5 | **Hand off to azure-prepare** — Invoke azure-prepare with the user's choice (local test or deploy). azure-prepare handles infrastructure generation, local testing setup, and deployment for both paths. | — |

> 💡 **After step 4:** Regardless of the user's choice, invoke **azure-prepare** next. azure-prepare is the single pipeline for infrastructure (Bicep/Terraform), `azure.yaml`, local testing configuration, and deployment.

## MCP Tools

| Tool | Purpose | When |
|------|---------|------|
| `get_bestpractices` | Azure code gen best practices for target service | Step 2 |
| `documentation` | Azure docs for service mapping and migration guidance | Step 1 |

## Status Tracking

Maintain a `migration-status.md` file in the output directory (`<aws-folder>-azure/`):

```markdown
# Migration Status
| Phase | Status | Notes |
|-------|--------|-------|
| Assessment | ⬜ Not Started | |
| Code Migration | ⬜ Not Started | |
```

Update status: ⬜ Not Started → 🔄 In Progress → ✅ Complete → ❌ Failed

## Error Handling

| Error | Cause | Remediation |
|-------|-------|-------------|
| Unsupported runtime | Source runtime not available in target Azure service | Check target service's supported languages documentation |
| Missing service mapping | Source service has no direct Azure equivalent | Use closest Azure alternative, document in assessment |
| Code migration failure | Incompatible patterns or dependencies | Review scenario-specific guide in [services/](references/services/) |
| `azd init` refuses non-empty directory | azd requires clean directory for template init | Use temp directory approach: init in empty dir, copy files back |

> 💡 For scenario-specific errors (e.g., Azure Functions binding issues, trigger configuration), see the error table in the corresponding scenario reference.

```
