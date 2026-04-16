# Blob Storage with Event Grid Recipe

Blob trigger via Event Grid for high-scale, low-latency blob processing.

## Template Selection

Resource filter: `blob`  
Discover templates via MCP or CDN manifest where `resource == "blob"` and `language` matches user request.

## Why Event Grid?

| Aspect | Polling Trigger | Event Grid Source |
|--------|-----------------|-------------------|
| **Latency** | 10s-60s | Sub-second |
| **Scale** | Limited | High-scale |

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
