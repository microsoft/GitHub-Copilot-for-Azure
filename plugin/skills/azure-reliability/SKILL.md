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

Present findings as a **feature-pivoted** table: one row per reliability feature (Zone redundancy on compute, Zone-redundant storage, Health probes, Multi-region failover), with a single status indicator and the **specific resources** that are relevant to that feature. This avoids the noise of one-row-per-resource with mostly `n/a` cells. Do **not** assign numeric scores or grades.

```
🔍 Reliability Assessment — {scope}
─────────────────────────────────────────────────────────────────────────────────────────────
Reliability Feature              Status      Resources
─────────────────────────────────────────────────────────────────────────────────────────────
Zone redundancy — compute        🔴 OFF      • plan-ii5trxva2ark4 (FC1)
                                              • plan-web-ii5trxva2ark4 (P1v3)
                                              • cae-ii5trxva2ark4 (Container Env) — already ON

Zone-redundant storage           🔴 GRS      • stii5trxva2ark4 (defaulted; no SKU set in IaC)

Health probes                    🟡 PARTIAL  • app-web-ii5trxva2ark4 — no health check path
                                              • ca-worker — liveness only (missing readiness)
                                              • func-api-ii5trxva2ark4 — needs code change (FC1)

Multi-region failover            🔴 OFF      • Single region (eastus) only — Front Door not configured
─────────────────────────────────────────────────────────────────────────────────────────────

Want me to fix the 🔴 items? I'll do the quick wins first (compute zone
redundancy + health checks on supported plans), then ask before storage
migration and multi-region setup. (yes/no)
```

**Rules for the table:**

- **Four feature rows, in this order:** Zone redundancy — compute · Zone-redundant storage · Health probes · Multi-region failover. Omit a row entirely only if no resource in scope could ever apply to it.
- **Status column** is one symbol + one short word, no other characters:
  - `🟢 ON` — feature is fully enabled across all relevant resources in scope
  - `🟡 PARTIAL` — some resources have it, some don't (or partial config like liveness-only)
  - `🔴 OFF` — feature is missing on all relevant resources
  - For storage, replace `OFF` with the current SKU when relevant (`🔴 LRS`, `🔴 GRS`, `🟢 ZRS`, `🟢 GZRS`). When no SKU is set in IaC, label as `🔴 GRS` (ARM/AVM default) and note that in the resource line.
- **Resources column** lists only what's relevant to that feature, one bullet per resource:
  - For "needs fixing" resources, include a short inline reason (`(FC1)`, `(defaulted; no SKU set)`, `liveness only`, `needs code change (FC1)`).
  - For resources that are **already ON** for that feature, mention them on the same row with `— already ON` so the user sees credit for what's right.
- **Do not** include `n/a`, `—`, or empty cells. If a feature doesn't apply to any resource in scope, drop the row.
- **Do not** include numeric scores, grades, or point totals.
- End the assessment with a **single yes/no question** that kicks off the staged remediation flow. Do not enumerate the per-resource fix list here — the user will see it after they say yes (Configuration Workflow Step 1).

> **UX Note:** If the assessment finds the app **already has** all core reliability features (zone redundancy, ZRS/GZRS storage, health probes) and is single-region, congratulate the user and offer multi-region as an optional follow-up using the same wait-and-confirm prompt as Configuration Workflow [Step 3](#step-3-both-paths-multi-region-followup--ask-and-wait). Do **NOT** start any multi-region work without explicit consent.
>
> If core reliability is **not** all 🟢 at assessment time, do not mention multi-region as a separate question here — the assessment table already shows its status, and Configuration Workflow Step 3 will offer it after core gaps are fixed.

## Configuration Workflow

When user wants to **fix** findings from the assessment:

> **⛔ ALWAYS confirm with user before executing changes.** Show what will change, any cost implications, and any destructive actions (e.g., environment recreation).

### Step 1: Present Fix Plan + Choose Path

After assessment, if user says "fix it" / "improve my reliability" / "enable zone redundancy":

1. List each fixable finding with the specific action
2. Flag any cost implications or breaking changes
3. **Ask user which path they want:**

```
I'll start with the quick wins (no downtime, fast):

1. ✏️  Enable zone redundancy on plan-ii5trxva2ark4 (Flex Consumption — no cost change)
2. ✏️  Set health check path to /api/health on func-api-ii5trxva2ark4

Then, separately, I'll ask if you want to upgrade storage:

3. 🕒  Upgrade stii5trxva2ark4 from LRS → ZRS (small cost increase, migration takes hours)
   — Required for full zone redundancy, but I'll confirm with you before starting.

How would you like to apply these changes?

  A) Fix now — Run az CLI commands against your live resources (immediate, one-time)
  B) Patch my IaC — Update your Bicep/Terraform files so changes persist across deploys

(If you use azd or Terraform, option B is recommended so `azd up` won't overwrite changes.)
```

### Path A: Fix Now (CLI)

Run fixes against live resources using `az` CLI commands. **Quick wins first, then ask before the slow storage migration.**

| Fix | Reference |
|---|---|
| Enable zone redundancy | [references/configure-zone-redundancy.md](references/configure-zone-redundancy.md) |
| Upgrade storage replication | [references/configure-storage.md](references/configure-storage.md) |
| Configure health probes | [references/configure-health-probes.md](references/configure-health-probes.md) |
| Set up multi-region | [references/configure-multi-region.md](references/configure-multi-region.md) |

**Execution order — always quick wins first:**

1. **Zone redundancy on compute** (fast, in-place property update). For Container Apps environments without ZR, flag the blue/green requirement and wait for user confirmation before proceeding.
2. **Health probes** (Premium / Dedicated only — in-place; for FC1 / Consumption, follow the consent gate in [configure-health-probes.md](references/configure-health-probes.md)).
3. **Verify** the compute changes succeeded before doing anything else.
4. **⛔ STOP — Ask about storage upgrade.** Compute is now zone-redundant, but storage may still be LRS or GRS. Ask the user explicitly:

   ```
   ✅ Compute is now zone-redundant.

   To be **fully zone-redundant**, your storage account also needs to be upgraded:
     • stii5trxva2ark4: currently `Standard_LRS` → needs `Standard_ZRS`

   ⚠️  This is a live storage redundancy conversion:
      • Takes hours to days depending on data volume
      • Small ongoing cost increase (~$0.01/GB/month more)
      • Only supported for Standard general-purpose v2 accounts

   Do you want me to start the storage migration now? (yes / no / later)
   ```

   - **yes** → run `az storage account update --sku Standard_ZRS` (or `migration start` if needed); poll `az storage account show --query sku.name` until it reports `Standard_ZRS`.
   - **no / later** → leave storage as-is; note in the re-assessment that ZR storage remains a gap.

5. **Multi-region** — do NOT auto-run. Handled in **Step 3** below as an explicit follow-up after re-assessment.

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
| Health check path (Premium / Dedicated) | 🟢 Safe patch | In-place update, but causes app restart |
| Health check path (FC1 / Consumption) | ⚪ Code-only — ask first | `healthCheckPath` is unsupported. Adding a health endpoint requires adding an HTTP-triggered `/api/health` function to **app code**. **Always ask the user for explicit consent before touching source code.** Do **not** patch IaC. |
| Container Apps env ZR (new env) | 🟢 Safe patch | Deploys as zone-redundant from start |
| Container Apps env ZR (existing) | 🔴 Blue/green required | Must rename env + migrate all apps + child resources |
| Container Apps probes | 🟢 Safe patch | In-place update |

> **⚠️ Deploy-order rule:** Do **not** apply storage SKU patches in the same deploy as safe patches. Storage redundancy changes can fail the whole `azd up` / `terraform apply` (especially if migration is in-flight or the account kind doesn't support live conversion). Split into two deploys:
> 1. **Deploy 1** — all 🟢 Safe patches (zone redundancy, health probes, probes). Verify success.
> 2. **Storage migration** — run `az storage account migration start` and wait for completion (`az storage account show --query sku.name` returns `Standard_ZRS`).
> 3. **Deploy 2** — the storage SKU patch (now matches actual state, so it's a no-op confirmation).

**Step 3: Apply patches in two deploys (quick wins first)**

| IaC Type | Reference |
|---|---|
| Bicep | [references/iac-patching-bicep.md](references/iac-patching-bicep.md) |
| Terraform | [references/iac-patching-terraform.md](references/iac-patching-terraform.md) |

**Deploy 1 — Quick wins only.** Patch and deploy the 🟢 Safe items: zone redundancy on compute, health probes (Premium / Dedicated only), Container Apps probes. Do **NOT** include the storage SKU patch in this deploy. Verify the deployment succeeded.

**⛔ STOP — Ask about storage upgrade before Deploy 2.** After Deploy 1 succeeds, ask the user explicitly:

```
✅ Quick-win patches deployed. Compute is now zone-redundant.

To be **fully zone-redundant**, your storage account also needs to be upgraded:
  • stii5trxva2ark4: currently `Standard_LRS` → needs `Standard_ZRS`

⚠️  This is a two-part change:
   1. Live storage migration (`az storage account migration start`) — takes hours to days
   2. A second deploy to update your IaC's storage SKU to match

Do you want me to start the storage migration now? (yes / no / later)
```

- **yes** → run the migration command from Step 5 below; once `az storage account show --query sku.name` returns `Standard_ZRS`, patch the storage SKU in IaC and run **Deploy 2** (now a no-op confirmation).
- **no / later** → leave the storage SKU patch unapplied. Note in the re-assessment that ZR storage remains a gap; suggest revisiting later.

**Step 4: Pre-deploy migration commands (only if user said yes to storage upgrade)**

Some IaC patches require a live migration step BEFORE deploying:
- **Storage LRS → ZRS on existing account**: Run `az storage account migration start` first, then deploy the updated IaC
- **Container Apps environment without ZR**: IaC creates a new environment (blue/green). Warn user that apps will be recreated.

Present these pre-deploy steps clearly:
```
⚠️ Before Deploy 2, run these pre-migration steps:

1. Storage migration (takes up to 72 hours):
   az storage account migration start --name stii5trxva2ark4 \
     --resource-group rg-example --sku Standard_ZRS --no-wait

2. Wait for migration to complete:
   az storage account show --name stii5trxva2ark4 --query sku.name
   # Expect: "Standard_ZRS"

3. Then run azd up / terraform apply (Deploy 2).
```

**Step 5: Instruct user to deploy**

After each deploy stage, tell the user the appropriate command:
- AZD project (has `azure.yaml`): "Run `azd up` to deploy with reliability changes."
- Bicep-only: "Run your Bicep deployment command (e.g., `az deployment group create`)."
- Terraform: "Run `terraform plan` to review, then `terraform apply` to deploy."

### Step 2 (both paths): Re-Assess

After changes are applied (CLI) or deployed (IaC), automatically re-run the assessment and show the **same feature-pivoted table** as Phase 3, with each feature row's status updated to reflect the new state. Briefly call out what changed since the previous run.

```
🔄 Reliability Re-Assessment — rg-eventhubs-python-jan13 (eastus)
───────────────────────────────────────────────────────────────────────────────────────
Reliability Feature              Status      Resources
───────────────────────────────────────────────────────────────────────────────────────
Zone redundancy — compute        🟢 ON       • plan-ii5trxva2ark4 (FC1)              — now ON
                                              • plan-web-ii5trxva2ark4 (P1v3)         — now ON
                                              • cae-ii5trxva2ark4 (Container Env)     — already ON

Zone-redundant storage           🟢 ZRS      • stii5trxva2ark4                       — GRS → ZRS

Health probes                    🟡 PARTIAL  • app-web-ii5trxva2ark4                 — now ON
                                              • ca-worker                             — added readiness probe
                                              • func-api-ii5trxva2ark4                — still off (FC1, code change declined)

Multi-region failover            🔴 OFF      • Single region (eastus) only
───────────────────────────────────────────────────────────────────────────────────────

What changed: compute zone redundancy, storage replication, and health probes
on App Service / Container Apps. (Multi-region offered next — see Step 3.)
```

### Step 3 (both paths): Multi-region follow-up — ASK and WAIT

Multi-region is a significant cost/complexity step. Do **NOT** start it automatically. After re-assessment, only if **all core single-region reliability features are 🟢 ON** (zone-redundant compute, ZRS/GZRS storage, health probes), explicitly ask the user and **wait for their response** before doing anything:

```
🟢 Your app is now fully zone-redundant in {region}.

🌟 The next step (optional) is multi-region failover with Azure Front Door:
   • Deploys compute + storage in a second region (paired region recommended)
   • Adds Azure Front Door for global load balancing with health-probe-driven failover
   • Protects against full region outages
   • Estimated additional cost: ~2x compute (active-passive); Front Door ~$35/month base

Do you want me to set up multi-region failover now? (yes / no / later)
```

- **yes** → proceed with [references/configure-multi-region.md](references/configure-multi-region.md). Confirm secondary region choice with the user before generating any IaC.
- **no / later** → leave the deployment as-is. Note that single-region zone-redundant is a reliable end state; multi-region can be revisited anytime.

> **⛔ Do not skip the wait.** Do not generate multi-region IaC, deploy a Front Door, or modify any files until the user has explicitly said yes. If core reliability is not yet all 🟢, do **not** ask about multi-region — finish the core gaps first.

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
