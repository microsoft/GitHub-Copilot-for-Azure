---
name: deploy
description: "Validates IaC, runs preflight checks, presents an approval gate with cost and resource summary, executes Bicep or Terraform deployment, performs post-deploy health checks, and writes deploy-result.json."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Deploy — IaC Execution & Health Verification

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Executing validated IaC against Azure, health-checking deployed resources |
| Inputs | `prepare-plan.json` + `scaffold-manifest.json` from `.copilot-azure/sessions/{id}/` |
| Outputs | `deploy-result.json` written to session directory |
| Parent | [azure-app-onboard](../SKILL.md) |

## When to Use This Skill

Invoked by the `azure-app-onboard` orchestrator at Phase 4 when `scaffold-manifest.json` exists with `files[]` and `validationResult`. Not directly user-routable.

> **Return to orchestrator:** When complete, return control to `azure-app-onboard` for handoff (Step 10). Do NOT start new phases.

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Plan architecture, map services, estimate costs | [prepare](../prepare/SKILL.md) |
| Generate IaC files from a plan | `azure-app-onboard` Step 7 (scaffold) |
| Run `azd up` or execute existing deployment templates | `azure-deploy` |
| Debug a running app after deployment | `azure-diagnostics` |
| Optimize existing Azure spending | `azure-cost` |

## Workflow

> ⛔ **Sub-agent delegation is MANDATORY for Step 0.** Read `subagent-preflight.md`, then dispatch as a `task` with the **COMPLETE and UNMODIFIED** template text between `<<<TEMPLATE_START>>>` / `<<<TEMPLATE_END>>>` delimiters. Do NOT summarize or rewrite the template — the sub-agent needs every "Read [file]" instruction to produce a correct `deploy-checklist.md`. Append session artifact data AFTER the template block. If your next action after reading the template is anything other than `task`, you are executing it inline instead of delegating.

> ⛔ **Healing loop:** ask user after 3 attempts, then every 5 (counter = `healingAttempts[].length`).

> ⛔ **Region lock:** Before `az deployment` retry, compare `--location` against `prepare-plan.json.deploymentVariables.location`. If changed → re-approval gate required. Update plan after approval.

> ⛔ **After compaction or any `az deployment`/`az webapp deploy`/`az acr build`/failed health check: re-read `deploy-checklist.md`.** If missing → fill from [`deploy-checklist-template.md`](references/deploy-checklist-template.md). On significant context loss: also re-read this SKILL.md.

| # | Step | Action | Artifact | Reference |
|---|------|--------|----------|-----------|
| 0 | **Dispatch preflight sub-agent** | ⛔ **You MUST dispatch [`subagent-preflight.md`](references/subagent-preflight.md) as a `task`.** ⛔ agent_type: `"task"` — NEVER `"general-purpose"`. Read the template, then your NEXT action MUST be `task`. If after reading the template your next action is `powershell`, `view`, or anything other than `task`, STOP — you are executing inline instead of delegating. Writes `deploy-checklist.md`. **`view` it immediately after return.** | `deploy-checklist.md` | ⛔ **You MUST read [`subagent-preflight.md`](references/subagent-preflight.md)** |
| 1 | **Read upstream artifacts** | Load `prepare-plan.json` + `scaffold-manifest.json`. Check `validationResult`. Resolve subscription + deployment variables. | — | — |
| 3 | **Preflight checks** | Auth, **mandatory what-if preview**, RBAC, RG per `deploy-checklist.md` § Preflight. | — | ⛔ **You MUST read `deploy-checklist.md`** (re-read if compaction occurred) |
| 4 | **Deploy approval gate** | Present cost + resource summary per `deploy-checklist.md` § Deploy approval gate format. | — | — |
| 5b | **Write deploy-result.json skeleton** | ⛔ Read [`deploy-schemas.ts`](references/deploy-schemas.ts), write skeleton (`status: "in-progress"`). Must exist BEFORE first `az` command. | `deploy-result.json` | ⛔ **You MUST read [`deploy-schemas.ts`](references/deploy-schemas.ts)** |
| 6 | **Execute deployment** | ⛔ **BEFORE `az deployment sub create`:** Generate portal link — `$dn="{deploymentName}"; $r="/subscriptions/{subId}/providers/Microsoft.Resources/deployments/$dn"; $l="https://portal.azure.com/#view/Microsoft_Azure_Resources/DeploymentDetails.MenuView/~/overview/id/$($r.Replace('/','%2F'))"; Write-Output "LINK=$l"`. ⛔ **Auto-open link in browser:** `Start-Process $l 2>$null`. Print bare URL in chat (ctrl-clickable).<br>Auto-generate ALL `@secure()` params (`openssl rand -base64 32 \| tr -d '/+='`), NEVER `ask_user` for passwords; on retry reuse from `deploy-audit.log` or Key Vault. THEN deploy IaC. | — | ⛔ **You MUST read `deploy-checklist.md`** § Execute deployment |
| 6b | **Deploy application code** | ⛔ Deploy code for EVERY service in `prepare-plan.json.services[]`. Follow `deploy-checklist.md` § Code deploy. | — | ⛔ **You MUST read `deploy-checklist.md`** § Code deploy |
| 7 | **Health-check + SCM re-disable** | HTTP GET per endpoint (max 3 iterations). ⛔ **Multi-service apps:** Also inspect the response body for error patterns (`connection refused`, `MODULE_NOT_FOUND`, `localhost`, `SET-IN-DEPLOY-PHASE`) — HTTP 200 alone does not mean functional when the app depends on another service or KV secrets. Then ⛔ for EVERY App Service/Functions app run BOTH commands — no exceptions: `az rest --method put --url "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/basicPublishingCredentialsPolicies/scm?api-version=2023-12-01" --headers "Content-Type=application/json" --body '{"properties":{"allow":false}}'` then verify: `az rest --method get --url "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/basicPublishingCredentialsPolicies/scm?api-version=2023-12-01" --query properties.allow -o tsv` (must return `false`). | `deploy-result.json` full | ⛔ **You MUST read `deploy-checklist.md`** § Health check |
| 8 | **Finalize artifacts** | ⛔ Read [`deploy-schemas.ts`](references/deploy-schemas.ts). ⛔ Re-read `deploy-checklist.md` § Artifact verification — follow ALL 5 checks. Write final `deploy-result.json` (fill ALL fields — status, healthStatus, endpoints, completedUtc, healingAttempts). Write `deployment-summary.md` (status table + health + cleanup commands — same content as your handoff message). Update `context.json` — add `"deploy"` to `completedPhases`, `currentPhase: null`, `lastModifiedUtc`. Verify all 3 files exist by reading back. | `deploy-result.json` final + `deployment-summary.md` + `context.json` update | ⛔ **You MUST read [`deploy-schemas.ts`](references/deploy-schemas.ts)** + ⛔ **Re-read `deploy-checklist.md` § Artifact verification** |
| 9 | **Error handling + healing** | ⛔ **Only if Steps 6/6b/7 returned nonzero exit code or health check failed.** Skip entirely on clean deploys. Classify errors, healing loop, PLAN_LEVEL_CHANGE re-approval per `deploy-checklist.md` § During healing. ⛔ **Even on unrecoverable failure:** write `deploy-result.json` with `status: "failed"` and `errorDetails` before returning to orchestrator — the artifact must always exist. | — | ⛔ **You MUST read [`error-classification.md`](references/error-classification.md)** |
