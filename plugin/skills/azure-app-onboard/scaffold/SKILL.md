---
name: scaffold
description: "Generate deployment-ready IaC (Bicep default, Terraform alt) and Dockerfiles from prepare-plan.json. 4-layer adversarial self-review, self-healing validation loop (max 3 attempts), writes scaffold-manifest.json. WHEN: \"prepare phase complete\", \"generate infrastructure code\", \"scaffold IaC\", \"create Bicep templates\", \"create Terraform modules\", \"generate Dockerfiles\". DO NOT USE FOR: user-triggered IaC without a prepare-plan (use azure-prepare), subscription-scope landing zones (use azure-enterprise-infra-planner)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure App Onboard Scaffold — IaC Generation + Self-Review

Generate deployment-ready infrastructure code from an architecture plan, verify it with adversarial self-review, and bridge to validation — all without deploying.

## Quick Reference

| Property | Value |
|----------|-------|
| Parent | [azure-app-onboard](../SKILL.md) |
| Best for | Turning `prepare-plan.json` service list into Bicep templates with secure-by-default patterns |
| Inputs | `prepare-plan.json` (services, naming, quotas), `context.json` (overrides, components, repo info) |
| Outputs | `scaffold-manifest.json`, `deployment-summary.md`, generated IaC files in `infra/` |
| Pipeline position | Phase 3 of 4: prereq → prepare → **scaffold** → deploy |
| IaC format | Bicep (v1 default). Terraform when existing `.tf` detected or user override. |

## When to Use This Skill

Invoked by the `azure-app-onboard` orchestrator at Phase 3 when `prepare-plan.json` exists with `services[]`. Not directly user-routable in v1.

> **Return to orchestrator:** When complete, return control to `azure-app-onboard`. Do NOT directly invoke deploy — the orchestrator manages phase transitions.

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| User-triggered IaC (no `prepare-plan.json`) | `azure-prepare` |
| Subscription-scope landing zones | `azure-enterprise-infra-planner` |
| Execute deployment (`azd up`) | `azure-deploy` (do NOT invoke from AppOnboard pipeline) |

## MCP Tools

> See [shared tools](../references/mcp-tool-reference.md) for cross-phase tools and global parameters. See [scaffold tools](references/mcp-tools.md) for full parameter tables.

| Tool | Sub-command | Purpose | Parameters |
|------|-----------|---------|------------|
| `mcp_azure_mcp_bicepschema` | `bicepschema_get` | ARM resource type schemas | `resource_type` (Required), `api_version` (Optional) |
| `mcp_bicep_list_avm_metadata` | *(flat)* | AVM module catalog | None |
| `mcp_bicep_get_bicep_best_practices` | *(flat)* | Bicep best practices | None |
| `mcp_bicep_get_az_resource_type_schema` | *(flat)* | ARM resource type JSON schema | `azResourceType`, `apiVersion` (Required) |
| `mcp_bicep_get_bicep_file_diagnostics` | *(flat)* | Validate `.bicep` files (self-review L3) | `filePath` (Required) |
| `mcp_azure_mcp_deploy` | `deploy_iac_rules_get` | IaC best practices and rules | `deployment-tool`, `iac-type`, `resource-types` |
| `mcp_azure_mcp_deploy` | `deploy_pipeline_guidance_get` | CI/CD pipeline config | `is-azd-project`, `pipeline-platform`, `deploy-option` |
| `mcp_azure_mcp_get_azure_bestpractices` | `get_azure_bestpractices_get` | SDK/Functions best practices | `resource`, `action` |
| `mcp_azure_mcp_azureterraformbestpractices` | *(flat)* | Terraform patterns (TF path only) | `resource_type` (Required) |

## Workflow

**Session folder:** `.copilot-azure/sessions/{uuid}/` — reads `prepare-plan.json` + `context.json`, writes `scaffold-manifest.json`.

### DETECT (Steps 1–4)

1. **Read `prepare-plan.json`** — verify `services[]` exists, read `naming` config (especially `naming.resourcePrefix`, `naming.suffix`, `naming.resources[]`). Read resource group name from `context.json.azure.resourceGroup`. ⛔ **Use EXACTLY these names in generated IaC — do NOT invent names, derive them from `environmentName`, or append your own suffixes.** ⛔ **Use EXACTLY the names from `prepare-plan.json.naming.resources[]` as Bicep parameters. Do NOT derive names with `take()`, `substring()`, or string manipulation. The plan is the source of truth.** Missing → trigger prepare backfill via `azure-app-onboard` orchestrator.
2. **Read `context.json`** — check `overrides[]` for `iacFormat` preference, `detectedInfra[]` for existing `.tf`, `detectedInfraProvider` for cloud provider classification.
3. **Check workspace for existing IaC** — scan for `.tf`, `.bicep`, or `azure.yaml` files. Route based on what's found:
   - **Azure IaC found** (`.bicep` files, `azure.yaml`, or `.tf` with `detectedInfraProvider.terraform` == `"azure"` or `"multi"` with `azurerm` present): tell the user: "Found existing Azure infrastructure files. I won't overwrite your IaC. Please remove or rename before scaffolding." Then **stop**.
   - **Non-Azure IaC found** (`.tf` with `detectedInfraProvider.terraform` == `"gcp"`, `"aws"`, or `"multi"` without `azurerm`): **read `context.json.overrides[]` for `iacFormat`**. The prepare phase already presented the user with a Bicep vs Terraform choice. Respect that decision:
     - `iacFormat == "terraform"`: generate Azure Terraform in a separate directory. See [terraform-patterns.md § Non-Azure IaC coexistence](references/terraform-patterns.md) for output directory rules.
     - No `iacFormat` override (default): generate **Bicep** — the non-Azure TF is separate infrastructure that AppOnboard does not touch.
     - ⛔ **Do NOT auto-force Terraform.** The prepare phase owns the IaC format decision. Scaffold reads it — it does not override it.
   - **`detectedInfraProvider.terraform` == `"unknown"`**: ask user which provider their existing Terraform targets. Wait for response before routing.
   - **No IaC found**: continue normally.
4. **Load IaC patterns** — ⛔ **You MUST read [`bicep-patterns.md`](references/bicep-patterns.md) (Bicep) OR [`terraform-patterns.md`](references/terraform-patterns.md) (Terraform) before generating any IaC.** Do NOT load both formats — load only the one matching the chosen format. Then read the compute-target file: [`bicep-app-service.md`](references/bicep-app-service.md) if any service maps to App Service/Functions, [`bicep-container-apps.md`](references/bicep-container-apps.md) if any service maps to Container Apps. Load both only if the plan includes both compute targets. ⛔ **If the plan includes PostgreSQL or Redis**, you MUST also read [`bicep-patterns-data.md`](references/bicep-patterns-data.md) for service module templates.

### ACTION (Steps 5–10)

> ⛔ **File boundary rule:** NEVER modify files outside `infra/`, `.copilot-azure/`. Do NOT rewrite app source. Do NOT run `npm install` / `pip install` during scaffold — scaffold only writes files. **Exception:** Cloud SDK swaps (iac-generation-rules.md § Step 6) modify app source to replace non-Azure imports, and the post-swap build-validation gate may run install/build/test with explicit user approval.

5. **Generate IaC** — ⛔ **You MUST read [`iac-generation-rules.md`](references/iac-generation-rules.md) before generating any IaC.** It contains session tag requirements, sub-agent delegation rules, security patterns (SCM/FTP auth, managed identity, Key Vault, RBAC), env var completeness, Dockerfile generation (Step 6), secure-by-default verification (Step 7), and telemetry wiring (Step 8). Apply patterns from [bicep-patterns.md](references/bicep-patterns.md) (or [terraform-patterns.md](references/terraform-patterns.md)) + compute-target file loaded at Step 4.

9. **Adversarial self-review** — ⛔ **You MUST read [`self-review-procedure.md`](references/self-review-procedure.md).** Delegates L1–L4 review to a sub-agent with [self-review-checklist.md](references/self-review-checklist.md) + [waf-checklist.md](references/waf-checklist.md). Writes findings to `scaffold-manifest.json.selfReview`.

### VALIDATE → MANIFEST → APPROVE (Steps 10–12.5)

10–12.5. **Validate, write manifest, deploy gate** — ⛔ **You MUST read [`validation-and-manifest.md`](references/validation-and-manifest.md).** Covers: CI/CD (Step 10), IaC validation via `az bicep build` + `what-if` (Step 11), manifest write with `validationResult` (Step 12), deploy approval gate (Step 12.5), and phase exit checklist.

## Self-Healing Loop

⛔ **You MUST read [`scaffold-healing-rules.md`](references/scaffold-healing-rules.md) when validation fails.** Covers healing escalation cadence (3 attempts → ask user → every 5), PLAN_LEVEL_CHANGE rules (service/region changes require re-approval), and artifact consistency requirements. Also read [self-healing.md](references/self-healing.md) for FIXABLE vs BLOCKING classification.

## Error Handling

⛔ **You MUST read [error-handling.md](references/error-handling.md) when any error occurs during scaffold** — it contains remediation procedures for missing plans, existing IaC conflicts, MCP failures, FLAGGED findings, and malformed session state.
