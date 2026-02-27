# Durable Task Scheduler Deployment

Deployment workflows for Durable Task Scheduler on Azure, including provisioning, Bicep templates, and managed identity configuration.

## Prerequisites

- Application prepared with azure-prepare skill
- `azure.yaml` exists and validated
- `.azure/plan.md` exists; Validation Proof section status = `Validated`
- Docker (for local emulator development)

## SKU Selection

| SKU | Best For |
|-----|----------|
| **Consumption** | quickstarts, variable or bursty workloads, pay-per-use |
| **Dedicated** | High-demand workloads, predictable throughput requirements |

> **💡 TIP**: Start with `Consumption` for development and variable workloads. Switch to `Dedicated` when you need consistent, high-throughput performance.

## Provision Durable Task Scheduler

```bash
# Install the durabletask CLI extension (if not already installed)
az extension add --name durabletask

# Create scheduler (consumption SKU for getting started)
az durabletask scheduler create \
    --resource-group myResourceGroup \
    --name my-scheduler \
    --location eastus \
    --sku consumption
```

## Bicep Example

```bicep
// Parameters — define these at file level or pass from a parent module
param schedulerName string
param location string = resourceGroup().location

@allowed(['Consumption', 'Dedicated'])
@description('Use Consumption for quickstarts/variable workloads, Dedicated for high-demand/predictable throughput')
param skuName string = 'Consumption'

// Assumes functionApp is defined elsewhere in the same Bicep file, e.g.:
// resource functionApp 'Microsoft.Web/sites@2023-12-01' = { ... }

resource scheduler 'Microsoft.DurableTask/schedulers@2025-11-01' = {
  name: schedulerName
  location: location
  properties: {
    sku: { name: skuName }
    ipAllowlist: ['0.0.0.0/0'] // Required: empty list denies all traffic
  }
}

resource taskHub 'Microsoft.DurableTask/schedulers/taskHubs@2025-11-01' = {
  parent: scheduler
  name: 'default'
}

// REQUIRED: Assign Durable Task Data Contributor to the Function App's managed identity
var durableTaskDataContributorRoleId = '0ad04412-c4d5-4796-b79c-f76d14c8d402'

resource durableTaskRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(scheduler.id, functionApp.id, durableTaskDataContributorRoleId)
  scope: scheduler
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', durableTaskDataContributorRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

> **⚠️ WARNING**: Without the `Durable Task Data Contributor` role assignment, the Function App will receive a **403 PermissionDenied** error when attempting to start orchestrations via gRPC. Always include this role assignment in your infrastructure-as-code.

## Dashboard Access for Developers

To allow developers to view orchestration status and history in the DTS dashboard, also assign the `Durable Task Data Contributor` role to the deploying user's identity:

```bicep
// Accept the deploying user's principal ID (azd auto-populates this from AZURE_PRINCIPAL_ID)
param principalId string = ''

resource dashboardRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(scheduler.id, principalId, durableTaskDataContributorRoleId)
  scope: scheduler
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', durableTaskDataContributorRoleId)
    principalId: principalId
    principalType: 'User'
  }
}
```

> **💡 TIP**: Without this role assignment, the DTS dashboard in the Azure portal returns **403 Forbidden**. The `principalId` parameter is automatically populated by `azd` from the `AZURE_PRINCIPAL_ID` environment variable.

## Configure Managed Identity Access

```bash
# Get Function App system-assigned identity
PRINCIPAL_ID=$(az functionapp identity show --name my-func-app --resource-group myRG --query principalId -o tsv)

# Grant access to scheduler
az role assignment create \
    --assignee $PRINCIPAL_ID \
    --role "Durable Task Data Contributor" \
    --scope /subscriptions/<sub-id>/resourceGroups/myRG/providers/Microsoft.DurableTask/schedulers/my-scheduler
```

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
| **403 PermissionDenied** on gRPC call (e.g., `client.start_new()`) | Function App managed identity lacks RBAC on the Durable Task Scheduler resource, or IP allowlist blocks traffic | 1. Assign `Durable Task Data Contributor` role (`0ad04412-c4d5-4796-b79c-f76d14c8d402`) to the identity (SAMI or UAMI) scoped to the Durable Task Scheduler resource. For UAMI, also ensure the connection string includes `ClientID=<uami-client-id>`. 2. Ensure the scheduler's `ipAllowlist` includes `0.0.0.0/0` (an empty list denies all traffic). 3. RBAC propagation can take up to 10 minutes — restart the Function App after assigning roles. |
| **Connection refused** to emulator | Emulator container not running or wrong port | Verify container is running: `docker ps` and confirm port 8080 is mapped |
| **403 despite correct RBAC** | Scheduler IP allowlist is empty (denies all) | Set `ipAllowlist: ['0.0.0.0/0']` in Bicep or update via CLI: `az durabletask scheduler update --ip-allowlist '0.0.0.0/0'` |
| **TaskHub not found** | Task hub not provisioned or name mismatch | Ensure the `TaskHub` parameter in the `DURABLE_TASK_SCHEDULER_CONNECTION_STRING` matches the provisioned task hub name |

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
