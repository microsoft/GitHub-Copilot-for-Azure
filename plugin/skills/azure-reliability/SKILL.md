---
name: azure-reliability
description: "Assess and improve the reliability posture of Azure PaaS applications. Scans deployed resources for zone redundancy, storage replication, multi-region gaps, and single points of failure. Generates a reliability checklist and can configure recommended patterns. Covers Azure Functions, Container Apps, and App Service. WHEN: assess reliability, check reliability, zone redundancy, make app zone redundant, multi-region failover, improve reliability, high availability, disaster recovery, resilience check, single point of failure, reliability posture."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Reliability Assessment & Configuration

## Quick Reference

| Property | Details |
|---|---|
| Best for | Reliability posture assessment, zone redundancy enablement, multi-region failover setup |
| Primary capabilities | Reliability Checklist, Zone Redundancy Configuration, Multi-Region IaC Generation |
| Supported services | Azure Functions, Azure Container Apps, Azure App Service |
| MCP tools | Azure Resource Graph queries, Azure CLI commands |

## When to Use This Skill

- Assess the reliability posture of a deployed application or resource group
- Check if zone redundancy is enabled across compute and storage
- Identify single points of failure (single-region, LRS storage, no health probes)
- Enable zone redundancy for Functions, Container Apps, or App Service
- Set up multi-region failover with Azure Front Door
- Validate that reliability patterns are correctly configured
- Check an app against the Well-Architected Framework reliability pillar

## Skill Activation Triggers

Activate this skill when user wants to:
- "Assess my app's reliability"
- "Check the reliability of my resource group"
- "Is my function app zone redundant?"
- "Make my app zone redundant"
- "Set up multi-region failover"
- "Check my reliability posture"
- "Find single points of failure"
- "Enable high availability"
- "Check disaster recovery readiness"
- "Improve my app's resilience"

## Prerequisites

- Authentication: user is logged in to Azure via `az login`
- Permissions: Reader access on target subscription/resource group (for assessment)
- Permissions: Contributor access (for configuration changes)
- Azure Resource Graph extension: `az extension add --name resource-graph`

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_cli_generate` | Generate `az` CLI commands for resource queries and configuration |
| `mcp_azure_mcp_subscription_list` | List available subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups |

Primary query method: Azure Resource Graph via `az graph query` (requires `az extension add --name resource-graph`).

## Assessment Workflow

### Phase 1: Discover Resources

1. **Identify scope** — Ask user for resource group, subscription, or app name
2. **Query Azure Resource Graph** to discover all resources in scope
3. **Classify resources** by service type (Functions, Container Apps, App Service, Storage, etc.)

**Important:** Always scope queries to the user's specified resource group or subscription. Add these filters to every Resource Graph query:
- Resource group: `| where resourceGroup =~ '<rg-name>'`
- Subscription: Use `--subscriptions <sub-id>` flag on `az graph query`
- App name: `| where name =~ '<app-name>'`

### Phase 2: Assess Reliability

Run checks from each reference document:

| Check Category | Reference |
|---|---|
| Zone Redundancy (Compute) | [references/zone-redundancy-checks.md](references/zone-redundancy-checks.md) |
| Storage Redundancy | [references/storage-redundancy-checks.md](references/storage-redundancy-checks.md) |
| Multi-Region & Failover | [references/multi-region-checks.md](references/multi-region-checks.md) |
| Health Probes & Monitoring | [references/health-probe-checks.md](references/health-probe-checks.md) |

### Service-Specific References

For service-specific assessment criteria, configuration commands, IaC patterns, and gotchas:

| Service | Reference |
|---|---|
| Azure Functions | [references/services/functions/reliability.md](references/services/functions/reliability.md) |
| Azure Container Apps | [references/services/container-apps/reliability.md](references/services/container-apps/reliability.md) |
| Azure App Service | [references/services/app-service/reliability.md](references/services/app-service/reliability.md) |

### Phase 3: Generate Reliability Checklist

Present findings as a reliability checklist showing which reliability features are enabled (✅) vs disabled (❌) for each resource. Do **not** assign numeric scores or grades.

```
🔍 Reliability Assessment — {scope}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Resource                        Zone Redundant   ZRS Storage   Health Probe   Multi-Region
────────────────────────────────────────────────────────────────────────────────────────────
Function App (my-func)          ❌               —             ✅             ❌
Storage Account (mystor)        ❌ (LRS)         ❌            —              ❌
Container App (my-api)          ✅               —             ✅             ❌
App Service (my-web)            ❌               —             ❌             ❌
Front Door                      —                —             —              ❌ Not configured
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Legend: ✅ enabled   ❌ disabled   — not applicable

Recommendations (priority order):
1. [Critical] ...
2. [High] ...
3. [Medium] ...
```

**Rules for the checklist:**
- One row per resource discovered in scope.
- Columns: only include the reliability features that apply to that resource type. Use `—` for non-applicable cells.
- Use ✅ when the feature is enabled and correctly configured, ❌ when disabled or misconfigured.
- For storage rows, annotate `❌ (LRS)` or `❌ (GRS)` so the user sees the current SKU at a glance.
- Do **not** include numeric scores, grades, or point totals anywhere in the output.

> **UX Note:** Once all core reliability features (zone redundancy, ZRS storage, health probes) are ✅, congratulate the user and offer the multi-region upgrade as an optional next step:
> ```
> ✅ Your app has all core reliability features enabled (zone redundant, ZRS storage, health probes).
>
> 🌟 Want to go further? Multi-region deployment would protect against full region outages.
>    This involves:
>    • Deploying compute + storage in a second region
>    • Adding Azure Front Door for global load balancing
>    • Configuring health probes for automatic failover
>    • Estimated additional cost: ~2x compute for active-passive
>
>    Would you like me to generate multi-region IaC? (yes/no)
> ```

## Configuration Workflow

When user wants to **fix** findings from the assessment:

> **⛔ ALWAYS confirm with user before executing changes.** Show what will change, any cost implications, and any destructive actions (e.g., environment recreation).

### Step 1: Present Fix Plan + Choose Path

After assessment, if user says "fix it" / "improve my reliability" / "enable zone redundancy":

1. List each fixable finding with the specific action
2. Flag any cost implications or breaking changes
3. **Ask user which path they want:**

```
I'll make these changes to improve your reliability posture:

1. ✏️  Enable zone redundancy on plan-ii5trxva2ark4 (Flex Consumption — no cost change)
2. ✏️  Upgrade stii5trxva2ark4 from LRS → ZRS (small cost increase, ~$0.01/GB/month more)
3. ✏️  Set health check path to /api/health on func-api-ii5trxva2ark4

⚠️  Note: Storage migration can take several hours.

How would you like to apply these changes?

  A) Fix now — Run az CLI commands against your live resources (immediate, one-time)
  B) Patch my IaC — Update your Bicep/Terraform files so changes persist across deploys

(If you use azd or Terraform, option B is recommended so `azd up` won't overwrite changes.)
```

### Path A: Fix Now (CLI)

Run fixes against live resources using `az` CLI commands in dependency order.

| Fix | Reference |
|---|---|
| Enable zone redundancy | [references/configure-zone-redundancy.md](references/configure-zone-redundancy.md) |
| Upgrade storage replication | [references/configure-storage.md](references/configure-storage.md) |
| Configure health probes | [references/configure-health-probes.md](references/configure-health-probes.md) |
| Set up multi-region | [references/configure-multi-region.md](references/configure-multi-region.md) |

**Execution order:**
1. Storage upgrade (ZRS) — must complete and verify `sku.name` is ZRS/GZRS before proceeding
2. **⛔ WAIT GATE** — Do NOT proceed until `az storage account show --query sku.name` confirms ZRS/GZRS
3. Zone redundancy enablement — depends on ZRS storage being confirmed
4. Health probes — independent, can run anytime
5. Multi-region setup — only if user explicitly requests

> **⚠️ Warning:** If the user uses `azd up` or `terraform apply` later, CLI-only changes may be overwritten by the IaC definitions. Recommend also patching IaC after CLI fixes.

### Path B: Patch IaC

Update the user's Bicep or Terraform files so reliability settings are persistent.

**Step 1: Detect IaC type**
1. Look for `infra/` folder in project root
2. If not found, check project root for `*.bicep` or `*.tf` files
3. If still not found, ask user: "Where are your IaC files located?"
4. Check for `*.bicep` files → use Bicep patching
5. Check for `*.tf` files → use Terraform patching
6. If both exist, ask user which to patch
7. If no IaC exists, fall back to Path A (CLI) and inform user

**Step 2: Classify each fix by risk level**

| Fix | Risk Level | What Happens |
|-----|-----------|--------------|
| Zone redundancy (compute) | 🟢 Safe patch | In-place property update on next deploy |
| Storage LRS → ZRS | 🟡 Pre-migration required | Run `az storage account migration start` before deploy |
| Health check path | 🟢 Safe patch | In-place update, but causes app restart |
| Container Apps env ZR (new env) | 🟢 Safe patch | Deploys as zone-redundant from start |
| Container Apps env ZR (existing) | 🔴 Blue/green required | Must rename env + migrate all apps + child resources |
| Container Apps probes | 🟢 Safe patch | In-place update |

**Step 3: Apply patches**

| IaC Type | Reference |
|---|---|
| Bicep | [references/iac-patching-bicep.md](references/iac-patching-bicep.md) |
| Terraform | [references/iac-patching-terraform.md](references/iac-patching-terraform.md) |

**Step 4: Handle existing resources that need live migration**

Some IaC patches require a live migration step BEFORE deploying:
- **Storage LRS → ZRS on existing account**: Run `az storage account migration start` first, then deploy the updated IaC
- **Container Apps environment without ZR**: IaC creates a new environment (blue/green). Warn user that apps will be recreated.

Present these pre-deploy steps clearly:
```
⚠️ Before deploying, run these pre-migration steps:

1. Storage migration (takes up to 72 hours):
   az storage account migration start --name stii5trxva2ark4 \
     --resource-group rg-example --sku Standard_ZRS --no-wait

2. Wait for migration to complete before running azd up.
```

**Step 5: Instruct user to deploy**

After patching (and any pre-deploy migrations), tell the user:
- AZD project (has `azure.yaml`): "Run `azd up` to deploy with reliability changes."
- Bicep-only: "Run your Bicep deployment command (e.g., `az deployment group create`)."
- Terraform: "Run `terraform plan` to review, then `terraform apply` to deploy."

### Step 2 (both paths): Re-Assess

After changes are applied (CLI) or deployed (IaC), automatically re-run the assessment and show before/after as a checklist diff:

```
🔄 Reliability Re-Assessment — rg-eventhubs-python-jan13
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Resource                        Feature              Before   After
─────────────────────────────────────────────────────────────────────
plan-ii5trxva2ark4              Zone redundant       ❌       ✅
stii5trxva2ark4                 ZRS storage          ❌ LRS   ✅ ZRS
func-api-ii5trxva2ark4          Health check path    ❌       ✅

Remaining recommendations:
  [Medium] Consider multi-region with Azure Front Door for region-level failover
```

## Priority Classification

| Priority | Criteria | Action |
|---|---|---|
| Critical | No zone redundancy AND production workload | Fix immediately |
| High | LRS storage on zone-redundant compute | Fix within days |
| Medium | No multi-region (single region but zone-redundant) | Plan for next sprint |
| Low | Missing health probes or monitoring gaps | Track and fix |

## Error Handling

| Error | Message | Remediation |
|---|---|---|
| Authentication required | "Please login" | Run `az login` and retry |
| Access denied | "Forbidden" | Confirm Reader/Contributor role assignment |
| Plan doesn't support ZR | "Upgrade required" | Inform user of plan upgrade path + cost delta |
| Region doesn't support AZ | "Region limitation" | Suggest supported regions |
| Container Apps env already created without ZR | "Recreate required" | Zone redundancy must be set at environment creation; guide recreation |

## Best Practices

- Run reliability assessments after every significant infrastructure change
- Zone redundancy is the highest-value, lowest-cost improvement — always start there
- Multi-region adds complexity and cost; recommend only for production workloads
- Always upgrade storage to ZRS when enabling compute zone redundancy
- Test failover scenarios periodically (at least quarterly)

## Skill Boundaries

> **⚠️ IMPORTANT — This skill assesses and recommends. For implementation, hand off to the appropriate skill.**

| Action | This skill does | Hand off to |
|---|---|---|
| Assess reliability posture | ✅ Yes | — |
| Recommend improvements | ✅ Yes | — |
| Enable zone redundancy (CLI commands) | ✅ Yes | — |
| Patch Bicep/Terraform for reliability | ✅ Yes | — |
| Generate multi-region IaC | Generates Bicep/Terraform files | `azure-prepare` for full IaC scaffolding |
| Deploy infrastructure | ❌ No | `azure-deploy` |
| Validate pre-deployment | Reliability checks only | `azure-validate` for full validation |

> **⛔ HARD STOPS — Warn user before these actions:**
> - Container Apps environment zone redundancy requires **recreating** the environment (cannot be enabled in-place)
> - Enabling zone redundancy may require a **plan upgrade** (e.g., Consumption → Flex Consumption) with cost implications
> - Storage migration from LRS to ZRS can take hours/days; confirm with user before initiating

## Integration with Other Skills

This skill works alongside other azure skills:

| Skill | Integration |
|---|---|
| `azure-validate` | Reliability checks can be surfaced during pre-deploy validation |
| `azure-prepare` | New apps should default to zone-redundant configurations |
| `azure-deploy` | Post-deploy nudge to run reliability assessment |
| `azure-diagnostics` | After outage diagnosis, suggest reliability improvements |
| `azure-compliance` | Reliability findings complement compliance/security audits |
