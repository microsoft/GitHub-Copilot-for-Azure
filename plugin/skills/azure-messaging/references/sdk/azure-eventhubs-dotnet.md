# Azure Event Hubs SDK — .NET (C#)

Package: `Azure.Messaging.EventHubs` | [README](https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/eventhub/Azure.Messaging.EventHubs/) | [Full Troubleshooting Guide](https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/eventhub/Azure.Messaging.EventHubs/TROUBLESHOOTING.md)

## Common Errors

| Exception | Reason | Fix |
|-----------|--------|-----|
| `EventHubsException` (ServiceTimeout) | Service didn't respond in time | Transient — retried automatically. Verify state if persists |
| `EventHubsException` (QuotaExceeded) | Too many active readers per consumer group | Reduce concurrent receivers or upgrade tier |
| `EventHubsException` (ConsumerDisconnected) | Higher-epoch consumer took ownership | Expected during load balancing; check if scaling |
| `EventHubsException` (MessageSizeExceeded) | Event or batch too large | Reduce batch size or event payload |
| `UnauthorizedAccessException` | Bad credentials | Verify connection string, SAS token, or RBAC roles |

## Exception Filtering

```csharp
try { /* receive events */ }
catch (EventHubsException ex) when (ex.Reason == EventHubsException.FailureReason.ConsumerDisconnected)
{
    // Handle consumer disconnection
}
```

## Retry Configuration

Configure via `EventHubsRetryOptions` when creating the client. See [Configuring retry thresholds sample](https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/eventhub/Azure.Messaging.EventHubs/samples).

## Key Issues

- **Socket exhaustion**: Treat clients as singletons. Share `EventHubConnection` across clients if needed. Always call `CloseAsync`/`DisposeAsync`.
- **HTTP 412/409 from storage**: Normal during checkpoint store operations — not an error.
- **Partitions closing frequently**: Expected when scaling. If persists >5 min without scaling, investigate.
- **High CPU**: Limit to 1.5–3 partitions per CPU core.
- **Azure Functions**: After upgrading to v5.0+ extensions, update binding types. Reduce logging noise by filtering `Azure.Messaging.EventHubs` to Warning.
- **WebSockets**: Use `EventHubsTransportType.AmqpWebSockets` to connect over port 443 when AMQP ports are blocked.
