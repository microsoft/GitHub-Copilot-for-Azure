# Durable Task Scheduler — Bicep Patterns

Bicep templates for provisioning the Durable Task Scheduler, task hubs, and RBAC role assignments.

## Scheduler + Task Hub

```bicep
// Parameters — define these at file level or pass from a parent module
param schedulerName string
param location string = resourceGroup().location

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
```

## SKU Selection

| SKU | Best For |
|-----|----------|
| **Consumption** | quickstarts, variable or bursty workloads, pay-per-use |
| **Dedicated** | High-demand workloads, predictable throughput requirements |

> **💡 TIP**: Start with `consumption` for development and variable workloads. Switch to `dedicated` when you need consistent, high-throughput performance.

## RBAC — Durable Task Data Contributor

The Function App's managed identity **must** have the `Durable Task Data Contributor` role on the scheduler resource. Without it, the app receives **403 PermissionDenied** on gRPC calls.

```bicep
// Assumes functionApp is defined elsewhere in the same Bicep file, e.g.:
// resource functionApp 'Microsoft.Web/sites@2023-12-01' = { ... }

var durableTaskDataContributorRoleId = '5f6a3c3e-0da3-4079-b4f3-4db62a1d3c09'

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
  name: 'DTS_CONNECTION_STRING'
  value: 'Endpoint=https://${scheduler.name}.durabletask.io;Authentication=ManagedIdentity'
}
{
  name: 'TASKHUB_NAME'
  value: taskHub.name
}
```

## Provision via CLI

```bash
# Create scheduler (consumption SKU for getting started)
az durabletask scheduler create \
    --resource-group myResourceGroup \
    --name my-scheduler \
    --location eastus \
    --sku consumption
```

## Full Deployment Reference

For complete deployment workflows, AZD commands, and managed identity CLI setup, see the [Durable Task Scheduler Deployment](../../../../azure-deploy/references/recipes/azd/durable-task-scheduler-deploy.md) recipe in the azure-deploy skill.
