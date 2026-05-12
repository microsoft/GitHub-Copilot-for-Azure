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

> ⛔ **Present the deploy gate as inline markdown — do NOT use `ask_user`.** The gate is Step 4 below.

> ⛔ **ALWAYS write `deploy-result.json` — regardless of deployment outcome.** If the deployment failed, the app crashed, or health checks returned `unreachable`, you MUST still write `deploy-result.json` with the actual status, error details, and healing attempts. deploy-result.json is the contractual output of the deploy phase — the orchestrator reads it to present handoff.

> ⛔ **MANDATORY — Audit log — INCREMENTAL, NOT BATCHED.** After EVERY `az deployment`, `terraform apply`, `az webapp deploy`, `az acr build`, `az rest`, and `az webapp config` command, IMMEDIATELY append one line to `.copilot-azure/sessions/{id}/deploy-audit.log` using the `create` tool (or shell `Add-Content` for appends). Format: `{ISO-timestamp} | {command-summary} | {started|succeeded|failed}`. Do NOT defer logging to phase exit — by then the output budget may be exhausted. Each command = 2 entries (started + result), written in the SAME turn as the command.

> ⛔ **Healing loop: ask user after 3 attempts, then every 5.** The single counter is the length of `deploy-result.json.healingAttempts[]`. Every fix attempt that executes a command counts — **regardless of whether the root cause changes between attempts.** ACR build failures, deployment retries, and health-check diagnostic cycles ALL increment the same counter. After 3: pause, explain the error pattern, propose a fix, ask "Yes, try that / I have a suggestion / Stop." After approval, 5 more attempts before asking again.

> ⛔ **Artifact writes are DISTRIBUTED, not batched.** Do NOT defer all writes to the end — the output budget may be exhausted by then. Each step's artifact column below tells you what to write and when. Skeleton-first: if the output budget is hit mid-deploy, at minimum `deploy-result.json` exists with `status: "in-progress"` so the orchestrator knows deploy started.

> ⛔ **Post-compaction recovery.** After ANY conversation compaction during the deploy phase, you MUST read the `deploy-checklist.md` file in the session folder. This is a personalized step-by-step of every critical rule for this deployment. Then re-read this SKILL.md (Steps 6–8) and any active reference file.

> ⛔ **Re-read checklist after every long-running command.** After `az deployment`, `az webapp deploy`, `az acr build`, and after each failed health check — you MUST read the generated `deploy-checklist.md` in the session folder. This is the single rule that prevents healing loops from losing critical instructions.

> ⛔ **Read [`deploy-safety.md`](references/deploy-safety.md) and [`blocked-patterns.md`](references/blocked-patterns.md) before running any commands** — they contain shell execution rules (sync vs async), secret generation patterns, and every command the agent is forbidden from executing.

| # | Step | Action | Artifact to Write | Reference |
|---|------|--------|-------------------|-----------|
| 1 | **Read upstream artifacts** | Load `prepare-plan.json` + `scaffold-manifest.json`. Resolve subscription ID. Update `context.json` → `currentPhase: "deploy"`. | `context.json` — set `currentPhase: "deploy"` | ⛔ You MUST read [`preflight-checks.md`](references/preflight-checks.md) |
| 2 | **Check validation state** | Read `scaffold-manifest.json.validationResult`. Safety net if scaffold skipped validation | — | (already loaded at Step 1) |
| 3 | **Run preflight checks** | Auth, syntax validation, deployment preview, quota, RBAC, RG, KV soft-delete | — | (already loaded at Step 1) |
| 4 | **Deploy approval gate** | Present cost + resource summary. User approves before execution | — | ⛔ You MUST read [`approval-gate-template.md`](references/approval-gate-template.md) |
| 5 | **Resolve deployment variables** | Read from `prepare-plan.json.deploymentVariables` | — | (inline — 1 line) |
| 5b | **Write deploy-result.json skeleton + deploy checklist** | Write the skeleton BEFORE the first `az deployment` command. **Generate `deploy-checklist.md`** — a tailored runbook for this deployment. Fill in real values from `prepare-plan.json`, delete sections that don't apply. | `deploy-result.json` — `create` tool, full skeleton. `deploy-checklist.md` — `create` tool | ⛔ You MUST read [`deploy-safety.md`](references/deploy-safety.md) (§ Skeleton). ⛔ You MUST read [`deploy-checklist-template.md`](references/deploy-checklist-template.md). ⛔ You MUST read [`blocked-patterns.md`](references/blocked-patterns.md) — BEFORE any `az` command |
| 6 | **Execute deployment** | Generate portal link, open browser, then deploy. **Append audit log after each command.** | `deploy-audit.log` — append 1 line per event, SAME turn as command | ⛔ You MUST read [`portal-links.md`](references/portal-links.md) |
| 6b | **Deploy application code** | ⛔ **You MUST read** the reference matching your service type. Check `prepare-plan.json.services[].type` to determine which — do NOT guess. | `deploy-audit.log` — append after each deploy command | ⛔ You MUST read ONE of: [`code-deployment-appservice.md`](references/code-deployment-appservice.md) OR [`code-deployment-container-apps.md`](references/code-deployment-container-apps.md) OR [`code-deployment-swa.md`](references/code-deployment-swa.md) |
| 7 | **Health-check endpoints** | HTTP GET per endpoint. Max 3 diagnostic iterations. | `deploy-result.json` — overwrite skeleton with full `DeployResult`. `deployment-summary.md` — update Status + Health table + Deployment Links | ⛔ You MUST read [`health-check-patterns.md`](references/health-check-patterns.md) |
| 8 | **Finalize artifacts** | Update context.json. **Verify deploy-result.json exists by reading it back — if missing, write it again.** | `context.json` — add `"deploy"` to `completedPhases`, set `currentPhase: null`. Verify `deploy-result.json` exists | ⛔ You MUST read [`session-schemas-deploy.ts`](../references/session-schemas-deploy.ts) for exact `DeployResult` schema |
| 9 | **Error handling + healing** | Classify errors, healing loop (max 3), PLAN_LEVEL_CHANGE re-approval | — | ⛔ You MUST read [`error-classification.md`](references/error-classification.md) |

## References

| Reference | Purpose |
|-----------|---------|
| [preflight-checks.md](references/preflight-checks.md) | Auth, syntax, preview, quota, RBAC procedures |
| [approval-gate-template.md](references/approval-gate-template.md) | Deploy gate display format + response handlers |
| [deploy-safety.md](references/deploy-safety.md) | deploy-result.json skeleton, finalize procedure, audit log, orphan RG tracking, re-approval gates |
| [deploy-checklist-template.md](references/deploy-checklist-template.md) | ⛔ Compaction-safe checklist template — generate at Step 5b, re-read after every long command |
| [blocked-patterns.md](references/blocked-patterns.md) | ⛔ Commands the agent must NEVER execute — read before ANY `az` command |
| [code-deployment-appservice.md](references/code-deployment-appservice.md) | App Service, Functions code deployment |
| [code-deployment-container-apps.md](references/code-deployment-container-apps.md) | Container Apps code deployment (ACR build + image swap) |
| [code-deployment-swa.md](references/code-deployment-swa.md) | Static Web Apps content deployment |
| [health-check-patterns.md](references/health-check-patterns.md) | Per-service health signals, HTTP retry logic |
| [error-classification.md](references/error-classification.md) | Error taxonomy, healing trace, classification trees |
| [portal-links.md](references/portal-links.md) | Portal deployment link generation |
| [MCP tools (deploy)](references/mcp-tools.md) | Deploy-phase MCP tool parameters |
| [MCP tools (shared)](../references/mcp-tool-reference.md) | Cross-phase shared tools |
