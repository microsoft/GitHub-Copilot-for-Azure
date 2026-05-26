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

| Tool | Purpose |
|------|----------|
| `mcp_azure_mcp_pricing` → `pricing_get` | Cost estimation (inline — see Step 6). Fallback: dispatch [`subagent-pricing.md`](references/subagent-pricing.md) |
| `mcp_azure_mcp_policy` | Subscription policy constraints |
| `az rest` | Quota validation (via sub-agent — see Step 5) |
| `mcp_azure_mcp_cloudarchitect` → `cloudarchitect_design` | WAF-aligned architecture design |
| `mcp_azure_mcp_wellarchitectedframework` | Per-service WAF guidance |
| `mcp_azure_mcp_advisor` → `advisor_recommendation_list` | Optimization recommendations |

## Workflow

| # | Step | Action | Reference |
|---|------|--------|-----------|
| 1 | **Read session state** | Load `prereq-output.json` + `context.json`. Resolve subscription | Cross-ref [subscription-resolution.md](../references/subscription-resolution.md) if needed |
| 2 | **Query policy constraints** | Inline MCP: fetch policy + advisor recommendations | `mcp_azure_mcp_policy` + `mcp_azure_mcp_advisor` |
| 3 | **Map components to services** | Per-component Azure service selection, Dockerfile routing, deploy-as-is | ⛔ **You MUST read [service-mapping.md](references/service-mapping.md) and [deploy-strategy.md](references/deploy-strategy.md)** |
| 4 | **Select SKUs + WAF analysis** | Budget-aware SKU selection, inline WAF service guidance | ⛔ **You MUST read [sku-matrix.md](references/sku-matrix.md)** |
| 5 | **Validate quotas + region capacity** | ⛔ Read [`subagent-quota.md`](references/subagent-quota.md) → dispatch as `task` (NEXT action MUST be `task`, ⛔ agent_type: `"task"` — NEVER `"general-purpose"`). Copy the **COMPLETE and UNMODIFIED** template text into the task prompt between `<<<TEMPLATE_START>>>` / `<<<TEMPLATE_END>>>` delimiters — do NOT summarize. Append data (subscriptionId, SKU list, restricted-offer services) AFTER the template block. ⛔ **After dispatching, proceed to Step 6 (cost estimation) while the subagent runs. Do NOT run quota checks yourself — the subagent handles it. Collect subagent results before Step 9 (write plan).** | ⛔ **You MUST read [`subagent-quota.md`](references/subagent-quota.md)** |
| 6 | **Estimate costs** | ⛔ **You MUST read [pricing-guide.md](references/pricing-guide.md)** for methodology, then [pricing-guide-services.md](references/pricing-guide-services.md) for per-service filters. Call `mcp_azure_mcp_pricing` → `pricing_get` inline per paid service. If MCP unavailable or fails → ⛔ Read [`subagent-pricing.md`](references/subagent-pricing.md)dispatch as `task` (NEXT action MUST be `task`, ⛔ agent_type: `"task"` — NEVER `"general-purpose"`). Copy the **COMPLETE and UNMODIFIED** template text into the task prompt between `<<<TEMPLATE_START>>>` / `<<<TEMPLATE_END>>>` delimiters — do NOT summarize. Append data (services[], region, budget tier) AFTER the template block. . Write results to `prepare-plan.json.costEstimate`. | [pricing-guide.md](references/pricing-guide.md) |
| 7 | **Generate naming** | Centralized naming: suffix, prefix, all resource names | ⛔ **You MUST read [naming-patterns.md](references/naming-patterns.md)** |
| 8 | **Determine IaC format** | Existing non-Azure `.tf` → `ask_user` Bicep vs TF, write to `overrides[].iacFormat`. No `.tf` → default Bicep. | (inline) |
| 9 | **Write prepare-plan.json** | Per `PreparePlan` schema. Include postDeployRecommendations, deploymentVariables | ⛔ **You MUST read [prepare-schemas.ts](references/prepare-schemas.ts)** for `PreparePlan` schema |
| 10 | **Return summary** | Structured summary for orchestrator approval gate | (inline — 1 line) |
| 11 | **Validate plan** | 4-dimension check: Goal Alignment, WAF Alignment, Dependency Completeness, Deployment Viability. Fix inline on failure, document tradeoffs in `assumptions[]`. | All must pass before writing |

### Step 5 — Post-Quota Validation

> ⛔ **NEVER present a region without checking quota first.** Skipping quota validation causes cascading deploy failures and extended healing loops.
> ⛔ If plan includes PostgreSQL/MySQL, verify `offerRestrictionsVerified: true` — if false/missing, region is blocked. Do NOT proceed to scaffold with unchecked DB services.
> ⛔ **Free ≠ unlimited.** Every compute SKU — including F1, Consumption, and Serverless tiers — has a per-subscription, per-region quota. Do NOT skip quota checks because a SKU is free.
> ⛔ After region fallback, update ALL `services[].region` in `prepare-plan.json`. Do not leave stale values.

## Error Handling

| Error | Remediation |
|-------|-------------|
| Pricing API 400 | Verify `--sku` included. Free tiers: skip API |
| MCP pricing unavailable | Dispatch [`subagent-pricing.md`](references/subagent-pricing.md) as `task` fallback (uses direct HTTP to `prices.azure.com`) |
| Prereq output missing | Trigger prereq backfill |
| Quota check fails | Fall back to best-effort estimate + disclaimer |
| Override conflicts | Re-run from Step 3 with new constraints |
