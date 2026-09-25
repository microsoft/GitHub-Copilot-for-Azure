# Handler Return Values & Retry Semantics — Go

Every non-HTTP trigger handler returns `error`. The value is interpreted by the Functions **host** (not the Go worker), so the retry and poison-message behavior is identical to what the same trigger would do in any other runtime:

- `return nil` → invocation succeeds; the host advances the checkpoint / acknowledges the message / commits change-feed progress as appropriate.
- `return err` (non-nil) → invocation fails. The next action depends on the trigger: its binding extension can retry or dead-letter the event, or a configured function-level retry policy can rerun the failed execution.

| Trigger | Default retry behavior | Poison / dead-letter destination |
|---------|------------------------|-----------------------------------|
| HTTP | No automatic retry — response is returned to the caller | N/A (write status code + body in the handler) |
| Storage Queue | Up to `maxDequeueCount` (default 5) | `<queueName>-poison` queue |
| Service Bus Queue / Topic | Up to `MaxDeliveryCount` (default 10, entity-level) | Entity's dead-letter subqueue |
| Event Grid | Retried by Event Grid (24 h exponential backoff) | Dead-letter destination configured on the subscription |
| Blob (`sdk.WithSource("EventGrid")`) | Retried by Event Grid, same as above | Dead-letter destination on the Event Grid subscription |
| Event Hubs | Configurable function-level retry policy. Checkpoints aren't written until the retry policy for the execution finishes, pausing progress on that partition. | No built-in dead-letter destination |
| Cosmos DB (change feed) | Configurable function-level retry policy reruns a failed execution until success or the maximum retry count is reached. | No built-in dead-letter destination |
| Timer | No retry — next occurrence fires on schedule | N/A |
| SQL (change tracking) | Per `host.json` retry policy | Per configured retry sink |

Configure [function-level retry policies](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-error-pages) for Event Hubs, Cosmos DB, and other supported triggers. Retry policies rerun failed executions; they don't create a poison or dead-letter destination.

**Interaction with panic recovery:** `sdk.RecoverTo` converts a panic in a user-spawned goroutine into a non-nil error on the enclosing handler — which then follows the table above. That's why `sdk.RecoverTo` is the correct choice for "failure should cause a retry"; `sdk.Recover` is for best-effort work where losing the panic (and skipping the retry) is acceptable. See [panic-recovery.md](./panic-recovery.md) for the full pattern.
