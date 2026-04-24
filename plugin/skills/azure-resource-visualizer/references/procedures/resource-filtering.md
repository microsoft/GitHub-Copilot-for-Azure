# Resource Filtering Rules

Centralized exclusion lists for Azure resource discovery. Different skills filter differently — diagrams show architecture only, Bicep deploys everything deployable.

---

## Exclusion Table

| Resource Type | Exclude for Diagrams | Exclude for Bicep | Rationale |
|---|---|---|---|
| `Microsoft.Network/networkWatchers` | ✅ | ✅ | Auto-created by Azure |
| `Microsoft.Network/networkWatchers/connectionMonitors` | ✅ | ✅ | Auto-created child |
| `Microsoft.AlertsManagement/smartDetectorAlertRules` | ✅ | ✅ | Auto-created |
| `Microsoft.Portal/dashboards` | ✅ | ✅ | Portal UI artifact |
| `microsoft.insights/autoscalesettings` (with `hidden-related:` tags) | ✅ | ✅ | Auto-created |
| `Microsoft.Network/networkIntentPolicies` | ✅ | ✅ | Auto-created |
| `Microsoft.Network/serviceEndpointPolicies` | ✅ | ✅ | Auto-created |
| `Microsoft.Resources/deployments` | ✅ | ✅ | Deployment history |
| `Microsoft.Resources/templateSpecs` | ✅ | ✅ | Template metadata |
| `Microsoft.Authorization/*` | ✅ | ✅ | RBAC / Policy |
| `Microsoft.Insights/components` (Application Insights) | ❌ KEEP | ❌ KEEP | Relevant for both Bicep and diagrams |
| `Microsoft.Insights/actionGroups` | ✅ | ❌ KEEP | Deployable; not architecture |
| `Microsoft.OperationalInsights/workspaces` (Log Analytics) | ✅ | ❌ KEEP | Deployable; not architecture |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | ❌ KEEP | ❌ KEEP | Explicitly created; used for resource authentication and RBAC |
| Diagnostic settings (child resources) | ✅ | ❌ KEEP | Deployable as child |
| Resources with ALL tag keys starting with `hidden-` | ✅ | ✅ | Fully Azure-managed |
| Resources with `hidden-related:` tag prefixes | ✅ | Check individually | May be Azure-managed |

## Child Resource Handling

`az resource list` (and the MCP equivalent) returns child resources as separate items when they have their own ARM resource IDs (e.g., `Microsoft.Communication/EmailServices/Domains`, `Microsoft.Sql/servers/databases`, `Microsoft.KeyVault/vaults/keys`). Apply this rule:

- **Fold into parent node** if the child has no relationships of its own (e.g., email domains, firewall rules, access policies). List notable children in the parent node's label instead.
- **Keep as a separate node** only if the child is itself a target or source of a relationship edge (e.g., a SQL Database that an App Service connects to directly).

## Application Rules

1. Check resource type against the table (case-insensitive)
2. Check if ALL tag keys start with `hidden-` (fully managed)
3. For child resources (type path contains more than one `/` after the provider), apply the Child Resource Handling rule above
4. Apply any user-specified exclusion filters
5. Remove matching resources from the working list
