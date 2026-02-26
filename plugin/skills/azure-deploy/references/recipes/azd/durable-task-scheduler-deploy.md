# Durable Task Scheduler Deployment

Deployment workflows for Durable Task Scheduler on Azure, including provisioning, Bicep templates, and managed identity configuration.

## Prerequisites

- Application prepared with azure-prepare skill
- `azure.yaml` exists and validated
- `.azure/preparation-manifest.md` status = `Validated`
- Docker (for local emulator development)

## SKU Selection

| SKU | Best For |
|-----|----------|
| **Consumption** | quickstarts, variable or bursty workloads, pay-per-use |
| **Dedicated** | High-demand workloads, predictable throughput requirements |

> **💡 TIP**: Start with `consumption` for development and variable workloads. Switch to `dedicated` when you need consistent, high-throughput performance.

## Provision Durable Task Scheduler

```bash
# Create scheduler (consumption SKU for getting started)
az durabletask scheduler create \
    --resource-group myResourceGroup \
    --name my-scheduler \
    --location eastus \
    --sku consumption
```

## Bicep Example

```bicep
@allowed(['consumption', 'dedicated'])
@description('Use consumption for quickstarts/variable workloads, dedicated for high-demand/predictable throughput')
param skuName string = 'consumption'

resource scheduler 'Microsoft.DurableTask/schedulers@2025-11-01' = {
  name: schedulerName
  location: location
  properties: {
    sku: { name: skuName }
  }
}

resource taskHub 'Microsoft.DurableTask/schedulers/taskHubs@2025-11-01' = {
  parent: scheduler
  name: 'default'
}

// REQUIRED: Assign Durable Task Data Contributor to the Function App's managed identity
var durableTaskDataContributorRoleId = '5f6a3c3e-0da3-4079-b4f3-4db62a1d3c09'

// --- Option A: System-Assigned Managed Identity (SAMI) ---
resource durableTaskRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(scheduler.id, functionApp.id, durableTaskDataContributorRoleId)
  scope: scheduler
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', durableTaskDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// --- Option B: User-Assigned Managed Identity (UAMI) ---
// Uncomment this block and comment out Option A above if you prefer UAMI.
//
// resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
//   name: '<uami-name>'
//   location: location
// }
//
// // Assign the UAMI to the Function App
// // (include in functionApp resource properties)
// // identity: {
// //   type: 'UserAssigned'
// //   userAssignedIdentities: { '${uami.id}': {} }
// // }
//
// // Assign Durable Task Data Contributor to the UAMI
// resource durableTaskUamiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
//   name: guid(scheduler.id, uami.id, durableTaskDataContributorRoleId)
//   scope: scheduler
//   properties: {
//     roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', durableTaskDataContributorRoleId)
//     principalId: uami.properties.principalId
//     principalType: 'ServicePrincipal'
//   }
// }
//
// // Set the connection string app setting to include the UAMI ClientID:
// // DTS_CONNECTION_STRING = 'Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity;ClientID=${uami.properties.clientId}'
```

> **⚠️ WARNING**: Without the `Durable Task Data Contributor` role assignment, the Function App will receive a **403 PermissionDenied** error when attempting to start orchestrations via gRPC. Always include this role assignment in your infrastructure-as-code.

## Configure Managed Identity Access

**Option A: System-Assigned Managed Identity (SAMI) — Recommended default:**
```bash
# Get Function App system-assigned identity
PRINCIPAL_ID=$(az functionapp identity show --name my-func-app --resource-group myRG --query principalId -o tsv)

# Grant access to scheduler
az role assignment create \
    --assignee $PRINCIPAL_ID \
    --role "Durable Task Data Contributor" \
    --scope /subscriptions/<sub-id>/resourceGroups/myRG/providers/Microsoft.DurableTask/schedulers/my-scheduler
```

<!--
**Option B: User-Assigned Managed Identity (UAMI)**
Use this instead of Option A if you prefer a user-assigned managed identity.

```bash
# Get UAMI principal ID
UAMI_PRINCIPAL_ID=$(az identity show --name my-uami --resource-group myRG --query principalId -o tsv)
UAMI_CLIENT_ID=$(az identity show --name my-uami --resource-group myRG --query clientId -o tsv)

# Assign UAMI to Function App
az functionapp identity assign --name my-func-app --resource-group myRG \
    --identities /subscriptions/<sub-id>/resourceGroups/myRG/providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-uami

# Grant Durable Task Data Contributor to the UAMI
az role assignment create \
    --assignee $UAMI_PRINCIPAL_ID \
    --role "Durable Task Data Contributor" \
    --scope /subscriptions/<sub-id>/resourceGroups/myRG/providers/Microsoft.DurableTask/schedulers/my-scheduler

# Set the connection string with ClientID in app settings
az functionapp config appsettings set --name my-func-app --resource-group myRG \
    --settings "DTS_CONNECTION_STRING=Endpoint=https://my-scheduler.durabletask.io;Authentication=ManagedIdentity;ClientID=$UAMI_CLIENT_ID"
```
-->

## AZD Deployment

### Full Deployment (Infrastructure + Code)

```bash
azd up --no-prompt
```

### Infrastructure Only

```bash
azd provision --no-prompt
```

### Application Only

```bash
azd deploy --no-prompt
```

## Verify Deployment

```bash
# Show deployment details
azd show

# Verify scheduler is provisioned
az durabletask scheduler show \
    --resource-group myResourceGroup \
    --name my-scheduler

# Verify task hub exists
az durabletask taskhub show \
    --resource-group myResourceGroup \
    --scheduler-name my-scheduler \
    --name default
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **403 PermissionDenied** on gRPC call (e.g., `client.start_new()`) | Function App managed identity lacks RBAC on the Durable Task Scheduler resource | Assign `Durable Task Data Contributor` role (`5f6a3c3e-0da3-4079-b4f3-4db62a1d3c09`) to the identity (SAMI or UAMI) scoped to the Durable Task Scheduler resource. For UAMI, also ensure the connection string includes `ClientID=<uami-client-id>` |
| **Connection refused** to emulator | Emulator container not running or wrong port | Verify container is running: `docker ps` and confirm port 8080 is mapped |
| **TaskHub not found** | Task hub not provisioned or name mismatch | Ensure `TASKHUB_NAME` app setting matches the provisioned task hub name |

## Data Loss Warning

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** in the environment, including:
> - **Durable Task Scheduler** and all task hubs
> - **Function Apps** with all configuration and deployment slots
> - **Storage accounts** with all blobs and files
>
> **Best practices:**
> - Always use `azd provision --preview` before `azd up`
> - Use separate environments for dev/staging/production
> - Back up important data before running `azd down`

## Next Steps

After deployment:
1. Verify scheduler and task hub are provisioned
2. Test orchestration endpoints
3. Monitor via the DTS dashboard or Application Insights
4. Set up alerts for orchestration failures
