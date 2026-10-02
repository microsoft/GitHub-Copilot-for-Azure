# Blob — read & write (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"

var blobs, _ = azblob.NewClient(os.Getenv("STORAGE_BLOB_URI"), cred, nil)

// Read
r, err := blobs.DownloadStream(ctx, "input", "path/name.json", nil)
if err != nil { return err }
defer r.Body.Close()
// stream r.Body

// Write
_, err = blobs.UploadStream(ctx, "output", "path/name.json", body, nil)
```
