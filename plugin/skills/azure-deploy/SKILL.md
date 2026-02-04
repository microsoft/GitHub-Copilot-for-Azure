---
name: azure-deploy
description: |
  Execute deployment to Azure. Final step after preparation and validation. Runs azd up, azd deploy, or infrastructure provisioning commands.
  USE FOR: run azd up, run azd deploy, execute deployment, provision infrastructure, push to production, go live, ship it.
  DO NOT USE FOR: creating or building apps (use azure-prepare), validating before deploy (use azure-validate).
---

# Azure Deploy

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> **PREREQUISITE**: The **azure-validate** skill **MUST** be invoked and completed with status `Validated` BEFORE executing this skill.

> **⛔ STOP — PREREQUISITE CHECK REQUIRED**
> Before proceeding, verify BOTH prerequisites are met:
>
> 1. **azure-prepare** was invoked and completed → `.azure/plan.md` exists
> 2. **azure-validate** was invoked and passed → plan status = `Validated`
>
> If EITHER is missing, **STOP IMMEDIATELY**:
> - No plan? → Invoke **azure-prepare** skill first
> - Status not `Validated`? → Invoke **azure-validate** skill first
>
> **⛔ DO NOT MANUALLY UPDATE THE PLAN STATUS**
>
> You are **FORBIDDEN** from changing the plan status to `Validated` yourself. Only the **azure-validate** skill is authorized to set this status after running actual validation checks. If you update the status without running validation, deployments will fail.
>
> **DO NOT ASSUME** the app is ready. **DO NOT SKIP** validation to save time. Skipping steps causes deployment failures. The complete workflow ensures success:
>
> `azure-prepare` → `azure-validate` → `azure-deploy`

## Triggers

Activate this skill when user wants to:
- Deploy their application to Azure
- Publish, host, or launch their app
- Push updates to existing deployment
- Run `azd up` or `az deployment`
- Ship code to production
- Deploy Azure Functions to the cloud

## Rules

1. Run after azure-prepare and azure-validate
2. Manifest must exist with status `Validated`
3. **Pre-deploy checklist required** — [pre-deploy-checklist](references/pre-deploy-checklist.md)
4. ⛔ **Destructive actions require `ask_user`** — [global-rules](../_shared/global-rules.md)

---

## Steps

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Check Plan** — Read `.azure/plan.md`, verify status = `Validated` AND **Validation Proof** section is populated | — |
| 2 | **Pre-Deploy Checklist** — MUST complete ALL steps | [pre-deploy-checklist](references/pre-deploy-checklist.md) |
| 3 | **Load Recipe** — Based on `recipe.type` in manifest | [recipes/](references/recipes/) |
| 4 | **Execute Deploy** — Follow recipe steps | Recipe README |
| 5 | **Handle Errors** — See recipe's `errors.md` | — |
| 6 | **Verify Success** — Confirm deployment completed and endpoints are accessible | — |

> **⛔ VALIDATION PROOF CHECK**
>
> When checking the plan, verify the **Validation Proof** section (Section 7) contains actual validation results with commands run and timestamps. If this section is empty, validation was bypassed — invoke **azure-validate** skill first.

## Recipes

| Recipe | Reference |
|--------|-----------|
| AZD | [recipes/azd/](references/recipes/azd/) |
| AZCLI | [recipes/azcli/](references/recipes/azcli/) |
| Bicep | [recipes/bicep/](references/recipes/bicep/) |
| Terraform | [recipes/terraform/](references/recipes/terraform/) |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_subscription_list` | List available subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups in subscription |
| `mcp_azure_mcp_azd` | Execute AZD commands |
