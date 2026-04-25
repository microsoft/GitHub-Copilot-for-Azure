# Relationship Discovery

 Generic `list resources in group` calls do **not** expose most of these links; they live behind separate data-plane or child-resource endpoints.

Running `az resource list` (or the equivalent MCP call) only returns top-level resources. **Every architectural edge listed below is invisible from that call alone.** Skipping these probes produces diagrams that look complete but silently drop critical connections (file-share mounts, VNet integration, RBAC, event routing, OIDC federation, diagnostic pipelines).

## Application Rules

1. For every resource in the filtered list, run the probes under its resource type.
2. For every edge discovered, add a `relationships` entry in the resource model (see [azure-resource-model.md](../azure-resource-model.md)).
3. If a probe returns a principalId / resourceId that points **outside** the current resource group or subscription, still include it — label the target "(external)" in the diagram.
4. Batch probes with `--query` and `-o tsv` to keep output compact.
5. **Resolving opaque principal names**: `az role assignment list` sometimes returns a bare GUID as `principalName` (this happens when the principal is a Service Principal identified by its appId rather than its display name). If `principalName` is a GUID, run `az ad sp show --id <guid>` to resolve it to a human-readable display name before adding it to the diagram. If the SP's `displayName` matches a resource in the RG (e.g., a Function App's system-assigned MI), draw the edge from that resource rather than creating a redundant node.

---

## Probe Table (per resource type)

| Resource type | Probe | Reveals | Relationship |
|---|---|---|---|
| `Microsoft.Web/sites` (App Service / Function App) | `az webapp config storage-account list` | **Azure Files / Blob mounts** on the app | `connects` → Storage Account (label: `mounts Azure Files (<share> → <path>)`) |
| `Microsoft.Web/sites` | `az webapp vnet-integration list` | Regional VNet integration subnet | `peers` → Subnet (label: `VNet integration`) — see VNet Integration Special Case in drawio-diagram-conventions.md |
| `Microsoft.Web/sites` | `az webapp config appsettings list` | App settings with `@Microsoft.KeyVault(...)` refs, connection strings, `AzureWebJobsStorage`, `APPLICATIONINSIGHTS_CONNECTION_STRING` | `connects` → Key Vault / SQL / Storage / App Insights (label: describes the ref) |
| `Microsoft.Web/sites` | `az webapp config hostname list` + `az webapp config ssl list` | Custom domains and the Key Vault that sources the cert | `secures` → Key Vault (label: `TLS cert`) |
| `Microsoft.Web/sites` | `az webapp deployment source show` | Source control / GitHub deployment | `depends` → external repo (note in diagram, not an Azure icon) |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | `az identity federated-credential list` | **OIDC federation** (GitHub Actions, AKS workloads, external IdPs) | `depends` → external IdP/workload (label: `federated: <issuer>/<subject>`) |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | Scan all resources in the RG for `identity.userAssignedIdentities` containing this MI's resourceId | Which resources the MI is **assigned to** | `depends` from MI → target resource (label: `identity`) |
| `Microsoft.KeyVault/vaults` | `az keyvault show --query properties.enableRbacAuthorization` | Whether KV uses **RBAC** or **access policies** | Determines which probe to run next |
| `Microsoft.KeyVault/vaults` (access-policy mode) | `az keyvault show --query properties.accessPolicies` | Principals (objectIds) with get/list/set/... permissions | `connects` principal → Key Vault (label: `secrets get/list`) |
| `Microsoft.KeyVault/vaults` (RBAC mode) | `az role assignment list --scope <kv-id>` | Principals with data-plane KV roles | `connects` principal → Key Vault (label: role name) |
| Any resource with data-plane identity access | `az role assignment list --scope <resource-id>` | Which Managed Identities / Service Principals have RBAC on this resource | `connects` MI/SP → resource (label: role name, e.g. `Storage Blob Data Contributor`) |
| `Microsoft.EventGrid/systemTopics`, `.../topics`, `.../domains` | `az eventgrid system-topic event-subscription list` / `az eventgrid event-subscription list` | **Subscription destinations** (WebHook, Azure Function, Service Bus, Event Hub, Storage Queue) | `routes` topic → destination (label: subscription name + destination type) |
| `Microsoft.ServiceBus/namespaces` | `az servicebus topic subscription list` + subscription rules | Subscribers and filters | `routes` topic → subscriber (label: subscription name) |
| `Microsoft.EventHub/namespaces` | `az eventhubs eventhub consumer-group list` | Consumer groups and their consumers | `routes` hub → consumer (label: consumer group) |
| `Microsoft.Network/virtualNetworks` | `az network vnet peering list` | VNet peerings (intra- or cross-sub) | `peers` VNet ↔ VNet (label: `peering`) |
| `Microsoft.Network/virtualNetworks/subnets` | Subnet `delegations`, `networkSecurityGroup`, `routeTable`, `serviceEndpoints` | Subnet delegation target service, NSG, route table, service endpoints | `secures` NSG → subnet; `routes` route table → subnet; `peers` delegation → delegated service |
| `Microsoft.Network/privateEndpoints` | `az network private-endpoint show --query privateLinkServiceConnections` and `...dnsZoneGroups` | Target resource + linked private DNS zones | `secures` PE → target (label: `private link`); `connects` PE → Private DNS Zone |
| `Microsoft.Network/privateDnsZones` | `az network private-dns link vnet list --zone-name` | VNets linked to the zone | `connects` DNS zone → VNet (label: `DNS link`) |
| `Microsoft.Network/applicationGateways`, `.../frontdoor`, `.../loadBalancers` | Backend pools / origins | Resources in backend (App Services, VMs, IPs) | `routes` gateway → backend member |
| `Microsoft.Sql/servers`, `Microsoft.DBforPostgreSQL/*`, `Microsoft.DBforMySQL/*` | Firewall rules, VNet rules, Entra admin, failover groups, replicas | Network + identity + replication topology | `connects` / `peers` as appropriate |
| `Microsoft.Storage/storageAccounts` | `az storage account blob-service-properties show`, private endpoints (sub-resources: blob, file, queue, table), static website | Static web, lifecycle, per-sub-resource private endpoints | `connects` — label by sub-resource |
| Any resource | `az monitor diagnostic-settings list --resource <id>` | **Diagnostic log routing** to Log Analytics / Event Hub / Storage | `connects` resource → destination (label: `diagnostics: <category>`) |
| `Microsoft.Insights/components` | `workspace_id` property | Workspace-based App Insights ↔ Log Analytics Workspace | `connects` AI → LAW (label: `workspace-based`) |

---

## Resource Group Scope Probes (run once, not per resource)

| Probe | Reveals | How to use in diagram |
|---|---|---|
| `az role assignment list --resource-group <rg>` | RBAC assignments at RG scope (control-plane identities: deployment SPs, admin groups, MIs with broad roles) | Add a note or "Access" side-panel listing principals + roles. Include as edges only for MIs that are resources in the RG. |
| `az policy assignment list --resource-group <rg>` | Policy enforcement scoped here | Note in diagram footnotes — not a typical edge |
| Tag keys common to the RG | Environment / ownership metadata | Use for colour-coding or footnote |

---

## Cross-Resource-Group / Cross-Subscription Refs

When any probe returns an ID whose resourceGroup or subscription differs from the current scope:

1. Include the external target as a node with a dashed border and label "(external — `<rg>/<sub>`)".
2. Do not follow its probes (out of scope).
3. List external deps in a "Cross-scope dependencies" section of the output.

---

## Output Budget

- Prefer `--query` projections over full JSON output — many probes return verbose data.
- Never emit probe raw output in the final diagram or markdown; only the derived relationships.
- Never embed secret values (keys, connection strings, SAS tokens) returned by probes. Use placeholders.
