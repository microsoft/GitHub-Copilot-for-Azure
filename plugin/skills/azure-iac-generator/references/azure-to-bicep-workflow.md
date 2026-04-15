# Azure-to-Bicep Workflow

Reverse-engineer live Azure resources into modular, deployment-ready Bicep. Every step is **mandatory** — do not skip or combine steps.

> ⚠️ **Before starting**: Read [bicep-best-practices.md](bicep-best-practices.md) and [version-currency.md](version-currency.md). Call Bicep MCP `get_bicep_best_practices` to load current rules.

## Step 1 — Authenticate (HARD GATE)

Follow [azure-authentication.md](procedures/azure-authentication.md). **Stop** if not authenticated.

## Step 2 — Accept Inputs

Get target scope: resource group name(s) and subscription ID. If not specified, list resource groups and ask user to select. Optionally accept resource type filters or exclusions.

## Step 3 — Discover Resources

Use `group_resource_list` (or `az resource list --resource-group <name>`) to enumerate all resources. Extract: `id`, `name`, `type`, `location`, `tags`, `sku`. If no resources found, stop with an error.

## Step 4 — Filter Non-Deployable Resources

Remove auto-created and hidden resources per [resource-filtering.md](procedures/resource-filtering.md) (use "Exclude for Bicep" column). Keep: Application Insights, Log Analytics, user-assigned identities, diagnostic settings. If >30 resources remain, warn user and offer to filter by type.

## Step 5 — Deep Property Extraction (HARD GATE)

**Do NOT skip this step.** For every resource, retrieve the **full** configuration:

| Resource Type | Tool | Also Extract |
|---|---|---|
| `Microsoft.Web/sites` | Azure MCP or `az webapp show` | `az webapp config appsettings list --ids <id>` for app settings, `siteConfig.linuxFxVersion` or `windowsFxVersion` for runtime stack |
| `Microsoft.Web/serverfarms` | Azure MCP or `az appservice plan show` | `sku.name`, `sku.tier`, `kind`, `properties.reserved` (Linux flag) |
| `Microsoft.Compute/virtualMachines` | Azure MCP `compute` or `az vm show` | `storageProfile.imageReference` → assemble as `publisher:offer:sku:version` |
| `Microsoft.Storage/storageAccounts` | Azure MCP `storage` or `az storage account show` | `minimumTlsVersion`, `allowBlobPublicAccess`, `kind`, `accessTier` |
| `Microsoft.KeyVault/vaults` | Azure MCP `keyvault` or `az keyvault show` | `enableRbacAuthorization`, `softDeleteRetentionInDays` |
| All other types | `az resource show --ids <id> -o json` | See [azure-resource-configs.md](azure-resource-configs.md) for per-type field maps |

**Strip read-only ARM properties** — these must NOT appear in generated Bicep:
- `provisioningState`, `resourceGuid`, `etag`, `uniqueId`
- `id`, `name`, `type` at property level (derived from Bicep resource declaration)
- Timestamps: `createdTime`, `changedTime`, `lastModifiedTime`, `createdDate`
- Computed: `outboundIpAddresses`, `possibleOutboundIpAddresses`, `defaultHostName`, `hostNames`, `state`, `status`
- Identity outputs: `identity.principalId`, `identity.tenantId` (keep `identity.type` and `userAssignedIdentities`)

**Detect secrets**: Scan for properties containing `password`, `key`, `secret`, `connectionString`, `accessKey`, or masked values (`****`). Record each for `@secure()` parameter generation.

If extraction fails for a resource, log a warning and continue with list-level data — do not stop.

## Step 6 — Analyze Dependencies

**Internal** (within scope): Map App Service → Plan, PE → target, NIC → VM, NSG → Subnet, Diagnostic → Log Analytics. Apply [auto-detection-rules.md](auto-detection-rules.md).

**External** (outside scope): Identify references to resources in other resource groups/subscriptions (VNet peering, shared Log Analytics, external Key Vault, external DNS zones). Record: resource ID, type, required action, depended-on-by.

## Step 7 — Create Output Folder

Create a folder named after the scope (e.g., resource group name). All generated files go inside this folder. **Never** write files to the repository root.

## Step 8 — Generate Modular Bicep (HARD GATE)

**MUST use modules.** `main.bicep` contains ONLY `param`, `module`, and `output` statements — no inline resource declarations.

Follow [bicep-best-practices.md](bicep-best-practices.md) strictly. Call Bicep MCP `get_az_resource_type_schema` for each resource type to get the latest stable API version.

| File | Contents |
|---|---|
| `main.bicep` | `targetScope = 'resourceGroup'`; all params with `@description()` and `@secure()` where needed; one `module` block per category; outputs for key endpoints/IDs |
| `<scope>.bicepparam` | `using 'main.bicep'`; every param value matching current Azure config; 1-3 line comments per param (what it controls, alternatives with cost impact, version EOL dates); `readEnvironmentVariable()` for secrets |
| `modules/networking.bicep` | VNets, subnets, NSGs, private endpoints, NICs, firewalls |
| `modules/compute.bicep` | VMs, App Services, Functions, Container Apps — follow the runtime defaulting rules in [version-currency.md](version-currency.md) |
| `modules/data.bicep` | Storage, SQL, Cosmos DB, Redis, Key Vault |
| `modules/identity.bicep` | User-assigned managed identities, role assignments |
| `modules/monitoring.bicep` | App Insights, Log Analytics, action groups |

Only create module files that have resources. Each module receives only the params it needs. Use `parent:` for child resources, `existing` blocks for cross-module refs, symbolic references (`foo.id`) — never `resourceId()`.

Apply the runtime defaulting and comment rules from [version-currency.md](version-currency.md). That file is the single source of truth for supported-versus-EOL handling.

## Step 9 — Generate Dependencies Folder

If external dependencies were found in Step 6, create `dependencies/` with:
- `dependencies/README.md` — table of external dependencies (resource, type, required action, owner)
- One `.bicep` + `.bicepparam` pair per dependency type where a deployable template is possible

If no external dependencies exist, skip this step.

## Step 10 — Run Verification (HARD GATE)

Apply **all** rules from [azure-deployment-verification.md](azure-deployment-verification.md): SKU dependencies, resource compatibility, networking, security, version currency. Auto-fix errors where possible. Present results as:

```
## Pre-Deployment Verification
✅ N passed  ⚠️ N warnings  ❌ N errors
```

Do NOT present output with known unfixed errors.

## Step 11 — Generate README.md

Write `README.md` inside the output folder containing:
1. **Original request** — the user's exact prompt
2. **Source** — resource group, subscription ID, discovery date
3. **Verification results** — pass/warning/error summary
4. **Generated files** — table of every file with description
5. **Resource summary** — count by type, extraction status (full/partial)
6. **Secrets** — count of detected secrets requiring manual configuration
7. **Deploy commands** — `az deployment group create` and `New-AzResourceGroupDeployment` examples
8. **Next steps** — populate secrets, review `dependencies/`, post-deploy validation

## Step 12 — Present Summary

Show in chat: resource count, file count, verification results, and the path to the generated folder. Do NOT echo full Bicep content — only paths and summaries.
