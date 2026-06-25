---
name: azure-app-onboard
description: "End-to-end orchestrator: from a business idea, app idea, or existing app to running Azure deployment with cost estimates and pre-deploy approval. Analyzes your app, auto-detects the right Azure services, scaffolds infrastructure code, and deploys — tailored to your app, not a template. Handles moving existing apps to Azure without rewriting or with minimal changes. WHEN: bring your app to Azure, plan my app, cost to run, is my code ready to deploy, deploy my app to the cloud, deploy all my services, what Azure services do I need, plan my Azure deployment, deploy my new app to Azure, one-click deploy, I have an app and want it on Azure, migrate my app to Azure, help me get started, build an app, no code yet, starter project. DO NOT USE FOR: running azd up (use azure-deploy), optimizing existing costs (use azure-cost), code readiness checks only (use azure-app-onboard-prereq)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure App Onboard

> ⛔ **Every repo goes through the full pipeline (Steps 1–10). No exceptions.** Do not skip steps, refuse, or short-circuit based on what you recognize. Follow the Workflow table below sequentially — read each step's references before acting.

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Developers who know what to build but not which Azure services to use |
| Inputs | Business idea or existing codebase, budget/scale preferences (optional) |
| Outputs | Architecture plan, cost estimate, IaC files, deployed Azure resources |
| Phases | Discover → Architect → Scaffold → Deploy (self-contained, no external skill calls) |

## When to Use This Skill

- Deploy existing code without knowing which Azure services to use
- Check if your existing code is ready to deploy to Azure
- Move an existing app to Azure without rewriting or with minimal changes
- Get cost estimates before committing to infrastructure
- Understand architecture decisions and rejected alternatives
- Get answers to Azure architecture or service selection questions (e.g., "What database should I use?")
- Get guided Azure onboarding without prior experience

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Run `azd up` or execute an existing deployment | `azure-deploy` |
| Optimize existing Azure spend | `azure-cost` |
| Generate Bicep/Terraform for a known architecture | `azure-prepare` |
| Validate infrastructure or run preflight checks | `azure-validate` |
| Troubleshoot a running Azure deployment | `azure-diagnostics` |
| Deploy to or manage AKS/Kubernetes directly | `azure-kubernetes` |
| Look up or list existing Azure resources | `azure-resource-lookup` |

## Pipeline Rules

> ⛔ **You MUST read [`references/pipeline-rules.md`](references/pipeline-rules.md) at the start of every AppOnboard session.** It contains approval gates, phase lifecycle, session artifacts, deploy-as-is, and security baseline rules.

## Workflow

> ⛔ **Deploy recovery:** After deploy gate approval OR before any `az deployment`/`az webapp deploy`/`az acr build` — if you haven't read `deploy/SKILL.md`, read `.copilot-azure/sessions/{id}/deploy-checklist.md` first, then `deploy/SKILL.md`. ⛔ NEVER invoke `{"skill": "azure-deploy"}` — that is a DIFFERENT skill for a DIFFERENT workflow.

| # | Step | Action | Reference |
|---|------|--------|-----------|
| 1 | **Session check + Azure login** | Create/resume session, verify Azure CLI auth, resolve subscription + user identity | ⛔ **You MUST read [session-protocol.md](references/session-protocol.md)** |
| 2 | **Scope triage** | Check azd markers, triage question. Empty workspace or code-only (no infra) → Step 3 directly. | ⛔ Read [intent-gathering.md](references/intent-gathering.md) § Scope Triage |
| 3 | **Prereq scan** | ⛔ Skip if `completedPhases` includes `"prereq"`. Otherwise: invoke `{"skill": "azure-app-onboard-prereq"}`. Write `prereq-output.json`, update `context.json`. **Halt if:** `overallHealth: "blocked"` OR `routeToSkill` set. | |
| 4 | **Gather intent** | Present prereq results, confirm stack + Azure services, ask remaining questions. | ⛔ Read [intent-gathering.md](references/intent-gathering.md) § After Prereq Returns |
| 5 | **Plan architecture** | Write `prepare-plan.json`. | ⛔ **You MUST read [prepare/SKILL.md](prepare/SKILL.md)** |
| 6 | **Scaffold approval gate** | Display plan for user approval BEFORE generating any files. | ⛔ Read [approval-gates.md](references/approval-gates.md) § Scaffold Gate |
| 7 | **Scaffold** | Generate IaC, self-review. Write `scaffold-manifest.json`. Update `context.json`. | ⛔ **You MUST read [scaffold/SKILL.md](scaffold/SKILL.md)** |
| 8 | **Deploy approval gate** | Display validation summary. ⛔ After approval: FIRST read deploy-checklist.md → deploy/SKILL.md. NEVER `{"skill": "azure-deploy"}`. | ⛔ Read [approval-gates.md](references/approval-gates.md) § Deploy Gate |
| 9 | **Deploy** | Execute IaC, health-check. Write `deploy-result.json`. | ⛔ **You MUST read [deploy/SKILL.md](deploy/SKILL.md)** |
| 10 | **Handoff** | Surface deployment identity, cleanup commands, next steps. | ⛔ **You MUST read [`handoff-protocol.md`](references/handoff-protocol.md)** |

## Error Handling

| Error | Remediation |
|-------|-------------|
| Phase fails | Halt, report phase + error. User decides: retry, skip, abort. |
| MCP server unavailable | Skip affected checks, add disclaimer to `costEstimate.assumptions[]` and every approval gate. |
| Missing RBAC | Report required role + `az role assignment` command. |

> **Shared references:** [MCP tools](references/mcp-tool-reference.md) (cross-phase tool parameters) | [IaC resources](references/iac-resources.md) (Azure resource docs for troubleshooting)