# Trigger & Binding Troubleshooting

Diagnostics for HTTP, Timer, Queue, Blob, Service Bus, Cosmos DB, and Flex Consumption.

## HTTP Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on known route | Route template mismatch or function not indexed | Check `route` in `function.json`/attribute; confirm the function loaded via `az functionapp function list` |
| 500 on every request | Unhandled exception in the function | Query `exceptions` in App Insights for the stack trace |
| 408 / timeout | Execution timeout or gateway idle timeout | `functionTimeout` controls execution, but HTTP responses still have a 230-second platform limit. For long work, return 202 with a status endpoint or use Durable HTTP APIs |
| 401/403 unexpected | Function-level auth key mismatch, or Easy Auth intercepting the route | Verify `authLevel`; check `az webapp auth show` if App Service Authentication is enabled |

```kusto
requests
| where toint(resultCode) >= 400
| order by timestamp desc
| take 50
```

## Timer Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timer never fires | Invalid NCRONTAB expression | Validate the schedule with an NCRONTAB parser; check `TZ`/`WEBSITE_TIME_ZONE` if the schedule assumes a non-UTC zone |
| Timer fires twice | `runOnStartup` adds invocations as hosts start, or another app/slot runs the schedule | Set `runOnStartup` to `false` in production and inventory deployments. Normal scale-out isn't the cause: a blob lease allows one scheduled invocation per app |
| Timer never fires or runs late | Host storage is unavailable, the app is stopped/disabled, or the host ID collides with another app using the same storage | Check `AzureWebJobsStorage`, host storage permissions, `AzureFunctionsWebHost__hostid`, and `Host.Triggers.Timer` traces. Always On applies only to Dedicated plans; Consumption and Flex timers are designed to wake from zero |
| Missed-run catch-up not happening | Schedule monitoring is disabled | Set `useMonitor` to `true` when catch-up is required. It defaults to `true` for intervals of at least one minute and `false` for more frequent schedules |

## Queue Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Message never processed | Poison message after `maxDequeueCount` (default 5) retries | Message moved to `<queue>-poison`; inspect it to find the root cause |
| Duplicate processing | Host stopped after side effects but before message deletion, or another consumer read the queue | The Functions host renews visibility during an invocation; `visibilityTimeout` controls retry delay after failure. Check host restarts and make side effects idempotent |
| Function stops triggering | Storage authentication fails | Re-check `AzureWebJobsStorage` and `Host.Listener` traces for `StorageException` |

```bash
# Peek poison messages
az storage message peek --queue-name "<queue>-poison" --account-name <account> --num-messages 32
```

**After fixing the root cause, verify before bulk-replaying:**
1. Review prior attempts' downstream state/logs and establish a safe, idempotent replay path before re-enqueuing any message.
2. Re-enqueue one representative poison message (not the whole batch) and confirm it completes successfully without duplicate side effects.
3. Confirm its `dequeueCount` stays at 1 (no further retries) and the function's App Insights `requests` entry shows `success == true`.
4. Watch the `<queue>-poison` queue depth over the next few minutes/hours to confirm it stops growing for that failure signature before replaying the remaining messages in a bounded batch.

## Blob Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Trigger delayed by minutes | Blob-trigger polling (non-Event Grid path) scans the container on a timer | Switch to the Event Grid-based blob trigger (`source: "EventGrid"`) for near-real-time triggering |
| Trigger never fires for a version | A receipt already exists for that blob path and ETag | Overwriting the blob creates a new ETag and should trigger. To reprocess the same version, delete only its matching receipt after confirming duplicate side effects are safe |
| Trigger fires for the wrong container | `path` pattern too broad or missing container scoping | Tighten the `path` binding expression (e.g. `samples-workitems/{name}`) |

## Service Bus Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Message stuck retrying | `MaxDeliveryCount` exceeded, moved to dead-letter | Inspect the dead-letter sub-queue for the underlying exception |
| `MessageLockLostException` | Execution exceeds lock renewal, or high prefetch lets locks age before processing | For single-message triggers, reduce work/prefetch or increase `maxAutoLockRenewalDuration` (default 5 minutes). It doesn't apply to batches; batch processing must finish within the entity's lock duration. Use manual renewal only with `autoCompleteMessages: false` and exposed message actions |
| No messages arriving | SAS key rotated, or namespace network rules block the Functions host | Verify the connection app setting; check namespace firewall/VNet rules if not using a private endpoint |

```text
# View dead-letter message contents
# Azure CLI does not support peeking Service Bus dead-letter message bodies directly.
# Use one of the following instead:
#   - Service Bus Explorer in the Azure portal (namespace -> Queues -> <queue> -> Dead-letter)
#   - An Azure Service Bus SDK (.NET, Java, Python, or JavaScript) with a receiver scoped
#     to "<queue>/$DeadLetterQueue", using a peek or receive operation.
```

## Cosmos DB Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Independent apps receive only part of the feed | Apps share a lease container and prefix, so they load-balance one logical processor | Give each independent workflow a unique `leaseContainerPrefix`, or use a dedicated lease container |
| No changes delivered | Lease container missing, or `createLeaseContainerIfNotExists` is false without a pre-created container | Verify the lease container exists; grant the identity/connection write access to it |
| Missing/default fields or deserialization failure | Bound model doesn't match document shape, casing, or schema version | `StartFromBeginning` only controls initial feed position and is ignored after checkpoints exist. Compare the document with the bound type, then inspect it through a supported raw JSON type (`JsonElement`, `string`, or `JObject`) |
| Feed replays from the start unexpectedly | New lease container, or `StartFromBeginning: true` with no existing leases | Expected on first deployment; set `StartFromBeginning: false` (default) after backfill. It only affects lease creation with no prior checkpoint |

For a manually created lease container, use partition key `/id`. The trigger identity needs
read/write access to lease items. Multiple triggers can share that container only when each
uses a unique `leaseContainerPrefix`.

## Flex Consumption Specifics

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cold start despite "always ready" expectation | No always-ready instance for the function's scale group | Configure `http`, `durable`, `blob`, or `function:<FUNCTION_NAME>` with `az functionapp scale config always-ready set` |
| Can't reach a VNet-integrated resource | VNet integration not configured, or NSG/route table blocking egress to a private destination | Confirm subnet delegation (`Microsoft.App/environments` for Flex) and inspect the route table/NSG on the integration subnet for a blackhole route; route-all is not the fix for private-destination failures. **Your written answer must cover all 5 items in the checklist below — do not send it until you've confirmed each one.** |
| Deployment succeeds but scaling is capped | Maximum instance count or the regional subscription memory quota is exhausted | Inspect `az functionapp scale config show -g RG -n APP`; check **Usage + quotas** for the subscription and region |
| Binding fails after dependency changes | Mixed Functions programming models or incompatible binding-extension versions | Use one programming model and align its binding packages. .NET isolated apps use `Microsoft.Azure.Functions.Worker.Extensions.*`; non-.NET apps using extension bundles should not also install the same binding extensions manually |

> ⚠️ **Final-answer checklist for VNet/route/private-endpoint root causes:** when a route table or
> private endpoint is the root cause of a VNet-integrated failure, re-read your drafted answer
> against this list before sending it — evidence gathered mid-session that didn't make it into the
> final text still fails review. Confirm each box is literally answered in the text, not just
> implied by the tool calls you ran:
>
> - [ ] **Subnet delegation** named explicitly: the Function App's integration subnet is delegated
>   to `Microsoft.App/environments` (Flex Consumption) or `Microsoft.Web/serverFarms` (Elastic
>   Premium/Dedicated) — don't just call it "the subnet."
> - [ ] **Subnet separation** named explicitly: the integration subnet and the target's subnet (e.g.
>   the private endpoint's subnet) are two distinct subnets with their own route-table/NSG
>   associations and DNS zone links, even if they sit in the same VNet.
> - [ ] **Why "Route All" isn't the fix**, stated explicitly: for Flex/Elastic Premium outbound VNet
>   integration, private RFC1918 destinations already traverse the integration subnet's route table
>   and NSG without enabling route-all; route-all only forces *public* internet egress through the
>   VNet. If a private destination is unreachable, say the cause is a route/NSG/DNS entry, not a
>   missing route-all toggle.
> - [ ] **Why unrelated paths stay healthy**, stated explicitly: host/deployment storage, the
>   platform health probe, and other destinations are unaffected because they resolve to different
>   IPs/paths not covered by the blackholed route or blocking NSG rule — the failure is
>   destination-specific, not a platform-wide outage.
> - [ ] **Post-rollback verification list**, spelled out as a list: after any proposed route/NSG
>   rollback, re-verify — and list — private DNS resolution, the route table entry/absence, resource
>   health, the originally failing call, and a correlated telemetry check (e.g. the next App
>   Insights request/trace after the fix), not just one of these.

## Integration Testing Trigger Failure Paths

Assert the failure path, not just the happy path:

- **Queue**: force failure; confirm the message reaches `<queue>-poison` after `maxDequeueCount`.
- **Service Bus**: exceed lock renewal; confirm retries don't duplicate side effects.
- **Cosmos DB**: omit a required field; assert a clear deserialization error.
- **HTTP**: verify long work returns 202 instead of waiting past the gateway limit.
