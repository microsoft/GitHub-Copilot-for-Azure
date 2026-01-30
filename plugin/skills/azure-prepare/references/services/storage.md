# Azure Storage

Storage patterns and best practices for Azure Storage.

## When to Use

- Blob storage (files, images, videos)
- File shares (SMB/NFS)
- Queue storage (simple messaging)
- Table storage (NoSQL key-value)
- Static website hosting

## Bicep Resource Pattern

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}stor${uniqueHash}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'uploads'
  properties: {
    publicAccess: 'None'
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Storage is self-contained |
| Key Vault | Store connection strings |
| Private Endpoint | Secure access (optional) |

## SKU Selection

| SKU | Replication | Use Case |
|-----|-------------|----------|
| Standard_LRS | Local (3 copies) | Dev/test, non-critical |
| Standard_ZRS | Zone-redundant | Production, regional HA |
| Standard_GRS | Geo-redundant | DR requirements |
| Premium_LRS | Premium SSD | High performance |

## Storage Types

### Blob Storage

Best for: Files, images, videos, backups, logs

```bicep
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'documents'
  properties: {
    publicAccess: 'None'
  }
}
```

### Queue Storage

Best for: Simple message queuing, decoupling services

```bicep
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  parent: queueService
  name: 'orders'
}
```

### Table Storage

Best for: Simple NoSQL key-value data

```bicep
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource table 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'logs'
}
```

### File Shares

Best for: Lift-and-shift, shared storage, SMB/NFS access

```bicep
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: 'shared'
  properties: {
    shareQuota: 100  // GB
  }
}
```

## Connection Patterns

### Node.js

```javascript
const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient("uploads");
```

### Python

```python
from azure.storage.blob import BlobServiceClient

blob_service_client = BlobServiceClient.from_connection_string(
    os.environ["AZURE_STORAGE_CONNECTION_STRING"]
)
container_client = blob_service_client.get_container_client("uploads")
```

### .NET

```csharp
var blobServiceClient = new BlobServiceClient(
    Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING")
);
var containerClient = blobServiceClient.GetBlobContainerClient("uploads");
```

## Managed Identity Access

```bicep
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, 'Storage Blob Data Contributor')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string (Key Vault) |
| `AZURE_STORAGE_ACCOUNT` | Account name |
| `AZURE_STORAGE_CONTAINER` | Container name |

## Access Tiers

| Tier | Use Case | Cost |
|------|----------|------|
| Hot | Frequent access | Higher storage, lower access |
| Cool | Infrequent access (30+ days) | Lower storage, higher access |
| Archive | Rare access (180+ days) | Lowest storage, highest access |
