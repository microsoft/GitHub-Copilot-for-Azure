# Azure Event Hubs SDK — Java

Package: `azure-messaging-eventhubs` | [README](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs/) | [Full Troubleshooting Guide](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs/TROUBLESHOOTING.md)

> ⚠️ **Note:** The detailed Java troubleshooting guide has moved to [Microsoft Learn](https://learn.microsoft.com/azure/developer/java/sdk/troubleshooting-messaging-event-hubs-overview).

## Common Errors

| Exception | Cause | Fix |
|-----------|-------|-----|
| `AmqpException` (connection:forced) | Idle connection disconnected | Auto-recovers; no action needed |
| `AmqpException` (unauthorized-access) | Bad credentials or missing permissions | Verify connection string, SAS, or RBAC roles |
| `AmqpException` (resource-limit-exceeded) | Too many concurrent receivers | Reduce receiver count or upgrade tier |
| `OperationTimeoutException` | Network issue or throttling | Check firewall, try AMQP over WebSockets |

## Enable Logging

Configure via SLF4J. Add `logback-classic` dependency and set level for `com.azure.messaging.eventhubs`:

```xml
<logger name="com.azure.messaging.eventhubs" level="DEBUG"/>
```

For AMQP frame tracing:
```xml
<logger name="com.azure.core.amqp" level="DEBUG"/>
```

See [Java SDK logging docs](https://learn.microsoft.com/azure/developer/java/sdk/troubleshooting-messaging-event-hubs-overview) for details.

## Key Issues

- **High CPU / partition imbalance**: Limit to 1.5–3 partitions per CPU core.
- **Consumer disconnected during epoch conflict**: Expected during load balancing. Persistent issues without scaling indicate a problem.
- **Connection sharing**: Reuse `EventHubClientBuilder` connections; avoid creating new clients per operation.

## Filing Issues

Include: partition count, machine specs, instance count, max heap (`-Xmx`), average `EventData` size, traffic pattern, and DEBUG-level logs (±10 min from issue).
