# Resource Filtering Rules

> **Canonical copy:** This shared reference is duplicated across Azure infrastructure skills. Keep parallel copies synchronized when updating shared guidance.

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
| `Microsoft.Insights/components` (Application Insights) | ✅ | ❌ KEEP | Deployable; not architecture |
| `Microsoft.Insights/actionGroups` | ✅ | ❌ KEEP | Deployable; not architecture |
| `Microsoft.OperationalInsights/workspaces` (Log Analytics) | ✅ | ❌ KEEP | Deployable; not architecture |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | ❌ KEEP | ❌ KEEP | Explicitly created; used for resource authentication and RBAC |
| Diagnostic settings (child resources) | ✅ | ❌ KEEP | Deployable as child |
| Resources with ALL tag keys starting with `hidden-` | ✅ | ✅ | Fully Azure-managed |
| Resources with `hidden-related:` tag prefixes | ✅ | Check individually | May be Azure-managed |

## Application Rules

1. Check resource type against the table (case-insensitive)
2. Check if ALL tag keys start with `hidden-` (fully managed)
3. Apply any user-specified exclusion filters
4. Remove matching resources from the working list
