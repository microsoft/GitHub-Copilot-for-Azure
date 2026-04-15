---
name: azure-validate
description: "Validate Azure deployment readiness after azure-prepare. Check azure.yaml, Bicep or Terraform, what-if previews, RBAC, managed identities, policy compliance, and prerequisites before azure-deploy. WHEN: \"check deployment readiness\", \"validate my azure.yaml\", \"validate my Bicep template before deploying to Azure\", \"run a what-if analysis\", \"verify RBAC role assignments\", \"check policy compliance before deployment\"."
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
---

# Azure Validate

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly. This skill owns the validation stage between `azure-prepare` and `azure-deploy`.

## Quick Reference

| Property | Details |
|---|---|
| Best for | Pre-deployment validation after `azure-prepare` and before `azure-deploy` |
| Primary capabilities | Deployment readiness checks, validation commands, what-if previews, RBAC review, policy compliance, proof recording |
| Trigger phrases | `check deployment readiness`, `validate my azure.yaml`, `validate my Bicep template before deploying to Azure`, `run a what-if analysis`, `verify RBAC role assignments` |
| Primary inputs | `.azure/deployment-plan.md`, `azure.yaml`, Bicep, Terraform, deployment configs |
| Next step | Hand off to `azure-deploy` only after validation commands run and proof is recorded |

## When to Use This Skill

- Use this after `azure-prepare` has completed and `.azure/deployment-plan.md` exists with status `Approved` or later.
- Activate for prompts such as:
  - `Check if my app is ready to deploy to Azure`
  - `Validate my azure.yaml configuration before deploying`
  - `Validate my Bicep template before deploying to Azure`
  - `Run a what-if analysis to preview changes before deploying my infrastructure`
  - `Verify the RBAC role assignments in my Bicep templates before deploying to Azure`
  - `Check my Bicep against Azure Policy`

> **STOP — PREREQUISITE CHECK REQUIRED**
>
> Before proceeding, verify `azure-prepare` completed and `.azure/deployment-plan.md` exists with status `Approved` or later.
>
> If the plan is missing, stop immediately and invoke `azure-prepare` first.
>
> Required workflow: `azure-prepare` -> `azure-validate` -> `azure-deploy`

## MCP Tools

| Tool | Use it for | Key parameters to confirm |
|---|---|---|
| `azure-policy` | Validate policy assignments, enforcement, and compliance blockers | subscription, scope, assignment/definition |
| `azure-role` | Verify RBAC assignments and access scope | subscription, scope, principal, role |
| `azure-quota` | Check region availability and quota blockers before deployment | subscription, region, resource type |
| `azure-documentation` | Confirm Azure service constraints or official validation guidance | intent, command/parameters |

## Rules

1. Run after `azure-prepare`, before `azure-deploy`.
2. All checks must pass; do not deploy with validation failures.
3. Do not invoke `azure-deploy` until a validation command has run, proof is recorded, and the plan status is `Validated`.
4. If the user only asked for validation, stop after recording proof and reporting the results.
5. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)

## Workflow

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Load Plan** — Read `.azure/deployment-plan.md` for recipe and configuration. If missing, run `azure-prepare` first. | `.azure/deployment-plan.md` |
| 2 | **Add Validation Steps** — Copy recipe "Validation Steps" to `.azure/deployment-plan.md` as children of "All validation checks pass" | [recipes/README.md](references/recipes/README.md), `.azure/deployment-plan.md` |
| 2a | **Aspire Functions Pre-Check** *(if applicable)* — If the project uses .NET Aspire with Azure Functions (`AddAzureFunctionsProject` found in AppHost source), verify `AzureWebJobsSecretStorageType` is configured and add `.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` to the builder chain in `AppHost.cs` if missing — **must run BEFORE provisioning** | [aspire-functions-secrets.md](references/aspire-functions-secrets.md) |
| 3 | **Run Validation** — Execute recipe-specific validation commands | [recipes/README.md](references/recipes/README.md) |
| 4 | **Build Verification** — Build the project and fix any errors before proceeding | See recipe |
| 5 | **Static Role Verification** — Review Bicep/Terraform for correct RBAC role assignments in code | [role-verification.md](references/role-verification.md) |
| 5a | **Policy Compliance Check** *(optional)* — If user requests policy check or Bicep targets a policy-governed subscription, check against Azure Policy | [bicep-policy-check-workflow.md](references/bicep-policy-check-workflow.md) |
| 6 | **Record Proof** — Populate **Section 7: Validation Proof** with commands run and results | `.azure/deployment-plan.md` |
| 7 | **Resolve Errors** — Fix failures before proceeding | See recipe's `errors.md` |
| 8 | **Update Status** — Only after ALL checks pass, set status to `Validated` | `.azure/deployment-plan.md` |
| 9 | **Hand Off** — After steps 1-8 are complete, invoke **azure-deploy** as the next skill. Do not jump to deployment before validation has started and proof is recorded. | — |

> **VALIDATION AUTHORITY**
>
> This skill is the **ONLY** authorized way to set plan status to `Validated`. You MUST:
> 1. Run actual validation commands (azd provision --preview, bicep build, terraform validate, etc.)
> 2. Populate **Section 7: Validation Proof** with the commands you ran and their results
> 3. Only then set status to `Validated`
>
> Do NOT set status to `Validated` without running checks and recording proof.

## Error Handling

| Error | Message or symptom | Remediation |
|---|---|---|
| Missing plan file | `.azure/deployment-plan.md` not found | Stop and invoke `azure-prepare` first. |
| Validation command fails | `bicep build`, `terraform validate`, `azd provision --preview`, or `what-if` returns an error | Fix the reported issue, rerun validation, and record the final passing output in Validation Proof. |
| Policy check blocked | `403 Forbidden` or policy check permission denied | Report the missing `Microsoft.PolicyInsights/checkPolicyRestrictions/action` permission and continue with other validation steps where possible. |
| Region or quota blocker | Requested SKU or region unavailable | Use quota or region checks, suggest a supported alternative, and keep the plan in a non-validated state until resolved. |
