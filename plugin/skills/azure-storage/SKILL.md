---
name: azure-storage
description: Azure Storage Services including Blob Storage, File Shares, Queue Storage, Table Storage, and Data Lake. Provides object storage, SMB file shares, async messaging, NoSQL key-value, and big data analytics capabilities.
---

# Azure Storage Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Blob Storage | Objects, files, backups, static content | `azure__storage` | `az storage blob` |
| File Shares | SMB file shares, lift-and-shift | - | `az storage file` |
| Queue Storage | Async messaging, task queues | - | `az storage queue` |
| Table Storage | NoSQL key-value (consider Cosmos DB) | - | `az storage table` |
| Data Lake | Big data analytics, hierarchical namespace | - | `az storage fs` |

## MCP Server (Preferred)

When Azure MCP is enabled:

- `azure__storage` with command `storage_account_list` - List storage accounts
- `azure__storage` with command `storage_container_list` - List containers in account
- `azure__storage` with command `storage_blob_list` - List blobs in container
- `azure__storage` with command `storage_blob_get` - Download blob content
- `azure__storage` with command `storage_blob_put` - Upload blob content

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.
## CLI Fallback

```bash
# List storage accounts
az storage account list --output table

# List containers
az storage container list --account-name ACCOUNT --output table

# List blobs
az storage blob list --account-name ACCOUNT --container-name CONTAINER --output table

# Download blob
az storage blob download --account-name ACCOUNT --container-name CONTAINER --name BLOB --file LOCAL_PATH

# Upload blob
az storage blob upload --account-name ACCOUNT --container-name CONTAINER --name BLOB --file LOCAL_PATH
```

## Storage Account Tiers

| Tier | Use Case | Performance |
|------|----------|-------------|
| Standard | General purpose, backup | Milliseconds |
| Premium | Databases, high IOPS | Sub-millisecond |

## Blob Access Tiers

| Tier | Access Frequency | Cost |
|------|-----------------|------|
| Hot | Frequent | Higher storage, lower access |
| Cool | Infrequent (30+ days) | Lower storage, higher access |
| Cold | Rare (90+ days) | Lower still |
| Archive | Rarely (180+ days) | Lowest storage, rehydration required |

## Redundancy Options

| Type | Durability | Use Case |
|------|------------|----------|
| LRS | 11 nines | Dev/test, recreatable data |
| ZRS | 12 nines | Regional high availability |
| GRS | 16 nines | Disaster recovery |
| GZRS | 16 nines | Best durability |

## Service Details

For deep documentation on specific services:

- Blob storage patterns and lifecycle -> [Blob Storage documentation](https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview)
- File shares and Azure File Sync -> [Azure Files documentation](https://learn.microsoft.com/azure/storage/files/storage-files-introduction)
- Queue patterns and poison handling -> [Queue Storage documentation](https://learn.microsoft.com/azure/storage/queues/storage-queues-introduction)

## Azure SDKs

### Storage SDKs by Language

| Language | Blob | Queue | File Share | Data Lake |
|----------|------|-------|------------|----------|
| .NET | `Azure.Storage.Blobs` | `Azure.Storage.Queues` | `Azure.Storage.Files.Shares` | `Azure.Storage.Files.DataLake` |
| Java | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| JavaScript | `@azure/storage-blob` | `@azure/storage-queue` | `@azure/storage-file-share` | `@azure/storage-file-datalake` |
| Python | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| Go | `azblob` | `azqueue` | `azfile` | `azdatalake` |
| Rust | `azure_storage_blob` | `azure_storage_queue` | - | - |

### Installation Commands

| Language | Install Blob SDK |
|----------|------------------|
| .NET | `dotnet add package Azure.Storage.Blobs` |
| Java | Maven: `com.azure:azure-storage-blob` |
| JavaScript | `npm install @azure/storage-blob` |
| Python | `pip install azure-storage-blob` |
| Go | `go get github.com/Azure/azure-sdk-for-go/sdk/storage/azblob` |
| Rust | `cargo add azure_storage_blob` |

### Quick Start Examples

All examples use `DefaultAzureCredential` for authentication. Rust uses `DeveloperToolsCredential` as it doesn't have a `DefaultAzureCredential` equivalent.

**Python** - Blob Storage:
```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

service = BlobServiceClient(account_url="https://ACCOUNT.blob.core.windows.net/", credential=DefaultAzureCredential())
container = service.get_container_client("my-container")
blob = container.get_blob_client("my-blob.txt")
data = blob.download_blob().readall()
```

**JavaScript** - Blob Storage:
```javascript
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

const client = new BlobServiceClient("https://ACCOUNT.blob.core.windows.net/", new DefaultAzureCredential());
const container = client.getContainerClient("my-container");
const blob = container.getBlobClient("my-blob.txt");
const data = await blob.download();
```

**C#** - Blob Storage:
```csharp
var client = new BlobServiceClient(new Uri("https://ACCOUNT.blob.core.windows.net/"), new DefaultAzureCredential());
var container = client.GetBlobContainerClient("my-container");
var blob = container.GetBlobClient("my-blob.txt");
var response = await blob.DownloadAsync();
```

**Java** - Blob Storage:
```java
BlobServiceClient client = new BlobServiceClientBuilder()
    .endpoint("https://ACCOUNT.blob.core.windows.net/")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
BlobContainerClient container = client.getBlobContainerClient("my-container");
BlobClient blob = container.getBlobClient("my-blob.txt");
BinaryData data = blob.downloadContent();
```

**Go** - Blob Storage:
```go
package main

import (
    "context"
    "io"

    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
    "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

func main() {
    cred, _ := azidentity.NewDefaultAzureCredential(nil)
    client, _ := azblob.NewClient("https://ACCOUNT.blob.core.windows.net/", cred, nil)

    resp, _ := client.DownloadStream(context.Background(), "my-container", "my-blob.txt", nil)
    data, _ := io.ReadAll(resp.Body)
    _ = data // Use data as needed
}
```

**Rust** - Blob Storage:
```rust
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::{BlobClient, BlobClientOptions};

let credential = DeveloperToolsCredential::new(None)?;
let blob_client = BlobClient::new(
    "https://ACCOUNT.blob.core.windows.net/",
    "my-container",
    "my-blob.txt",
    Some(credential),
    Some(BlobClientOptions::default()),
)?;
let response = blob_client.download(None).await?;
let (_, _, body) = response.deconstruct();
let data = body.collect().await?.to_vec();
```
