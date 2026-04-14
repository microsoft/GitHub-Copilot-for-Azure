# Function App Trigger-Specific Troubleshooting

## HTTP Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 5xx on every request | Function runtime crash | Check `host.json` for misconfig; review App Insights `exceptions` table |
| 401 Unauthorized | Auth level mismatch | Verify `authLevel` in function.json matches request (function key vs anonymous) |
| 404 Not Found | Route prefix misconfigured | Check `host.json` `extensions.http.routePrefix` — default is `api` |
| CORS blocked | Missing allowed origins | `az functionapp cors add -n APP -g RG --allowed-origins "https://DOMAIN"` |
| 408 / timeout | Long-running execution or HTTP client/gateway idle timeout | Check `functionTimeout` in host.json (execution timeout) and client/front-end idle limits. For long-running work use async patterns (202 + status endpoint or Durable HTTP APIs), or move to Premium for longer sync executions. |

**KQL — HTTP errors by status code:**
```kql
requests
| where timestamp > ago(1h)
| where resultCode >= 400
| summarize count() by resultCode, operation_Name
| order by count_ desc
```

**Diagnose:**
```bash
# Check function host status
az functionapp show -n APP -g RG --query "state"

# Test function endpoint directly
curl -s -w "\n%{http_code}" "https://APP.azurewebsites.net/api/FUNCTION?code=FUNCTION_KEY"
```

---

## Timer Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timer never fires | Invalid NCRONTAB expression | Validate with `NCrontab.Advanced` — field order: `{second} {minute} {hour} {day} {month} {day-of-week}` |
| Timer fires twice | Multiple instances running | Configure singleton behavior via `host.json` (singleton settings) or language-specific singleton/lock attributes so only one instance runs the timer |
| Missed timer execution | App was stopped / scaled to zero | Enable Always On (`az functionapp config set -n APP -g RG --always-on true`) — requires App Service plan |
| Timer drift after deploy | Missed schedule catch-up | Ensure `"useMonitor": true` in the timer trigger binding in `function.json` (default) — runtime tracks missed executions in storage |

**Diagnose:**
```bash
# Verify timer trigger config
az functionapp config appsettings list -n APP -g RG \
  --query "[?name=='AzureWebJobsStorage']" -o table

# Check singleton lock status in storage
az storage blob list --account-name STORAGE --container-name azure-webjobs-hosts \
  --prefix "locks/" --output table
```

> ⚠️ **Warning:** `AzureWebJobsStorage` must be set and valid for timer triggers — the runtime uses it to store schedule status and singleton locks.

---

## Queue Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Messages stuck in queue | Function failing silently | Check `exceptions` table in App Insights |
| Poison messages | Max dequeue exceeded | Default `maxDequeueCount` is 5; messages go to `QUEUE-poison`. Inspect and reprocess |
| Queue not processing | Connection string wrong | Verify `AzureWebJobsStorage` or custom connection setting |
| Duplicate processing | Visibility timeout too short | Increase `visibilityTimeout` in host.json `extensions.queues` |

**KQL — Poison message tracking:**
```kql
traces
| where timestamp > ago(24h)
| where message contains "poison" or message contains "MaxDequeueCountExceeded"
| project timestamp, operation_Name, message
| order by timestamp desc
```

**Diagnose:**
```bash
# Check queue length and poison queue
az storage message peek --queue-name QUEUE --account-name STORAGE --num-messages 5
az storage message peek --queue-name QUEUE-poison --account-name STORAGE --num-messages 5

# Check host.json queue config
az functionapp config appsettings list -n APP -g RG --query "[?name=='AzureWebJobsStorage']"
```

---

## Blob Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Trigger delayed (minutes) | Using polling scan (default) | Switch to Event Grid trigger for near-instant processing |
| Container not found | Wrong connection or name | Verify `connection` and `path` in function.json |
| Blobs processed multiple times | Blob receipt tracking failure | Check `azure-webjobs-hosts/blobreceipts/` in storage |
| Large blobs timeout | Consumption plan limits | Stream blobs or use Premium plan for larger payloads |

**Diagnose:**
```bash
# Verify storage connection
az functionapp config appsettings list -n APP -g RG \
  --query "[?name=='AzureWebJobsStorage' || contains(name, 'BlobStorage')]"

# Check blob receipts container
az storage container show --name azure-webjobs-hosts --account-name STORAGE
```

> 💡 **Tip:** For production workloads, prefer Event Grid-based blob triggers (`BlobTrigger` with `source: "EventGrid"` in host.json) for reliable, low-latency processing.

---

## Service Bus Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `MessageLockLostException` | Processing exceeds lock duration | Increase lock duration on queue/subscription, or break into smaller work units |
| Messages go to dead-letter | Max delivery count exceeded | Check DLQ: `az servicebus queue show -n QUEUE --namespace-name NS -g RG --query "countDetails"` |
| Session handler errors | `isSessionsEnabled` mismatch | Ensure function.json `isSessionsEnabled` matches the queue/subscription setting |
| Connection failures | Firewall or managed identity | Verify connection string or identity role (`Azure Service Bus Data Receiver`) |

**KQL — Service Bus processing errors:**
```kql
exceptions
| where timestamp > ago(1h)
| where type contains "ServiceBus" or outerMessage contains "lock"
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
```

**Diagnose:**
```bash
# Check dead-letter queue depth
az servicebus queue show -n QUEUE --namespace-name NS -g RG \
  --query "{dlqCount:countDetails.deadLetterMessageCount, activeCount:countDetails.activeMessageCount}"

# View dead-letter message contents
# Note: Azure CLI does not currently support peeking DLQ message bodies directly.
# Use one of the following instead:
#   - Service Bus Explorer in the Azure portal (Service Bus namespace -> Queues -> <QUEUE> -> Dead-letter)
#   - An Azure Service Bus SDK (for example, .NET, Java, Python, or JavaScript) with a receiver scoped to:
#       "<QUEUE>/$DeadLetterQueue"
#     and using a "peek" or "receive" operation to inspect messages.
```

---

## Cosmos DB Trigger Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Trigger not firing | Lease container missing | Create lease container (default: `leases`) in same database |
| Change feed lag | Insufficient RU/s on lease container | Increase RU/s on leases container or enable autoscale |
| Duplicate processing | Multiple apps share lease container | Set unique `LeaseContainerPrefix` per function app in host.json |
| Partial document data | Projection or TTL conflict | Ensure `StartFromBeginning` config and verify no TTL on lease container |

**Diagnose:**
```bash
# Verify lease container exists
az cosmosdb sql container show --account-name COSMOS -g RG \
  --database-name DB --name leases

# Check function app Cosmos DB connection
az functionapp config appsettings list -n APP -g RG \
  --query "[?contains(name, 'CosmosDB') || contains(name, 'cosmos')]"
```

**KQL — Cosmos DB trigger lag:**
```kql
traces
| where timestamp > ago(1h)
| where message contains "lease" or message contains "ChangeFeed"
| project timestamp, message, operation_Name
| order by timestamp desc
| take 30
```

> ⚠️ **Warning:** If the monitored container has high throughput, set `MaxItemsPerInvocation` in host.json to limit batch size and prevent function timeouts.
