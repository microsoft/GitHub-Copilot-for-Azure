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

### SDK Packages

| Language | Blob | Queue | File Share | Data Lake |
|----------|------|-------|------------|-----------|
| .NET | `Azure.Storage.Blobs` | `Azure.Storage.Queues` | `Azure.Storage.Files.Shares` | `Azure.Storage.Files.DataLake` |
| Java | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| JavaScript | `@azure/storage-blob` | `@azure/storage-queue` | `@azure/storage-file-share` | `@azure/storage-file-datalake` |
| Python | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| Go | `azblob` | `azqueue` | `azfile` | `azdatalake` |
| Rust | `azure_storage_blob` | `azure_storage_queue` | - | - |

### JavaScript

```javascript
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

const client = new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    new DefaultAzureCredential()
);
const container = client.getContainerClient("uploads");
const blob = container.getBlobClient("my-file.txt");
const data = await blob.download();
```

### Python

```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

service = BlobServiceClient(
    account_url=f"https://{os.environ['AZURE_STORAGE_ACCOUNT']}.blob.core.windows.net",
    credential=DefaultAzureCredential()
)
container = service.get_container_client("uploads")
blob = container.get_blob_client("my-file.txt")
data = blob.download_blob().readall()
```

### C#

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var client = new BlobServiceClient(
    new Uri($"https://{Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT")}.blob.core.windows.net"),
    new DefaultAzureCredential()
);
var container = client.GetBlobContainerClient("uploads");
var blob = container.GetBlobClient("my-file.txt");
var response = await blob.DownloadAsync();
```

### Java

```java
import com.azure.identity.*;
import com.azure.storage.blob.*;
import com.azure.core.util.BinaryData;

BlobServiceClient client = new BlobServiceClientBuilder()
    .endpoint("https://" + System.getenv("AZURE_STORAGE_ACCOUNT") + ".blob.core.windows.net")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
BlobContainerClient container = client.getBlobContainerClient("uploads");
BlobClient blob = container.getBlobClient("my-file.txt");
BinaryData data = blob.downloadContent();
```

### Go

```go
package main

import (
    "context"
    "io"
    "os"

    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
    "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

func main() {
    cred, _ := azidentity.NewDefaultAzureCredential(nil)
    client, _ := azblob.NewClient(
        "https://"+os.Getenv("AZURE_STORAGE_ACCOUNT")+".blob.core.windows.net",
        cred, nil,
    )
    resp, _ := client.DownloadStream(context.Background(), "uploads", "my-file.txt", nil)
    data, _ := io.ReadAll(resp.Body)
}
```

### Rust

Note: Rust uses `DeveloperToolsCredential` as it doesn't have a `DefaultAzureCredential` equivalent.

```rust
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::{BlobClient, BlobClientOptions};

let credential = DeveloperToolsCredential::new(None)?;
let blob_client = BlobClient::new(
    &format!("https://{}.blob.core.windows.net/", std::env::var("AZURE_STORAGE_ACCOUNT")?),
    "uploads",
    "my-file.txt",
    Some(credential),
    Some(BlobClientOptions::default()),
)?;
let response = blob_client.download(None).await?;
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

## Security Features

| Feature | Description |
|---------|-------------|
| Encryption | Server-side encryption at rest (enabled by default) |
| SAS Tokens | Time-limited, scoped access without sharing keys |
| Private Endpoint | Secure access over private network |

For comprehensive security guidance, see: [security.md](../security.md)
