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

> ⛔ **Read [`deploy-safety.md`](references/deploy-safety.md) and [`blocked-patterns.md`](references/blocked-patterns.md) BEFORE any commands.** They contain shell execution rules (sync vs async), secret generation patterns, and every command the agent is forbidden from executing.

> ⛔ **ALWAYS write `deploy-result.json` — even on failure.** Write the skeleton at Step 5b BEFORE the first `az` command. Artifact writes are distributed, not batched — each step writes its own artifacts. If the output budget is hit mid-deploy, the skeleton ensures the orchestrator knows deploy started.

> ⛔ **Healing loop: ask user after 3 attempts, then every 5.** The single counter is the length of `deploy-result.json.healingAttempts[]`. Every command-executing fix attempt counts — regardless of whether the root cause changes between attempts. After 3: pause, explain the error pattern, propose a fix, ask "Yes, try that / I have a suggestion / Stop." After approval, 5 more before asking again.

> ⛔ **Audit log — INCREMENTAL.** After EVERY `az deployment`, `terraform apply`, `az webapp deploy`, `az acr build`, `az rest`, and `az webapp config` command, IMMEDIATELY append to `.copilot-azure/sessions/{id}/deploy-audit.log` using the `create` tool (or shell `Add-Content` for appends): `{ISO-timestamp} | {command-summary} | {started|succeeded|failed}`. Do NOT defer to phase exit. Each command = 2 entries (started + result), written in the SAME turn.

> ⛔ **Post-compaction / after `az deployment`, `az webapp deploy`, `az acr build`, or failed health check: re-read `deploy-checklist.md`** from the session folder — scaffold wrote it at phase exit.
> 1. **If it exists:** follow it as the personalized runbook for this deployment.
> 2. **If missing:** read [`deploy-checklist-template.md`](references/deploy-checklist-template.md), fill in values from `prepare-plan.json`, write `deploy-checklist.md`, then read it back.
> 3. Re-read this SKILL.md (Steps 6–8) and any active reference file.
>
> This is the single rule that prevents healing loops from losing critical instructions.

| # | Step | Action | Artifact to Write | Reference |
|---|------|--------|-------------------|-----------|
| 1 | **Read upstream artifacts** | Load `prepare-plan.json` + `scaffold-manifest.json`. Resolve subscription ID. Update `context.json` → `currentPhase: "deploy"`. | `context.json` — set `currentPhase: "deploy"` | ⛔ Read [`preflight-checks.md`](references/preflight-checks.md) |
| 2 | **Check validation state** | Read `scaffold-manifest.json.validationResult` | — | (loaded at Step 1) |
| 3 | **Run preflight checks** | Auth, syntax validation, deployment preview, quota, RBAC, RG, KV soft-delete | — | (loaded at Step 1) |
| 4 | **Deploy approval gate** | Present cost + resource summary as inline markdown — do NOT use `ask_user` | — | ⛔ NOW read [`approval-gate-template.md`](references/approval-gate-template.md) |
| 5 | **Resolve deployment variables** | Read from `prepare-plan.json.deploymentVariables` | — | — |
| 5b | **Write deploy-result.json skeleton** | Write skeleton BEFORE first `az` command. Read `deploy-checklist.md` from session folder; if missing, generate from template. | `deploy-result.json` skeleton | ⛔ Read [`deploy-safety.md`](references/deploy-safety.md) § Skeleton. Read `deploy-checklist.md` (or [`deploy-checklist-template.md`](references/deploy-checklist-template.md)). ⛔ Read [`blocked-patterns.md`](references/blocked-patterns.md) |
| 6 | **Execute deployment** | Deploy IaC. Append audit log after each command. | `deploy-audit.log` | ⛔ NOW read [`portal-links.md`](references/portal-links.md) |
| 6b | **Deploy application code** | Check `prepare-plan.json.services[].type` to select reference — do NOT guess. | `deploy-audit.log` | ⛔ NOW read ONE of: [`code-deployment-appservice.md`](references/code-deployment-appservice.md) / [`code-deployment-container-apps.md`](references/code-deployment-container-apps.md) / [`code-deployment-swa.md`](references/code-deployment-swa.md) |
| 7 | **Health-check endpoints** | HTTP GET per endpoint. Max 3 diagnostic iterations. | `deploy-result.json` full. `deployment-summary.md` update | ⛔ NOW read [`health-check-patterns.md`](references/health-check-patterns.md) |
| 8 | **Finalize artifacts** | Verify deploy-result.json exists by reading it back. | `context.json` — `completedPhases` + `currentPhase: null` | ⛔ Read [`session-schemas-deploy.ts`](../references/session-schemas-deploy.ts) |
| 9 | **Error handling + healing** | Classify errors, healing loop, PLAN_LEVEL_CHANGE re-approval | — | ⛔ NOW read [`error-classification.md`](references/error-classification.md) |
