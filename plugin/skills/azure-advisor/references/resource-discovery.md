# Shared Reference — Repo Resource Scope Discovery

> **Shared across all `azure-advisor` capabilities.** Any capability that wants to
> narrow Advisor results to the resources this repository actually deploys should link
> here instead of re-defining discovery logic.

Advisor tools query a **whole subscription** by default. This skill's repo-scoped review
defaults to narrowing the query to the resources the repo defines, rather than dumping the
entire subscription.

A repo almost always defines **several** resources of **multiple** types — collect them
**all**, never stop after the first. Only when the repo defines no Azure resources at all
should you fall back to a full-subscription review and say so. **Never** hardcode a
resource group, resource type, or resource id.

## What to extract

Scan the workspace's Infrastructure-as-Code and config files for any of these scoping
signals, in this order. Collect every distinct hit (a repo may define several):

1. **Resource group(s)** — the strongest scope signal:
   - `azure.yaml` → `resourceGroup:` / `resourceGroupName:` key
   - `.azure/*/config.json` → `resourceGroup` field
   - `*.bicepparam` / `*.parameters.json` → a `resourceGroup` / `resourceGroupName` parameter
   - `.env*` files → read **only** the `AZURE_RESOURCE_GROUP` / `AZURE_RESOURCEGROUP` line; never load, echo, or summarize other `.env*` contents (they routinely hold secrets)
   - `main.tf` / `*.tf` → `azurerm_resource_group` `name =` value (or a `resource_group_name` local/variable default)
2. **Resource type(s)** — derive from the IaC resource declarations:
   - Bicep `resource x 'Microsoft.<Provider>/<type>@...'` → `Microsoft.<Provider>/<type>`
   - ARM `"type": "Microsoft.<Provider>/<type>"`
   - Terraform `resource "azurerm_<kind>"` → map to its `Microsoft.*` provider type
3. **Specific resource id(s)** — only when a fully-qualified ARM id is present in
   params/env (`/subscriptions/.../resourceGroups/.../providers/...`).

## How to apply the scope

Pass the discovered signal(s) to the **active recommendations** and **summary**
capabilities as filters (see [Capability Routing](capability-routing.md)):

| Discovered signal | Filter to pass |
|---|---|
| Resource group | the tool's resource-group input |
| Resource type(s) | the tool's resource-type filter — review **once per type** when the tool takes a single type, so **every** discovered type is covered |
| Specific resource id | the tool's resource (resource-id) filter |

Apply **all** discovered signals — the review covers the **union** of every resource group
and resource type the repo defines. Where signals overlap, prefer the narrowest available
for a given resource (a specific resource id beats its type, which beats its group), but
never drop a resource type just because a broader signal also exists.

If the recommendations tool has **no** matching scope filter, pull the subscription list
unfiltered and **post-filter** in-context to the discovered resource groups / types / ids
before aggregating or spotlighting.

## Resolution rules

- If **no** scope signal is found, run the **full-subscription** review and note
  "no repo resource scope found — reviewed the whole subscription" in the summary.
- Always mention the *source* of the resolved scope in the final chat summary
  (e.g. "Scoped to resource group `rg-shop-prod` from `infra/main.parameters.json`").
- Scope is a **filter**, not a guarantee — Advisor only returns findings for resources
  that are actually deployed, so a repo resource with no Advisor data simply won't appear.
