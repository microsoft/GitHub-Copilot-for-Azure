# Durable Functions Troubleshooting

## Common Issues Matrix

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Orchestration stuck in "Running" | Activity function failed or hung | Check task hub history; terminate and purge if needed |
| Non-deterministic orchestration error | Code uses `DateTime.Now`, `Guid.NewGuid()`, or random | Replace with `IDurableOrchestrationContext` deterministic APIs |
| Task hub conflicts | Multiple apps sharing same hub | Set unique `hubName` per app in host.json |
| Fan-out never completes | One activity silently failed | Query instance status for sub-orchestrations; check `exceptions` table |
| Replay causes side effects | I/O in orchestrator function | Move all I/O into activity functions |

---

## Stuck Orchestrations

**Diagnose:**
```bash
# Query orchestration instances by status
func durable get-instances --connection-string-setting AzureWebJobsStorage \
  --task-hub-name TASKHUB --runtime-status Running --top 10

# Check specific instance history
func durable get-runtime-status --id INSTANCE_ID \
  --connection-string-setting AzureWebJobsStorage \
  --task-hub-name TASKHUB --show-history
```

**KQL — Stuck orchestrations:**
```kql
traces
| where timestamp > ago(24h)
| where message contains "orchestration" and
  (message contains "stuck" or message contains "timeout" or message contains "failed")
| project timestamp, operation_Name, message
| order by timestamp desc
```

**Fix — Terminate and purge:**
```bash
# Terminate a stuck instance
func durable terminate --id INSTANCE_ID --reason "Manual termination — stuck" \
  --connection-string-setting AzureWebJobsStorage --task-hub-name TASKHUB

# Purge completed/terminated instances older than 7 days
func durable purge-history --connection-string-setting AzureWebJobsStorage \
  --task-hub-name TASKHUB --created-before "$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)"
```

> ⚠️ **Warning:** Termination is immediate and non-recoverable. Activity functions already running will complete, but their results are discarded.

---

## Non-Deterministic Code Detection

Orchestrator functions replay from history. Any non-deterministic call breaks replay.

| Anti-Pattern | Why It Breaks | Correct Alternative |
|-------------|---------------|---------------------|
| `DateTime.Now` / `DateTime.UtcNow` | Different value on replay | `context.CurrentUtcDateTime` |
| `Guid.NewGuid()` | Different GUID on replay | `context.NewGuid()` |
| `Thread.Sleep` / `Task.Delay` | Blocks orchestrator thread | `context.CreateTimer()` |
| Direct HTTP calls | Different response on replay | Use activity function or `context.CallHttpAsync()` |
| Environment variables | May change between replays | Pass config as orchestrator input |
| Random number generation | Non-deterministic | Generate in activity, pass to orchestrator |

**KQL — Detect non-deterministic errors:**
```kql
exceptions
| where timestamp > ago(24h)
| where type contains "NonDeterministic" or
  outerMessage contains "non-deterministic" or
  outerMessage contains "orchestrator function completed with"
| project timestamp, operation_Name, type, outerMessage
| order by timestamp desc
```

**Diagnose:**
```bash
# Check for orchestration replay errors in App Insights
az monitor app-insights query --apps APPINSIGHTS -g RG \
  --analytics-query "exceptions | where type contains 'NonDeterministic' | take 10"
```

---

## Task Hub Conflicts

Multiple function apps sharing the same task hub causes cross-contamination of orchestration state.

**Diagnose:**
```bash
# Check current task hub name
az functionapp config appsettings list -n APP -g RG \
  --query "[?name=='AzureWebJobsStorage']" -o table

# Inspect host.json for hub name
az webapp config show -n APP -g RG --query "siteConfig.appSettings"
```

**Fix — Set unique hub names in host.json:**
```json
{
  "version": "2.0",
  "extensions": {
    "durableTask": {
      "hubName": "MyApp-TaskHub-Prod"
    }
  }
}
```

| Symptom | Cause | Fix |
|---------|-------|-----|
| Orchestrations appear in wrong app | Shared `hubName` and storage account | Set unique `hubName` per app |
| Phantom instances after redeploy | Old hub data persists | Purge history or use new hub name |
| `PartitionNotFoundException` | Hub tables corrupted or deleted | Delete and recreate hub tables in storage |

**Storage tables for a task hub (Azure Storage provider):**
```bash
# List task hub tables
az storage table list --account-name STORAGE \
  --query "[?starts_with(name, 'TASKHUB')]" --output table
```

> 💡 **Tip:** Task hub names map to storage tables. The tables are named `<HubName>History` and `<HubName>Instances`.

---

## Timer / Retry Pattern Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timer fires immediately on replay | Using `Task.Delay` instead of durable timer | Replace with `context.CreateTimer(fireAt, cancellationToken)` |
| Retry storms | `maxNumberOfAttempts` too high with short intervals | Use exponential backoff: `CallActivityWithRetryAsync` with `RetryOptions` |
| Sub-orchestration timeout | No timeout set on `CallSubOrchestratorAsync` | Wrap in `Task.WhenAny` with `context.CreateTimer` as deadline |
| Eternal orchestration memory growth | History never purged | Use `ContinueAsNew()` to reset history periodically |

**Retry configuration example:**
```csharp
var retryOptions = new RetryOptions(
    firstRetryInterval: TimeSpan.FromSeconds(5),
    maxNumberOfAttempts: 3)
{
    BackoffCoefficient = 2.0,
    MaxRetryInterval = TimeSpan.FromMinutes(1)
};

await context.CallActivityWithRetryAsync("ProcessItem", retryOptions, item);
```

**KQL — Retry and timer anomalies:**
```kql
traces
| where timestamp > ago(6h)
| where message contains "retry" or message contains "timer" or message contains "ContinueAsNew"
| summarize count() by bin(timestamp, 5m), operation_Name
| order by timestamp desc
```

**Diagnose excessive history growth:**
```bash
# Count rows in instance history table
az storage entity query --table-name TASKHUBHistory --account-name STORAGE \
  --num-results 1 --select PartitionKey --query "items[0]"
```

> ⚠️ **Warning:** An orchestration with 10,000+ history events will experience significant replay latency. Use `ContinueAsNew()` in long-running orchestrations to keep history size manageable.
