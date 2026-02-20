# Azure Service Bus SDK — .NET (C#)

Package: `Azure.Messaging.ServiceBus` | [README](https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/servicebus/Azure.Messaging.ServiceBus/) | [Full Troubleshooting Guide](https://github.com/Azure/azure-sdk-for-net/blob/main/sdk/servicebus/Azure.Messaging.ServiceBus/TROUBLESHOOTING.md)

## Common Errors

| Exception | Reason | Fix |
|-----------|--------|-----|
| `ServiceBusException` (ServiceTimeout) | Service didn't respond | Transient — auto-retried. For session accept, means no unlocked sessions |
| `ServiceBusException` (MessageLockLost) | Lock expired or link detached | Renew lock, reduce processing time, check network |
| `ServiceBusException` (SessionLockLost) | Session lock expired | Re-accept session, renew lock before expiry |
| `ServiceBusException` (QuotaExceeded) | Too many concurrent receives | Reduce receivers or use batch receives |
| `ServiceBusException` (MessageSizeExceeded) | Message too large | Reduce payload. Premium supports large messages |
| `ServiceBusException` (ServiceBusy) | Request throttled | Auto-retried with 10s backoff. See [throttling docs](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-throttling) |
| `UnauthorizedAccessException` | Bad credentials | Verify connection string, SAS, or RBAC roles |

## Exception Filtering

```csharp
try { /* receive messages */ }
catch (ServiceBusException ex) when (ex.Reason == ServiceBusFailureReason.ServiceTimeout)
{
    // Handle timeout
}
```

## Key Issues

- **Socket exhaustion**: Treat `ServiceBusClient` as singleton. Each creates a new AMQP connection. Always call `CloseAsync`/`DisposeAsync`.
- **Lock lost before expiry**: Can happen on link detach (transient network) or 10-min idle timeout.
- **Processor high concurrency**: May cause hangs with extreme concurrency settings. Test with moderate values.
- **Session processor slow switching**: Tune `SessionIdleTimeout` to reduce wait time between sessions.
- **Batch >1MB fails**: Even with Premium large message support, batches cannot exceed 1MB. Send large messages individually.
- **Transactions across entities**: Requires all entities on same namespace. Use `ServiceBusClient.CreateSender` with `via` entity support.
- **WebSockets**: Use `ServiceBusTransportType.AmqpWebSockets` when AMQP ports are blocked.
