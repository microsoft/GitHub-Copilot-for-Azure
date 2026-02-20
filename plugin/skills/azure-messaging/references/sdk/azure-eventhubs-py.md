# Azure Event Hubs SDK — Python

Package: `azure-eventhub` | [README](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/eventhub/azure-eventhub) | [Full Troubleshooting Guide](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/eventhub/azure-eventhub/TROUBLESHOOTING.md)

## Common Errors

| Exception | Cause | Fix |
|-----------|-------|-----|
| `EventHubError` | Base exception wrapping AMQP errors | Check `message`, `error`, `details` fields |
| `ConnectionLostError` | Idle connection disconnected | Auto-recovers on next operation; no action needed |
| `AuthenticationError` | Bad credentials or expired SAS | Regenerate key, check RBAC roles, verify connection string |
| `OperationTimeoutError` | Network or throttling | Check firewall, try WebSockets (port 443), increase timeout |

## Retry Configuration

```python
from azure.eventhub import EventHubProducerClient

client = EventHubProducerClient.from_connection_string(
    conn_str,
    retry_total=3,
    retry_backoff_factor=0.8,
    retry_backoff_max=120,
    retry_mode='exponential'
)
```

## Enable Logging

```python
import logging, sys

handler = logging.StreamHandler(stream=sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s | %(threadName)s | %(levelname)s | %(name)s | %(message)s"))
logger = logging.getLogger('azure.eventhub')
logger.setLevel(logging.DEBUG)
logger.addHandler(handler)

# Enable AMQP frame tracing
client = EventHubProducerClient(..., logging_enable=True)
```

## Key Issues

- **Buffered producer not sending**: Ensure enough `ThreadPoolExecutor` workers (one per partition). Use `buffer_concurrency` kwarg.
- **Blocking calls in async**: Run CPU-bound code in an executor; blocking the event loop impacts load balancing and checkpointing.
- **High CPU**: Limit to 1.5–3 partitions per CPU core.
- **Consumer disconnected**: Expected during load balancing. If persistent with no scaling, file an issue.
- **Soft delete on checkpoint store**: Disable "soft delete" and "blob versioning" on the storage account used for checkpointing.
- **Always close clients**: Use `with` statement or call `close()` to avoid socket/connection leaks.
