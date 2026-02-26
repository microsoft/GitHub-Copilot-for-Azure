# Proposed Update: azure-prepare → references/security.md

> **Source**: AWS Lambda face-blur migration to Azure Functions (Flex Consumption)
> **Target**: `~/.agents/skills/azure-prepare/references/security.md`
> **Location**: Add before the "## Azure Identity SDK" section

---

## Identity-Based Storage Connections (Azure Functions)

When using managed identity for Azure Functions storage connections, always provide **all required service endpoints**. Missing endpoints cause silent indexing failures.

### Required App Settings for Blob Trigger with EventGrid Source

```bicep
AzureWebJobsStorage__blobServiceUri: storageAccount.properties.primaryEndpoints.blob
AzureWebJobsStorage__queueServiceUri: storageAccount.properties.primaryEndpoints.queue  // REQUIRED — blob extension uses queues internally
AzureWebJobsStorage__credential: 'managedidentity'
AzureWebJobsStorage__clientId: managedIdentityClientId
```

> **⚠️ Common pitfall**: Omitting `queueServiceUri` causes `Unable to find matching constructor...QueueServiceClient` at function indexing time. The blob extension requires the queue endpoint even when you're not using queue triggers.

### Disable Local Auth for All Services

For enterprise compliance, disable API key / shared key access on all services:

| Service | Setting |
|---------|--------|
| Storage Account | `allowSharedKeyAccess: false` |
| Cognitive Services | `disableLocalAuth: true` |

### UAMI with DefaultAzureCredential

When using **User Assigned Managed Identity** (UAMI), `DefaultAzureCredential()` without arguments tries System Assigned first and fails. Always pass the client ID:

```javascript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID
});
```

Add `AZURE_CLIENT_ID` as an app setting in Bicep pointing to the UAMI client ID.

### Required RBAC Roles for Blob + EventGrid Pattern

| Role | Scope | Purpose |
|------|-------|---------|
| Storage Blob Data Owner | Storage Account | Read/write blobs |
| Storage Queue Data Contributor | Storage Account | Poison-message queue for blob extension |
| EventGrid EventSubscription Contributor | Resource Group | Create/manage Event Grid subscriptions |
| Monitoring Metrics Publisher | Application Insights | Emit telemetry |
