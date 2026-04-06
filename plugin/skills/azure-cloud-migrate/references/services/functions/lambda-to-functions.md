# AWS Lambda to Azure Functions Migration

Detailed guidance for migrating AWS Lambda functions to Azure Functions.

## Overview

| AWS Service | Azure Equivalent |
|-------------|------------------|
| Lambda | Azure Functions |
| API Gateway | Azure Functions HTTP Trigger / API Management |
| S3 | Azure Blob Storage |
| S3 Event | Azure Blob Storage + Event Grid |
| DynamoDB | Cosmos DB |
| SQS | Azure Service Bus / Storage Queue |
| SNS | Azure Event Grid |
| EventBridge | Azure Event Grid |
| CloudWatch | Application Insights / Azure Monitor |
| IAM Roles | Managed Identity + Azure RBAC |
| CloudFormation / SAM | Bicep / ARM Templates |
| Rekognition | Azure AI Computer Vision (Image Analysis) |

## Programming Model Mapping

| AWS Lambda | Azure Functions |
|------------|-----------------|
| `exports.handler` | `app.http()`, `app.storageBlob()`, etc. (v4) |
| `event` object | `request` / `blob` / trigger-specific param |
| `context` object | `context` (InvocationContext) |
| `callback` | Return value |
| `function.json` (v1-v3) | Inline bindings in code (v4 JS, v2 Python) |

## Trigger Mapping

| AWS Trigger | Azure Trigger | Notes |
|-------------|---------------|-------|
| API Gateway (REST/HTTP) | `app.http()` | Direct equivalent |
| S3 Event | `app.storageBlob()` | Use `source: 'EventGrid'` for reliability |
| SQS | `app.storageQueue()` or `app.serviceBusQueue()` | Service Bus for advanced scenarios |
| SNS | `app.eventGrid()` | Event Grid is push-based |
| EventBridge | `app.eventGrid()` | Map event patterns to filters |
| CloudWatch Events (Scheduled) | `app.timer()` | NCRONTAB expressions |
| DynamoDB Streams | Cosmos DB Change Feed trigger | Via `app.cosmosDB()` |

## Runtime-Specific Migration Patterns

For language-specific migration rules, correct/incorrect patterns, and code examples, see the runtime reference for the target language:

| Runtime | Migration Patterns |
|---------|-------------------|
| JavaScript (Node.js v4) | [runtimes/javascript.md — Lambda Migration Rules](runtimes/javascript.md#lambda-migration-rules) |
| Python (v2) | [runtimes/python.md — Lambda Migration Rules](runtimes/python.md#lambda-migration-rules) |
| TypeScript (v4) | [runtimes/typescript.md](runtimes/typescript.md) |
| C# (Isolated Worker) | [runtimes/csharp.md](runtimes/csharp.md) |
| Java | [runtimes/java.md](runtimes/java.md) |
| PowerShell | [runtimes/powershell.md](runtimes/powershell.md) |

## Project Structure

**Required:** `src/app.js` (main entry), `host.json`, `local.settings.json`, `package.json`
**Never:** Individual function directories or `function.json` files (v4 JS, v2 Python)

## Environment Variables

**Use:** `AzureWebJobsStorage__blobServiceUri`, `AzureWebJobsStorage__queueServiceUri` with `__credential: 'managedidentity'`
**Avoid:** Connection strings and API keys

## Reference Links

- [AWS Lambda vs Azure Functions comparison](https://aka.ms/AWSLambda)
- [AWS to Azure services comparison](https://learn.microsoft.com/en-us/azure/architecture/aws-professional/)
- [Supported language runtimes](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages)
- [Triggers and bindings overview](https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings)
- [Functions quickstart JS (azd)](https://github.com/Azure-Samples/functions-quickstart-javascript-azd/tree/main/infra)
- [Functions quickstart .NET Event Grid (azd)](https://github.com/Azure-Samples/functions-quickstart-dotnet-azd-eventgrid-blob/tree/main/infra)

## Flex Consumption + Blob Trigger with EventGrid Source

**Critical requirements:**

### 1. Always-Ready Instances

Configure `alwaysReady` for blob trigger group to solve bootstrap problem:

```bicep
scaleAndConcurrency: {
  alwaysReady: [{ name: 'blob', instanceCount: 1 }]
}
```

### 2. Queue Endpoint Required

Blob extension uses queues for poison-message tracking. Enable queue endpoint and assign **Storage Queue Data Contributor** role:

```bicep
AzureWebJobsStorage__queueServiceUri: storageAccount.properties.primaryEndpoints.queue
```

### 3. Event Grid Subscription via Bicep

Deploy Event Grid subscription as Bicep (CLI webhook validation fails on Flex). Assign **EventGrid EventSubscription Contributor** role:

```bicep
resource systemTopic 'Microsoft.EventGrid/systemTopics@2024-06-01-preview' = {
  name: 'evgt-${storageAccountName}'
  location: location
  properties: {
    source: storageAccount.id
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

resource eventSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2024-06-01-preview' = {
  parent: systemTopic
  name: 'blob-trigger-sub'
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://${functionApp.properties.defaultHostName}/runtime/webhooks/blobs?functionName=${functionName}&code=${listKeys...}'
      }
    }
    filter: {
      includedEventTypes: [ 'Microsoft.Storage.BlobCreated' ]
      subjectBeginsWith: '/blobServices/default/containers/${sourceContainerName}/'
    }
  }
}
```

## User Assigned Managed Identity (UAMI) Auth Patterns

### DefaultAzureCredential with UAMI

When using UAMI, `DefaultAzureCredential()` without arguments tries SystemAssigned first and fails. Always pass the client ID:

```javascript
const { DefaultAzureCredential } = require('@azure/identity');

const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID
});
```

Add `AZURE_CLIENT_ID` as an app setting pointing to the UAMI client ID:

```bicep
appSettings: {
  AZURE_CLIENT_ID: managedIdentity.outputs.clientId
}
```

### Identity-Linked Storage Connection

```bicep
AzureWebJobsStorage__credential: 'managedidentity'
AzureWebJobsStorage__clientId: managedIdentityClientId
AzureWebJobsStorage__blobServiceUri: storageAccount.properties.primaryEndpoints.blob
AzureWebJobsStorage__queueServiceUri: storageAccount.properties.primaryEndpoints.queue
```

### Required RBAC Roles for Face Blur Pattern

| Role | Scope | Purpose |
|------|-------|---------|
| Storage Blob Data Owner | Storage Account | Read source blobs, write destination blobs |
| Storage Queue Data Contributor | Storage Account | Poison-message queue for blob extension |
| EventGrid EventSubscription Contributor | Resource Group | Create/manage Event Grid subscriptions |
| Cognitive Services User | Cognitive Services Account | Call Computer Vision API |
| Monitoring Metrics Publisher | Application Insights | Emit telemetry |

## AWS Rekognition → Azure AI Computer Vision

| AWS | Azure |
|-----|-------|
| `@aws-sdk/client-rekognition` | `@azure-rest/ai-vision-image-analysis` |
| `DetectFaces` | Image Analysis `People` feature |
| `FaceDetails[].BoundingBox` (relative 0-1) | `peopleResult.values[].boundingBox` (pixel coordinates) |

> **⚠️ Package version**: `@azure-rest/ai-vision-image-analysis` is still in beta. The `^1.0.0` semver does NOT resolve. Pin explicitly: `"@azure-rest/ai-vision-image-analysis": "1.0.0-beta.3"`

### Coordinate Conversion

AWS Rekognition returns relative coordinates (0-1). Azure AI returns pixel coordinates. Convert for consistent face processing:

```javascript
const sharp = require('sharp');
const metadata = await sharp(imageBuffer).metadata();

const faces = result.body.peopleResult.values.map(person => ({
  BoundingBox: {
    Width: person.boundingBox.width / metadata.width,
    Height: person.boundingBox.height / metadata.height,
    Left: person.boundingBox.x / metadata.width,
    Top: person.boundingBox.y / metadata.height
  }
}));
```

### Auth: Use UAMI (No API Keys)

```bicep
// computerVision.bicep
resource computerVision 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  kind: 'ComputerVision'
  properties: {
    disableLocalAuth: true  // Enterprise policy compliance — no API keys
  }
}
```
