# Core vs Extension Triggers

Most Go worker triggers are **core** — payload arrives as a typed struct in the gRPC invocation message, no external SDK needed, no explicit activation. **Blob** is the only **extension** trigger today.

| Criterion | Core (HTTP, Timer, Queue, CosmosDB, EventGrid, EventHub, ServiceBus, SQL) | Extension (Blob) |
| --- | --- | --- |
| Payload size | Bounded (KB–low MB) | Potentially GBs |
| External SDK | No | Yes (`azblob`, `azidentity`) |
| Data in gRPC message | Yes — typed struct | Metadata only; stream via `client.DownloadStream` |
| Activation | Automatic | Blank import: `_ ".../triggers/blob"` |

**Rule**: prefer core triggers. Use the Blob extension trigger only when you need a live `*blob.Client` for streaming.
