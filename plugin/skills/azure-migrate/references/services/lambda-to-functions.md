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

## JavaScript v4 Programming Model

### Rules

- Import SDK: `const { app, input, output } = require('@azure/functions')`
- Define functions via `app.*()` methods
- Bindings configured inline — **NO** `function.json` files
- **Always use bindings (`input.storageBlob`, `output.storageBlob`, `app.storageQueue`, etc.) instead of SDK clients** (`BlobServiceClient`, `QueueClient`). Only use SDK for services that have no binding equivalent (e.g., Azure AI Face API)
- When a function needs to read or write blobs dynamically, use `extraInputs` / `extraOutputs` with binding path expressions like `{queueTrigger}` instead of creating `BlobServiceClient` manually
- Use `context.triggerMetadata` for metadata access
- Package.json must include `"@azure/functions": "^4.0.0"`
- Host.json must use extension bundle `[4.*, 5.0.0)`
- **Always use the latest supported Node.js version** (currently Node.js 22). Check [supported languages](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages) for the latest

### Correct Pattern

```javascript
const { app, input, output } = require('@azure/functions');

// Use bindings for blob I/O instead of BlobServiceClient SDK
const blobInput = input.storageBlob({
  path: 'source-container/{queueTrigger}',
  connection: 'AzureWebJobsStorage'
});

const blobOutput = output.storageBlob({
  path: 'destination-container/{queueTrigger}',
  connection: 'AzureWebJobsStorage'
});

app.storageQueue('processImage', {
  queueName: 'image-processing',
  connection: 'AzureWebJobsStorage',
  extraInputs: [blobInput],
  extraOutputs: [blobOutput],
  handler: async (queueItem, context) => {
    const sourceBlob = context.extraInputs.get(blobInput);
    context.log(`Processing blob: ${queueItem}`);
    // Process the blob...
    context.extraOutputs.set(blobOutput, processedBuffer);
  }
});
```

> 💡 Blob trigger alternative (use `source: 'EventGrid'` for reliability):
```javascript
app.storageBlob('processImage', {
  path: 'source-container/{name}',
  connection: 'AzureWebJobsStorage',
  source: 'EventGrid',
  handler: async (blob, context) => {
    context.log(`Processing blob: ${context.triggerMetadata.name}`);
    // Function logic here
  }
});
```

### Incorrect Pattern (Do NOT Use)

```javascript
// ❌ Legacy v1-v3 model
module.exports = async function (context, myBlob) {
  context.log("Processing blob");
};
```

## Python v2 Programming Model

### Rules

- Use decorators: `@app.blob_trigger()`, `@app.route()`, etc.
- **NO** `function.json` files
- Use `function_app.py` as the entry point

### Correct Pattern

```python
import azure.functions as func

app = func.FunctionApp()

@app.blob_trigger(arg_name="myblob", path="source/{name}",
                  connection="AzureWebJobsStorage",
                  source="EventGrid")
def process_image(myblob: func.InputStream):
    logging.info(f"Processing blob: {myblob.name}")
```

## Project Structure

```
REQUIRED for Azure Functions:
src/
├── app.js (or function_app.py)   # Main entry point
├── host.json                      # Function host configuration
├── local.settings.json            # Local development settings
├── package.json (or requirements.txt)
├── [helper-modules]               # Business logic
└── tests/                         # Test files

❌ NEVER create:
├── [functionName]/                # No individual function directories
│   ├── function.json              # No function.json (JS v4, Python v2)
│   └── index.js
```

## Environment Variables

```
✅ Use managed identity connections:
   AzureWebJobsStorage__accountName

✅ Use specific endpoint variables:
   COMPUTER_VISION_ENDPOINT
   STORAGE_ACCOUNT_URL
   SOURCE_CONTAINER_NAME

❌ Avoid:
   CONNECTION_STRING (use managed identity)
   API_KEY (use managed identity)
```

## Runtime-Specific Trigger & Binding References

Each file below contains all supported trigger and binding code patterns for the target language:

| Runtime | Reference |
|---------|----------|
| JavaScript (Node.js v4) | [runtimes/javascript.md](../runtimes/javascript.md) |
| TypeScript (v4) | [runtimes/typescript.md](../runtimes/typescript.md) |
| Python (v2) | [runtimes/python.md](../runtimes/python.md) |
| C# (Isolated Worker) | [runtimes/csharp.md](../runtimes/csharp.md) |
| Java | [runtimes/java.md](../runtimes/java.md) |
| PowerShell | [runtimes/powershell.md](../runtimes/powershell.md) |

## Reference Links

- [AWS Lambda vs Azure Functions comparison](https://aka.ms/AWSLambda)
- [AWS to Azure services comparison](https://learn.microsoft.com/en-us/azure/architecture/aws-professional/)
- [Supported language runtimes](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages)
- [Triggers and bindings overview](https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings)
- [Functions quickstart JS (azd)](https://github.com/Azure-Samples/functions-quickstart-javascript-azd/tree/main/infra)
- [Functions quickstart .NET Event Grid (azd)](https://github.com/Azure-Samples/functions-quickstart-dotnet-azd-eventgrid-blob/tree/main/infra)

## Flex Consumption + Blob Trigger with EventGrid Source

> **⚠️ CRITICAL**: When deploying blob triggers with `source: 'EventGrid'` on Flex Consumption, there are three infrastructure requirements that are NOT automatically handled and will cause silent trigger failures if missed.

### 1. Always-Ready Instances (Bootstrap Problem)

On Flex Consumption, trigger groups only start when there's work to do. But the blob extension needs to be running to create the Event Grid subscription that would deliver work — a chicken-and-egg problem.

**Solution**: Configure `alwaysReady` for the blob trigger group in the function app's `scaleAndConcurrency`:

```bicep
// In api.bicep — functionAppConfig section
scaleAndConcurrency: {
  alwaysReady: [
    {
      name: 'blob'
      instanceCount: 1
    }
  ]
  instanceMemoryMB: 2048
  maximumInstanceCount: 100
}
```

Without this, the trigger group never starts → Event Grid subscription never gets created → no events are delivered → function never triggers.

### 2. Queue Endpoint Required

The blob extension internally uses Storage Queues for poison-message tracking when `source: 'EventGrid'` is configured. Without the queue endpoint, the function fails to index with:

```
Unable to find matching constructor while trying to create an instance of QueueServiceClient.
Expected: serviceUri. Found: credential, clientId, blobServiceUri
```

**Solution**: Always enable the queue endpoint alongside blob when using EventGrid source:

```bicep
// In identity-based storage configuration
AzureWebJobsStorage__blobServiceUri: storageAccount.properties.primaryEndpoints.blob
AzureWebJobsStorage__queueServiceUri: storageAccount.properties.primaryEndpoints.queue  // REQUIRED for EventGrid source
AzureWebJobsStorage__credential: 'managedidentity'
AzureWebJobsStorage__clientId: managedIdentityClientId
```

Also assign **Storage Queue Data Contributor** RBAC role to the UAMI.

### 3. Event Grid Subscription via Bicep (Not CLI)

Do **NOT** create Event Grid event subscriptions via CLI. The `az eventgrid system-topic event-subscription create` command requires a webhook validation handshake that consistently fails on Flex Consumption with "response code Unknown" (timeout during cold start).

**Solution**: Deploy the Event Grid system topic and event subscription as Bicep resources. ARM handles the webhook validation internally and reliably:

```bicep
// eventGrid.bicep
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
        // ARM resolves system key and handles validation at deployment time
        endpointUrl: 'https://${functionApp.properties.defaultHostName}/runtime/webhooks/blobs?functionName=${functionName}&code=${listKeys('${functionApp.id}/host/default', '2023-12-01').systemKeys.blobs_extension}'
      }
    }
    filter: {
      includedEventTypes: [ 'Microsoft.Storage.BlobCreated' ]
      subjectBeginsWith: '/blobServices/default/containers/${sourceContainerName}/'
    }
  }
}
```

**RBAC requirement**: Assign **EventGrid EventSubscription Contributor** role to the UAMI.

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
