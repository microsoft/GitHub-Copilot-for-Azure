---
name: prepare
description: "Maps detected application components to Azure services, selects budget-aware SKUs, estimates monthly costs via Azure Retail Prices API, validates subscription quota capacity, and produces prepare-plan.json for scaffold consumption."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Prepare — Architecture Planning & Cost Estimation

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Mapping app components to Azure services with cost estimation and quota validation |
| Inputs | `prereq-output.json` + `context.json` from `.copilot-azure/sessions/{id}/` |
| Outputs | `prepare-plan.json` written to session directory |
| Parent | [azure-app-onboard](../SKILL.md) |

## When to Use This Skill

Invoked by the `azure-app-onboard` orchestrator at Phase 2 when `prereq-output.json` exists. Not directly user-routable.

> **Return to orchestrator:** When complete, return control to `azure-app-onboard`. Do NOT directly invoke scaffold or deploy.

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Code readiness or prereq scanning | `azure-app-onboard` Step 3 (prereq) |
| IaC generation from a completed plan | `azure-app-onboard` Step 7 (scaffold) |
| Deploying resources to Azure | `azure-app-onboard` Step 9 (deploy) |
| Optimizing existing Azure spend | `azure-cost` |
| Estimating VM-specific costs | `azure-compute` |
| Enterprise landing zone architecture | `azure-enterprise-infra-planner` |

## MCP Tools

> ⛔ **`pricing_get`: use `--sku` when querying by `armSkuName`; use `filter`/`meterName` matching for services without `armSkuName`.** For free-tier SKUs, skip the API — see [pricing-guide.md](references/pricing-guide.md).

| Tool | Purpose | Parameters |
|------|---------|------------|
| `mcp_azure_mcp_pricing` → `pricing_get` | Cost estimation (via sub-agent) | `sku` (Opt), `service` (Opt), `region` (Opt), `currency` (Opt) — at least one filter required |
| `mcp_azure_mcp_policy` | Subscription policy constraints (via sub-agent) | `intent` (Required) |
| `az rest` | ⛔ Quota validation — sub-agent MUST read [sku-quota-validation.md](references/sku-quota-validation.md) | See reference for per-provider URL patterns |
| `mcp_azure_mcp_cloudarchitect` → `cloudarchitect_design` | WAF-aligned architecture design | `intent` (Required), `answer`, `state` (stateful) |
| `mcp_azure_mcp_wellarchitectedframework` | Per-service WAF guidance (via sub-agent) | `intent` (Required) |
| `mcp_azure_mcp_advisor` → `advisor_recommendation_list` | Optimization recommendations (via sub-agent) | `intent` (Required), `subscription` (Opt), `resource-group` (Opt) |

## Workflow

> ⛔ **You MUST read these before executing ANY step:**
> - [service-mapping.md](references/service-mapping.md) — component→service mapping + Dockerfile routing
> - [sku-matrix.md](references/sku-matrix.md) — budget→SKU selection
> - [pricing-guide.md](references/pricing-guide.md) — per-service filter strings, formulas
> - [naming-patterns.md](references/naming-patterns.md) — per-resource naming rules

| # | Step | Action | Reference |
|---|------|--------|-----------|
| 1 | **Read session state** | Load `prereq-output.json` + `context.json`. Resolve subscription | Cross-ref [subscription-resolution.md](../references/subscription-resolution.md) if needed |
| 2 | **Query policy constraints** | Sub-agent: fetch policy + advisor recommendations | `mcp_azure_mcp_policy` + `mcp_azure_mcp_advisor` |
| 3 | **Map components to services** | Per-component Azure service selection, Dockerfile routing, deploy-as-is | ⛔ Read [service-mapping.md](references/service-mapping.md) + [deploy-strategy.md](references/deploy-strategy.md) |
| 4 | **Select SKUs + WAF analysis** | Budget-aware SKU selection, WAF service guidance via sub-agent | ⛔ Read [sku-matrix.md](references/sku-matrix.md) |
| 5 | **Validate quotas + region capacity** | Check quota BEFORE presenting regions. Sub-agent validation | ⛔ **You MUST read [`sku-quota-validation.md`](references/sku-quota-validation.md)** |
| 6 | **Estimate costs** | Sub-agent pricing call, free-tier shortcut, AI cost caveats | ⛔ Read [pricing-guide.md](references/pricing-guide.md) |
| 7 | **Generate naming** | Centralized naming: suffix, prefix, all resource names | ⛔ Read [naming-patterns.md](references/naming-patterns.md) |
| 8 | **Determine IaC format** | If existing non-Azure `.tf` detected → **ask user**: "Your repo has existing Terraform (targeting {provider}). For the new Azure infrastructure, would you like **(A) fresh Bicep** (recommended — Azure-native) or **(B) Terraform** (keeps toolchain consistent)?" Write choice to `context.json.overrides[].iacFormat`. No `.tf` found → default Bicep, no prompt needed | (inline) |
| 9 | **Write prepare-plan.json** | Per `PreparePlan` schema. Include postDeployRecommendations, deploymentVariables | ⛔ Read [session-schemas-prepare.ts](../references/session-schemas-prepare.ts) for `PreparePlan` schema |
| 10 | **Return summary** | Structured summary for orchestrator approval gate | (inline — 1 line) |
| 11 | **Validate plan** | 4-dimension quality check | ⛔ Read [validation-rubric.md](references/validation-rubric.md) |

### Step 5 — Quota Validation Procedure

> ⛔ **STOP — Read [`sku-quota-validation.md`](references/sku-quota-validation.md) BEFORE doing anything in this step.**

> ⛔ **NEVER present a region without checking quota first.** Skipping quota validation causes extended healing cascades during deployment. Blind region picks cause cascading deploy failures (3+ retries, 80+ min wasted on healing loops).

> ⛔ **Free ≠ unlimited.** Every compute SKU — including F1, Consumption, and Serverless tiers — has a per-subscription, per-region quota. Do NOT skip quota checks because a SKU is free — free tiers are often the MOST quota-constrained.

> ⛔ **NEVER use `az appservice list-locations`, `az vm list-usage`, `az appservice list-usages`, or `mcp_azure_mcp_quota`.** ⛔ See sku-quota-validation.md § Anti-Patterns for the full list of commands that MUST NOT be used for quota checks.

Use a sub-agent to validate quota across candidate regions. ⛔ Provide the full content of [references/sku-quota-validation.md](references/sku-quota-validation.md) verbatim — it contains the sub-agent delegation protocol, expected output schema, and anti-patterns.

> ⛔ **After region fallback, update ALL `services[].region` entries in `prepare-plan.json` to the new region. Do not leave stale region values.**

## Blocking Rules

| Condition | Action |
|-----------|--------|
| Quota sufficient | Proceed |
| Quota adjustable | Warn, suggest `az quota update` |
| Quota non-adjustable | Block — halt and present alternatives |

## Conflict Resolution

| Situation | Resolution |
|-----------|-----------|
| Domain skill recommendation (e.g., `azure-compute`) differs from service-mapping.md | Utility skill wins — present both, user decides |
| Orchestration conflict (AppOnboard vs external skill) | AppOnboard wins during AppOnboard pipeline |
| Ambiguous | Surface both options to user, write decision to `context.json.overrides[]` |

## Error Handling

| Error | Remediation |
|-------|-------------|
| Pricing API 400 | Verify `--sku` included. Free tiers: skip API |
| Prereq output missing | Trigger prereq backfill |
| Quota check fails | Fall back to best-effort estimate + disclaimer |
| Override conflicts | Re-run from Step 3 with new constraints |
