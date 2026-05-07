---
name: azure-bya
description: "End-to-end orchestrator: from business idea, app idea, or app from a GitHub repo to running Azure deployment with cost estimates and pre-deploy approval. Analyzes your app, auto-detects the right Azure services, scaffolds code, and deploys. Handles moving existing apps to Azure without rewriting or with minimal changes, including apps with non-Azure cloud SDK dependencies (AWS/GCP) via inline SDK swaps. WHEN: I want to build an app, bring your app to Azure, plan my app, what will this cost, from idea to production, no code yet, help me get started, starter project, cost to run, is my code ready to deploy, deploy my app to the cloud, deploy all my services, what Azure services do I need, plan my Azure deployment, deploy my new app to Azure, what services for my app, can you deploy my app, one-click deploy, migrate my app to Azure. DO NOT USE FOR: running azd up (use azure-deploy), optimizing existing costs (use azure-cost), code readiness checks only (use azure-bya-prereq)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Build Your App (BYA)

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Developers who know what to build but not which Azure services to use |
| Inputs | Business idea or existing codebase, budget/scale preferences (optional) |
| Outputs | Architecture plan, cost estimate, IaC files, deployed Azure resources |
| Phases | Discover → Architect → Scaffold → Deploy (self-contained, no external skill calls) |

## When to Use This Skill

- Take a business idea from concept to running Azure deployment
- Deploy existing code without knowing which Azure services to use
- Check if your existing code is ready to deploy to Azure
- Move an existing app to Azure without rewriting or with minimal changes
- Get cost estimates before committing to infrastructure
- Scaffold a starter project and deploy it
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

> ⛔ **You MUST read [`references/pipeline-rules.md`](references/pipeline-rules.md) using the `view` tool at the start of every BYA session.** It contains approval gates, phase lifecycle, session artifacts, deploy-as-is, and security baseline rules.

## Workflow

| # | Step | Action | Reference |
|---|------|--------|-----------|
| 1 | **Session check + Azure login** | Create/resume session, verify Azure CLI auth, resolve subscription + user identity | ⛔ Read [session-protocol.md](references/session-protocol.md) |
| 2 | **Gather intent (quick probe)** | Set `currentPhase: "prereq"`. Scan workspace IMMEDIATELY — your first output must reference actual project files found. Do NOT present a capabilities overview first. Ask ≤2-6 questions | ⛔ Read [intent-gathering.md](references/intent-gathering.md) § Pass 1 |
| 3 | **Prereq scan** | Invoke `{"skill": "azure-bya-prereq"}`. Write `prereq-output.json`. If prereq returns `overallHealth: "blocked"` with unsupported stack/EOL runtime, HALT — do NOT proceed to prepare | ⛔ MANDATORY — do NOT skip. See [azure-bya-prereq/SKILL.md](../azure-bya-prereq/SKILL.md) |
| 4 | **Refine intent (scan-informed)** | Compare prereq results vs probe, resolve remaining questions, check azd routing | ⛔ Read [intent-gathering.md](references/intent-gathering.md) § Pass 2 |
| 5 | **Plan architecture** | Set `currentPhase: "prepare"`. Write `prepare-plan.json`. ⛔ Self-check: have you read `pipeline-rules.md` and `session-protocol.md`? If not, read them NOW before proceeding | ⛔ Read [prepare/SKILL.md](prepare/SKILL.md) |
| 6 | **Scaffold approval gate** | Display plan for user approval BEFORE generating any files | ⛔ Read [approval-gates.md](references/approval-gates.md) § Scaffold Gate |
| 7 | **Scaffold** | Set `currentPhase: "scaffold"`. Generate IaC, run self-review. Write `scaffold-manifest.json` | ⛔ Read [scaffold/SKILL.md](scaffold/SKILL.md) |
| 8 | **Deploy approval gate** | Display validation summary. SEPARATE gate from Step 6 | ⛔ Read [approval-gates.md](references/approval-gates.md) § Deploy Gate |
| 9 | **Deploy** | Set `currentPhase: "deploy"`. Execute IaC, health-check. Write `deploy-result.json` | ⛔ Read [deploy/SKILL.md](deploy/SKILL.md) |
| 10 | **Handoff** | Surface deployment identity, cleanup commands, recommendations, next steps | ⛔ **You MUST read [`handoff-protocol.md`](references/handoff-protocol.md) using the `view` tool** |

## Error Handling

| Error | Remediation |
|-------|-------------|
| Phase fails mid-pipeline | Halt, report which phase + error details. User decides: retry, skip, or abort. No silent continuation. |
| Malformed `context.json` | Warn user, offer fresh session. Never silently repair. |
| Intent stalls (3+ vague rounds) | Proceed with defaults, flag each assumption: "Assuming X — correct me if wrong." |
| User override mid-flow | Write to `context.json.overrides[]`, re-run affected phase + downstream only. Surface what changed. |
| Missing RBAC permissions | Detect on first API failure. Report required role + `az role assignment` command. |
| Cost API unreachable | Fall back to cached estimates + disclaimer "Verify at azure.com/pricing." Never block pipeline on cost failure alone. |
| MCP server unavailable | Log "⚠️ MCP tools unavailable — skipping [pricing/quota/WAF/best-practices] checks. Estimates are unverified." Add to `costEstimate.assumptions[]`. Surface disclaimer at every approval gate. |

## Sub-Skills

> **MANDATORY:** Before executing any sub-skill workflow, you MUST read the corresponding sub-skill document. Do not call MCP tools for a sub-skill workflow without reading its SKILL.md first.

| Sub-Skill | Phase | Reference |
|-----------|-------|-----------|
| **prereq** | 1 — Discover | [azure-bya-prereq/SKILL.md](../azure-bya-prereq/SKILL.md) |
| **prepare** | 2 — Architect | [prepare/SKILL.md](prepare/SKILL.md) |
| **scaffold** | 3 — Scaffold | [scaffold/SKILL.md](scaffold/SKILL.md) |
| **deploy** | 4 — Deploy | [deploy/SKILL.md](deploy/SKILL.md) |
