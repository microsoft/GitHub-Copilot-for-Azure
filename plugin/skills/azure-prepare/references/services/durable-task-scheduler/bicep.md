# Durable Task Scheduler — Bicep Patterns

Bicep templates for provisioning the Durable Task Scheduler, task hubs, and RBAC role assignments.

## Scheduler + Task Hub

```bicep
// Parameters — define these at file level or pass from a parent module
param schedulerName string
param location string = resourceGroup().location

@allowed(['Consumption', 'Dedicated'])
@description('Use Consumption for quickstarts/variable workloads, Dedicated for high-demand/predictable throughput')
param skuName string = 'Consumption'

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
```

## SKU Selection

| SKU | Best For |
|-----|----------|
| **Consumption** | quickstarts, variable or bursty workloads, pay-per-use |
| **Dedicated** | High-demand workloads, predictable throughput requirements |

> **💡 TIP**: Start with `Consumption` for development and variable workloads. Switch to `Dedicated` when you need consistent, high-throughput performance.

> **⚠️ WARNING**: The scheduler's `ipAllowlist` **must** include at least one entry (e.g., `['0.0.0.0/0']` for allow-all). An empty array `[]` denies **all** traffic, causing 403 errors on gRPC calls even with correct RBAC.

## RBAC — Durable Task Data Contributor

The Function App's managed identity **must** have the `Durable Task Data Contributor` role on the scheduler resource. Without it, the app receives **403 PermissionDenied** on gRPC calls.

```bicep
// Assumes functionApp is defined elsewhere in the same Bicep file, e.g.:
// resource functionApp 'Microsoft.Web/sites@2023-12-01' = { ... }

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

## Connection String App Setting

Include these entries in the Function App resource's `siteConfig.appSettings` array:

```bicep
{
  name: 'DURABLE_TASK_SCHEDULER_CONNECTION_STRING'
  value: 'Endpoint=${scheduler.properties.endpoint};TaskHub=${taskHub.name};Authentication=ManagedIdentity'
}
```

> **⚠️ WARNING**: Always use `scheduler.properties.endpoint` to get the scheduler URL. Do **not** construct it manually — the endpoint includes a hash suffix and region (e.g., `https://myscheduler-abc123.westus2.durabletask.io`).

## Provision via CLI

> **💡 TIP**: When hosting Durable Functions, use a **Flex Consumption** plan (`FC1` SKU) rather than the legacy Consumption plan (`Y1`). Flex Consumption supports identity-based storage connections natively and handles deployment artifacts correctly.

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

## Full Deployment Reference

For complete deployment workflows, AZD commands, and managed identity CLI setup, invoke the **azure-deploy** skill which includes a DTS-specific deployment recipe.
