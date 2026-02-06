# Azure Storage SDK Usage

SDK packages and quick start examples for Azure Storage services.

## Storage SDKs by Language

| Language | Blob | Queue | File Share | Data Lake |
|----------|------|-------|------------|----------|
| .NET | `Azure.Storage.Blobs` | `Azure.Storage.Queues` | `Azure.Storage.Files.Shares` | `Azure.Storage.Files.DataLake` |
| Java | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| JavaScript | `@azure/storage-blob` | `@azure/storage-queue` | `@azure/storage-file-share` | `@azure/storage-file-datalake` |
| Python | `azure-storage-blob` | `azure-storage-queue` | `azure-storage-file-share` | `azure-storage-file-datalake` |
| Go | `azblob` | `azqueue` | `azfile` | `azdatalake` |
| Rust | `azure_storage_blob` | `azure_storage_queue` | - | - |

## Installation Commands

| Language | Install Blob SDK + Identity |
|----------|-----------------------------|
| .NET | `dotnet add package Azure.Storage.Blobs` `dotnet add package Azure.Identity` |
| Java | Maven: `com.azure:azure-storage-blob` `com.azure:azure-identity` |
| JavaScript | `npm install @azure/storage-blob @azure/identity` |
| Python | `pip install azure-storage-blob azure-identity` |
| Go | `go get github.com/Azure/azure-sdk-for-go/sdk/storage/azblob github.com/Azure/azure-sdk-for-go/sdk/azidentity` |
| Rust | `cargo add azure_storage_blob azure_identity` |

## Quick Start Examples

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
using Azure.Identity;
using Azure.Storage.Blobs;

var client = new BlobServiceClient(new Uri("https://ACCOUNT.blob.core.windows.net/"), new DefaultAzureCredential());
var container = client.GetBlobContainerClient("my-container");
var blob = container.GetBlobClient("my-blob.txt");
var response = await blob.DownloadAsync();
```

**Java** - Blob Storage:
```java
import com.azure.identity.*;
import com.azure.storage.blob.*;
import com.azure.core.util.BinaryData;

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
