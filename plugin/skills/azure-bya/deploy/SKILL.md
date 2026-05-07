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
| Parent | [azure-bya](../SKILL.md) |

## When to Use This Skill

Invoked by the `azure-bya` orchestrator at Phase 4 when `scaffold-manifest.json` exists with `files[]` and `validationResult`. Not directly user-routable.

> **Return to orchestrator:** When complete, return control to `azure-bya` for handoff (Step 10). Do NOT start new phases.

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Plan architecture, map services, estimate costs | [prepare](../prepare/SKILL.md) |
| Generate IaC files from a plan | `azure-bya` Step 7 (scaffold) |
| Run `azd up` or execute existing deployment templates | `azure-deploy` |
| Debug a running app after deployment | `azure-diagnostics` |
| Optimize existing Azure spending | `azure-cost` |

## Workflow

> ⛔ **Present the deploy gate as inline markdown — do NOT use `ask_user`.** The gate is Step 4 below.

> ⛔ **ALWAYS write `deploy-result.json` — regardless of deployment outcome.** If the deployment failed, the app crashed, or health checks returned `unreachable`, you MUST still write `deploy-result.json` with the actual status, error details, and healing attempts. deploy-result.json is the contractual output of the deploy phase — the orchestrator reads it to present handoff.

> ⛔ **MANDATORY — Audit log.** Every `az deployment`, `terraform apply`, `az webapp deploy`, and `az acr build` command MUST be logged to `.copilot-azure/sessions/{id}/deploy-audit.log` with timestamp, command, args, status (started/succeeded/failed).

> ⛔ **Healing loop: ask user after 3 attempts, then every 5.** The single counter is the length of `deploy-result.json.healingAttempts[]`. Every fix attempt that executes a command counts — **regardless of whether the root cause changes between attempts.** ACR build failures, deployment retries, and health-check diagnostic cycles ALL increment the same counter. After 3: pause, explain the error pattern, propose a fix, ask "Yes, try that / I have a suggestion / Stop." After approval, 5 more attempts before asking again.

> ⛔ **Phase exit — NOT complete until ALL done:**
> 1. `deploy-audit.log` written with ≥2 entries per command ✅
> 2. `deploy-result.json` written ✅
> 3. `context.json` updated (`"deploy"` in `completedPhases`) ✅
> 4. `deployment-summary.md` updated with deploy status ✅
> 5. `deploy-result.json` verified to exist on disk (read it back) ✅

> ⛔ **Post-compaction recovery.** After ANY conversation compaction during the deploy phase, re-read this SKILL.md (Steps 6–8) and all loaded reference files before proceeding. Compaction evicts inline rules — do NOT rely on memory for audit log format, deploy-result.json template, or SCM re-disable protocol.

> ⛔ **NEVER use async/background shells for variable setup.** Use sync shells so state (variables, passwords) persists across commands. Async shells exit after the command and lose all state.

> ⛔ **Generate secrets ONCE — reuse everywhere.** For PostgreSQL + Key Vault deployments: generate the password ONCE using `openssl rand -base64 32`, pass to BOTH `az deployment sub create --parameters pgAdminPassword={value}` AND `az keyvault secret set --value {value}` IN THE SAME shell command block. NEVER generate separate passwords — shell variables don't persist across Copilot CLI tool calls.

> ⛔ **`az webapp deploy` does NOT support `--track-status`.** This flag does not exist. Do not add it to any `az webapp deploy` command.

| # | Step | Action | Reference |
|---|------|--------|-----------|
| 1 | **Read upstream artifacts** | Load `prepare-plan.json` + `scaffold-manifest.json`. Resolve subscription ID | ⛔ Read [preflight-checks.md](references/preflight-checks.md) |
| 2 | **Check validation state** | Read `scaffold-manifest.json.validationResult`. Safety net if scaffold skipped validation | ⛔ Read [preflight-checks.md](references/preflight-checks.md) § Validation |
| 3 | **Run preflight checks** | Auth, syntax validation, deployment preview, quota, RBAC, RG, KV soft-delete | ⛔ Read [preflight-checks.md](references/preflight-checks.md) |
| 4 | **Deploy approval gate** | Present cost + resource summary. User approves before execution | ⛔ Read [approval-gate-template.md](references/approval-gate-template.md) |
| 5 | **Resolve deployment variables** | Read from `prepare-plan.json.deploymentVariables` | (inline — 1 line) |
| 6 | **Execute deployment** | Run `az deployment sub create` or `terraform apply`. Log all commands | ⛔ Read [deploy-safety.md](references/deploy-safety.md) |
| 6b | **Deploy application code** | Load ONLY the reference matching your compute target: **Container Apps** → [code-deployment-container-apps.md](references/code-deployment-container-apps.md). **App Service / Functions** → [code-deployment-appservice.md](references/code-deployment-appservice.md). **SWA** → [code-deployment-swa.md](references/code-deployment-swa.md). ⛔ Check `prepare-plan.json.services[].type` to determine compute target — do NOT guess | — |
| 7 | **Health-check endpoints** | HTTP GET per endpoint. Max 3 diagnostic iterations | ⛔ Read [health-check-patterns.md](references/health-check-patterns.md) |
| 8 | **Write deploy-result.json** | Per `DeployResult` in session-schemas-deploy.ts | ⛔ Read [session-schemas-deploy.ts](../references/session-schemas-deploy.ts) |
| 9 | **Error handling + healing** | Classify errors, healing loop (max 3), PLAN_LEVEL_CHANGE re-approval | ⛔ Read [error-classification.md](references/error-classification.md) |

## References

| Reference | Purpose |
|-----------|---------|
| [preflight-checks.md](references/preflight-checks.md) | Auth, syntax, preview, quota, RBAC procedures |
| [approval-gate-template.md](references/approval-gate-template.md) | Deploy gate display format + response handlers |
| [deploy-safety.md](references/deploy-safety.md) | Blocked commands, audit log, orphan RG tracking, re-approval gates |
| [code-deployment-appservice.md](references/code-deployment-appservice.md) | App Service, Functions code deployment |
| [code-deployment-container-apps.md](references/code-deployment-container-apps.md) | Container Apps code deployment (ACR build + image swap) |
| [code-deployment-swa.md](references/code-deployment-swa.md) | Static Web Apps content deployment |
| [health-check-patterns.md](references/health-check-patterns.md) | Per-service health signals, HTTP retry logic |
| [error-classification.md](references/error-classification.md) | Error taxonomy, healing trace, classification trees |
| [portal-links.md](references/portal-links.md) | Portal deployment link generation |
| [MCP tools (deploy)](references/mcp-tools.md) | Deploy-phase MCP tool parameters |
| [MCP tools (shared)](../references/mcp-tool-reference.md) | Cross-phase shared tools |
