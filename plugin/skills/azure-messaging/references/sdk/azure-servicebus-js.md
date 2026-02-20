# Azure Service Bus SDK — JavaScript

Package: `@azure/service-bus` | [README](https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/servicebus/service-bus/) | [Full Troubleshooting Guide](https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/servicebus/service-bus/TROUBLESHOOTING.md)

## Common Errors

| Error Code | Cause | Fix |
|------------|-------|-----|
| `ServiceTimeout` | Service didn't respond; or no unlocked sessions | Transient — auto-retried. Verify state if persists |
| `MessageLockLost` | Processing exceeded lock duration or link detached | Reduce processing time, ensure autolock renewal works |
| `SessionLockLost` | Session lock expired or link detached | Re-accept session, keep renewing lock |
| `QuotaExceeded` | Too many concurrent receives | Reduce receivers or use batch receives |
| `MessageSizeExceeded` | Message > max size | Reduce payload. Batches must be ≤1MB even on Premium |
| `UnauthorizedAccess` | Bad credentials | Verify connection string, SAS, or RBAC roles |

`ServiceBusError` fields: `code`, `retryable`, `name`, `info`, `address`.

## Enable Logging

```bash
# All SDK logs
export AZURE_LOG_LEVEL=verbose

# Or granular control
export DEBUG=azure*,rhea*

# Errors only
export DEBUG=azure:service-bus:error,azure:core-amqp:error,rhea-promise:error,rhea:events,rhea:frames,rhea:io,rhea:flow
```

Log to file:
```bash
node app.js > out.log 2>debug.log
```

## Key Issues

- **Socket exhaustion**: Treat `ServiceBusClient` as singleton. Each creates a new AMQP connection. Always call `close()`.
- **Lock lost before expiry**: Can happen on link detach (transient network issue or 10-min idle timeout). Not always due to processing time.
- **Batch receive returns fewer messages**: After first message arrives, receiver waits only 1s for additional messages. `maxWaitTimeInMs` controls wait for the *first* message only.
- **Autolock renewal not working**: Ensure system clock is accurate. Autolock relies on system time.
- **Batch >1MB fails**: Even with Premium large message support, batches cannot exceed 1MB. Send large messages individually.
- **WebSockets**: Pass `webSocketOptions` to `ServiceBusClient` constructor for port 443 connectivity.
- **Distributed tracing**: Experimental OpenTelemetry support via `@azure/opentelemetry-instrumentation-azure-sdk`.
