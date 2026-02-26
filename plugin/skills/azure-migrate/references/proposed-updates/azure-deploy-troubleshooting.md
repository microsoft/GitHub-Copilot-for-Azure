# Proposed Update: azure-deploy → references/troubleshooting.md

> **Source**: AWS Lambda face-blur migration to Azure Functions (Flex Consumption)
> **Target**: `~/.agents/skills/azure-deploy/references/troubleshooting.md`
> **Location**: Add before the ".NET Aspire Limited Mode" section

---

## Blob Trigger Never Fires (Flex Consumption + EventGrid Source)

**Symptom:** Function deploys successfully, blobs are uploaded to the source container, but the blob-triggered function never executes. No errors in logs.

**Cause:** On Flex Consumption, trigger groups only start when there's work. But the blob extension needs to be running to register the Event Grid webhook — a bootstrap problem.

**Solution:** Configure `alwaysReady` for the blob trigger group in Bicep:

```bicep
scaleAndConcurrency: {
  alwaysReady: [
    {
      name: 'blob'
      instanceCount: 1
    }
  ]
}
```

Also verify:
1. `AzureWebJobsStorage__queueServiceUri` is set (blob extension requires queue endpoint)
2. Event Grid system topic and event subscription exist
3. Storage Queue Data Contributor RBAC role is assigned

## Event Grid Subscription Creation Fails via CLI

**Symptom:** `az eventgrid system-topic event-subscription create` returns `response code Unknown` or timeout during webhook validation.

**Cause:** CLI-based webhook validation requires a handshake with the function app. On Flex Consumption, the cold start delay causes the validation to time out.

**Solution:** Deploy Event Grid subscriptions via **Bicep/ARM** instead of CLI. ARM handles webhook validation internally:

```bicep
resource eventSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2024-06-01-preview' = {
  parent: systemTopic
  name: 'blob-trigger-sub'
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://${functionApp.properties.defaultHostName}/runtime/webhooks/blobs?functionName=${functionName}&code=${listKeys('${functionApp.id}/host/default', '2023-12-01').systemKeys.blobs_extension}'
      }
    }
    filter: {
      includedEventTypes: [ 'Microsoft.Storage.BlobCreated' ]
      subjectBeginsWith: '/blobServices/default/containers/${containerName}/'
    }
  }
}
```

## QueueServiceClient Constructor Error

**Symptom:** Function fails to index with `Unable to find matching constructor while trying to create an instance of QueueServiceClient. Expected: serviceUri. Found: credential, clientId, blobServiceUri`

**Cause:** Blob trigger with `source: 'EventGrid'` requires a queue endpoint for poison-message tracking, but only the blob endpoint was configured.

**Solution:** Add `AzureWebJobsStorage__queueServiceUri` alongside the blob endpoint:

```bicep
AzureWebJobsStorage__queueServiceUri: storageAccount.properties.primaryEndpoints.queue
```

Also assign **Storage Queue Data Contributor** RBAC role to the managed identity.

## azd init Refuses Non-Empty Directory

**Symptom:** `azd init --template <template>` fails with an error about the directory not being empty.

**Cause:** azd requires a clean directory for template initialization.

**Solution:** Use a temp-directory approach:
1. Create an empty temp directory
2. Run `azd init --template <template>` in the temp directory
3. Copy the IaC files (`infra/`, `azure.yaml`, etc.) into your project root
4. Clean up the temp directory
