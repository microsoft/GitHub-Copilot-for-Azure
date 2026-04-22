# Container Apps Job Template — REFERENCE ONLY

Scheduled, event-triggered, and manual jobs on Azure Container Apps.

## When to Use

- Scheduled tasks (cron-based)
- Event-driven batch processing
- One-shot manual execution
- ETL pipelines, data imports, cleanup tasks

## Job Types

| Type | Trigger | Example |
|------|---------|---------|
| **Scheduled** | Cron expression | Nightly data sync, hourly report |
| **Event** | KEDA scaler (queue, event hub) | Process uploads, handle messages |
| **Manual** | API call / CLI | Ad-hoc migration, one-time import |

## Project Structure

```
project-root/
├── azure.yaml
├── Dockerfile
├── src/
│   └── (job code)
└── infra/
    ├── main.bicep
    └── app/
        └── job.bicep
```

## azure.yaml

```yaml
name: my-job
metadata:
  template: container-apps-job
services:
  job:
    host: containerapp
    project: .
```

## Bicep — Scheduled Job

```bicep
param name string
param location string = resourceGroup().location
param tags object = {}
param envId string
param containerRegistryName string
param imageName string
param userAssignedIdentityId string
param cronExpression string = '0 0 * * *'

resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'job' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    environmentId: envId
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      scheduleTriggerConfig: {
        cronExpression: cronExpression
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: userAssignedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'job'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
    }
  }
}

output name string = job.name
```

## Bicep — Event-Triggered Job

```bicep
resource eventJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${name}-event'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    environmentId: envId
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 600
      replicaRetryLimit: 2
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: userAssignedIdentityId
        }
      ]
      eventTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
        scale: {
          minExecutions: 0
          maxExecutions: 10
          rules: [
            {
              name: 'queue-trigger'
              type: 'azure-servicebus'
              metadata: {
                namespace: '<sb-namespace>'
                queueName: '<queue>'
                messageCount: '1'
              }
            }
          ]
        }
      }
    }
    template: {
      containers: [
        {
          name: 'job'
          image: imageName
          resources: { cpu: json('1'), memory: '2Gi' }
        }
      ]
    }
  }
}
```

## Bicep — Manual Job

```bicep
configuration: {
  triggerType: 'Manual'
  replicaTimeout: 3600
  replicaRetryLimit: 0
}
```

Start manually:

```bash
az containerapp job start -n <job-name> -g <resource-group>
```

## Common Cron Expressions

| Schedule | Expression |
|----------|-----------|
| Every hour | `0 * * * *` |
| Daily at midnight UTC | `0 0 * * *` |
| Every 15 minutes | `*/15 * * * *` |
| Weekdays at 9 AM UTC | `0 9 * * 1-5` |
| First day of month | `0 0 1 * *` |

## Key Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `replicaTimeout` | Max seconds per execution | 1800 |
| `replicaRetryLimit` | Retry count on failure | 1 |
| `parallelism` | Concurrent replicas | 1 |
| `replicaCompletionCount` | Required successful replicas | 1 |

> ⚠️ **Jobs exit after completion.** Ensure your container exits with code 0 on success
> and non-zero on failure. Container Apps tracks execution history.
