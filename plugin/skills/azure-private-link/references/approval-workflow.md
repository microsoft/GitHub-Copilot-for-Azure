# Private Endpoint Approval Workflow

When a consumer creates a private endpoint targeting a resource they don't own, the connection may require approval from the resource owner. Understanding the approval workflow is essential for both service providers and consumers.

## Auto-Approval vs Manual Approval

### Auto-Approval

Auto-approval occurs when the private endpoint creator has sufficient RBAC permissions on the target resource. In these scenarios, the connection is **immediately approved** without any manual intervention:

- **Same-subscription PaaS resources** — if you have `Microsoft.Network/privateEndpoints/write` and the appropriate role (e.g., Contributor, Owner) on the target PaaS resource, the connection auto-approves.
- **Private Link Service with auto-approval list** — if the consumer's subscription ID is in the PLS auto-approval list, the connection auto-approves.

### Manual Approval

Manual approval is required when:

- The consumer lacks direct RBAC permissions on the target resource (e.g., cross-subscription or cross-tenant connections).
- The Private Link Service provider has not added the consumer's subscription to the auto-approval list.
- The consumer explicitly creates a manual connection (using `--manual-request` flag).

In manual approval mode, the connection enters **Pending** state and remains there until the resource owner approves or rejects it.

## Connection Lifecycle

```
Consumer creates          Resource owner          Resource owner         Resource owner
Private Endpoint          approves                rejects                removes
      │                      │                       │                      │
      ▼                      ▼                       ▼                      ▼
  ┌─────────┐          ┌──────────┐           ┌──────────┐          ┌──────────────┐
  │ Pending │───────►  │ Approved │           │ Rejected │          │ Disconnected │
  └─────────┘          └──────────┘           └──────────┘          └──────────────┘
       │                     │                                             ▲
       │                     │─────────────────────────────────────────────┘
       │                           Resource owner removes connection
       │
       └──────► Consumer deletes PE (connection disappears)
```

| State | Description | Consumer Action | Provider Action |
|-------|-------------|-----------------|-----------------|
| **Pending** | Consumer created PE; awaiting approval | Wait or contact resource owner | Approve or reject |
| **Approved** | Connection is active; traffic flows | Use the service | Monitor; can disconnect later |
| **Rejected** | Resource owner denied the request | Delete PE; request approval through other channels | Can re-approve if needed |
| **Disconnected** | Resource owner removed an approved connection | Delete PE and recreate if access is still needed | Re-approve if reconnection needed |

## Configuring Auto-Approval by Subscription ID

For Private Link Service providers who want to auto-approve connections from trusted subscriptions:

```bash
# Set auto-approval for specific consumer subscriptions
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --auto-approval \
    /subscriptions/aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb \
    /subscriptions/cccccccc-4444-5555-6666-dddddddddddd
```

For PaaS resources (Storage, SQL, Key Vault, etc.), auto-approval is controlled by RBAC. If the PE creator has sufficient permissions on the target resource, the connection auto-approves.

## Visibility Settings

Visibility controls who can **discover** and **request connections** to your Private Link Service:

```bash
# Only allow specific subscriptions to see the PLS
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --visibility \
    /subscriptions/aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb \
    /subscriptions/cccccccc-4444-5555-6666-dddddddddddd

# Allow all subscriptions to see the PLS
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --visibility '*'
```

> **Note:** Visibility and auto-approval are independent settings. A subscription can be in the visibility list (can request a connection) but not in auto-approval (connection requires manual approval).

## Managing Pending Connections

### List All Connections on a PaaS Resource

```bash
# For a Storage account
az network private-endpoint-connection list \
  --resource-name MyStorageAccount \
  -g MyRG \
  --type Microsoft.Storage/storageAccounts \
  -o table
```

### List All Connections on a Private Link Service

```bash
az network private-link-service show \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --query "privateEndpointConnections[].[name, privateLinkServiceConnectionState.status, privateLinkServiceConnectionState.description]" \
  -o table
```

### Approve a Pending Connection

```bash
# On a PaaS resource (e.g., Storage)
az network private-endpoint-connection approve \
  --resource-name MyStorageAccount \
  -g MyRG \
  --type Microsoft.Storage/storageAccounts \
  -n MyConnectionName \
  --description "Approved for project Alpha"

# On a Private Link Service
az network private-endpoint-connection approve \
  --resource-name MyPrivateLinkService \
  -g ProviderRG \
  --type Microsoft.Network/privateLinkServices \
  -n MyConnectionName \
  --description "Approved by networking team"
```

### Reject a Connection

```bash
az network private-endpoint-connection reject \
  --resource-name MyStorageAccount \
  -g MyRG \
  --type Microsoft.Storage/storageAccounts \
  -n MyConnectionName \
  --description "Rejected: use the approved private endpoint in the hub VNet instead"
```

### Remove (Delete) a Connection

```bash
az network private-endpoint-connection delete \
  --resource-name MyStorageAccount \
  -g MyRG \
  --type Microsoft.Storage/storageAccounts \
  -n MyConnectionName
```

## Cross-Tenant Private Endpoint Connections

Private endpoints can connect to resources in a different Azure AD tenant. This is common in:

- **ISV/SaaS scenarios** — a vendor exposes a Private Link Service, and customers in their own tenants connect to it.
- **Multi-tenant enterprise** — business units in separate tenants need private access to shared services.

### How Cross-Tenant Works

1. **Provider** shares the PLS alias (e.g., `MyPLS.{guid}.{region}.azure.privatelinkservice`) with the consumer.
2. **Consumer** creates a private endpoint using the alias. The connection goes to **Pending** state.
3. **Provider** approves the connection on the PLS.
4. **Consumer** configures DNS in their VNet to resolve the service hostname to the private endpoint IP.

Cross-tenant connections always require manual approval (auto-approval only works within the same tenant or by subscription ID in the auto-approval list).

```bash
# Consumer (different tenant) creates PE using alias
az network private-endpoint create \
  -g ConsumerRG \
  -n CrossTenantPE \
  --vnet-name ConsumerVNet \
  --subnet ConsumerSubnet \
  --manual-request true \
  --private-connection-resource-id "" \
  --manual-request-connection-id MyPLS.abcdef12-3456-7890.eastus.azure.privatelinkservice \
  --connection-name CrossTenantConnection \
  --request-message "Consumer Corp requesting access - ticket INC0012345"
```

## Azure Policy for Enforcing Private Endpoints

Use Azure Policy to ensure that PaaS resources are only accessible through private endpoints:

### Common Built-in Policies

| Policy | Effect | Description |
|--------|--------|-------------|
| `Configure {service} to use private DNS zones` | DeployIfNotExists | Auto-creates DNS zone groups when private endpoints are created |
| `{service} should use private link` | Audit / Deny | Audits or blocks PaaS resources without private endpoints |
| `{service} should disable public network access` | Audit / Deny | Ensures public access is disabled |

### Example: Deny Storage Accounts Without Private Endpoints

```json
{
  "if": {
    "allOf": [
      {
        "field": "type",
        "equals": "Microsoft.Storage/storageAccounts"
      },
      {
        "count": {
          "field": "Microsoft.Storage/storageAccounts/privateEndpointConnections[*]",
          "where": {
            "field": "Microsoft.Storage/storageAccounts/privateEndpointConnections[*].privateLinkServiceConnectionState.status",
            "equals": "Approved"
          }
        },
        "less": 1
      }
    ]
  },
  "then": {
    "effect": "Audit"
  }
}
```

### Example: Auto-Configure DNS Zone Groups (DeployIfNotExists)

Azure provides built-in policies under the initiative **"Configure Azure PaaS services to use private DNS zones"** that automatically create DNS zone groups when private endpoints are created. Assign this initiative at the management group or subscription level to ensure consistent DNS configuration.

```bash
# Assign the built-in initiative
az policy assignment create \
  --name "EnforcePEDnsZones" \
  --display-name "Auto-configure Private Endpoint DNS zones" \
  --policy-set-definition "e8e3286c-a037-4148-8802-5ff4e3e0390b" \
  --scope /subscriptions/{sub-id} \
  --params '{"privateDnsZoneId": {"value": "/subscriptions/{sub}/resourceGroups/MyDnsRG/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net"}}'
```

## Best Practices: When to Use Auto-Approval vs Manual

| Scenario | Recommendation | Reason |
|----------|---------------|--------|
| Internal team in the same subscription | Auto-approval (RBAC) | Minimal friction; RBAC already controls access |
| Trusted partner subscriptions | Auto-approval list | Streamlines onboarding for known consumers |
| External customers / ISV model | Manual approval | Verify identity and authorization before granting access |
| Cross-tenant connections | Manual approval (required) | Auto-approval doesn't work cross-tenant |
| Marketplace / public offering | Manual or auto with visibility controls | Use visibility to restrict who can discover the service |
| Highly regulated environments | Manual approval with audit trail | Ensures every connection is explicitly reviewed and documented |

## Auditing: Tracking Who Approved or Rejected Connections

### Activity Log

Every approve, reject, and delete action on private endpoint connections is recorded in the Azure Activity Log:

```bash
# Query activity log for private endpoint connection events
az monitor activity-log list \
  --resource-group MyRG \
  --query "[?contains(operationName.value, 'privateEndpointConnection')].{Operation:operationName.value, Status:status.value, Caller:caller, Time:eventTimestamp}" \
  --start-time 2024-01-01 \
  -o table
```

### Diagnostic Settings

For long-term audit retention, configure Diagnostic Settings on the PaaS resource to send Activity Logs to:

- **Log Analytics workspace** — for querying with KQL
- **Storage Account** — for compliance archival
- **Event Hub** — for SIEM integration

### KQL Query for Private Endpoint Connection Approvals

```kql
AzureActivity
| where OperationNameValue contains "privateEndpointConnection"
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, OperationNameValue, ResourceGroup, Resource
| order by TimeGenerated desc
```

This query shows who approved, rejected, or removed private endpoint connections, including the timestamp and the resource involved.
