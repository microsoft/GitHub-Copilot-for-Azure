# Azure-to-Bicep Workflow

Discover live Azure resources and generate deployment-ready Bicep templates.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Authenticate** | Verify Azure session — see [azure-authentication.md](procedures/azure-authentication.md). **HARD GATE** — stop if not authenticated. |
| 2 | **Accept Inputs** | Get target scope: resource group name(s) or subscription. If not specified, list resource groups and ask user to select. |
| 3 | **Discover Resources** | Query all resources in scope using Azure MCP tools or `az resource list --resource-group <name> -o json`. |
| 4 | **Filter Non-deployable** | Apply [resource-filtering.md](procedures/resource-filtering.md) — remove resources excluded for Bicep (auto-created, hidden). Keep deployable monitoring resources. |
| 5 | **Check Large Scope** | If >30 deployable resources, warn user and suggest splitting by resource group or layer. |
| 6 | **Deep Property Extraction** | For each resource, retrieve full properties using MCP tools or `az resource show`. See [azure-resource-configs.md](azure-resource-configs.md) for per-type field paths. Strip read-only ARM properties (`provisioningState`, `resourceGuid`, `etag`, timestamps). |
| 7 | **Detect Secrets** | Scan extracted properties for connection strings, keys, passwords. Replace with `@secure()` parameters using `readEnvironmentVariable()` in `.bicepparam`. |
| 8 | **Analyze Dependencies** | Map internal dependencies (App Service → Plan, Private Endpoint → target). Identify external out-of-scope references (resources in other subscriptions/groups). |
| 9 | **Generate Bicep** | Create modular Bicep following [bicep-best-practices.md](bicep-best-practices.md). Use latest stable API versions per [version-currency.md](version-currency.md). Group resources into `modules/` by layer (networking, compute, data, identity, monitoring). Generate `main.bicep` orchestrator and `main.bicepparam` with all values. |
| 10 | **Generate Out-of-scope Dependencies** | For external references, create `dependencies/` folder with Bicep templates annotated as out-of-scope. |
| 11 | **Run Verification** | Apply [azure-deployment-verification.md](azure-deployment-verification.md) checks. Fix errors automatically where possible. Present checklist. |
| 12 | **Save Output** | Write all files to project folder. Present resource summary and verification results. |

## Read-Only ARM Properties to Strip

These properties exist in Azure responses but must NOT appear in generated Bicep:

- `provisioningState`, `resourceGuid`, `etag`
- `id` (at resource level — use symbolic references instead)
- Timestamps: `createdTime`, `changedTime`, `lastModifiedTime`
- Status fields: `state`, `status`, `hostNames`, `defaultHostName`
- Computed fields: `outboundIpAddresses`, `possibleOutboundIpAddresses`

## Secret Detection Patterns

| Pattern | Action |
|---|---|
| Property name contains `password`, `key`, `secret`, `connectionString` | Mark `@secure()` |
| Value resembles a key (base64, 40+ chars, random) | Mark `@secure()` |
| Storage account keys | Use `listKeys()` function or `@secure()` param |
| SQL admin password | Use `@secure()` param with `readEnvironmentVariable()` |
