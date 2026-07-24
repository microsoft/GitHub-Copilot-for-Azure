## Azure Functions Observability

Application Insights captures Azure Functions host and invocation telemetry when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Basic requests, durations, failures, and host traces do not require adding an SDK.

```bash
az functionapp config appsettings set \
  --name <function-app> \
  --resource-group <rg> \
  --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=<conn-string>"
```

> 💡 **Tip:** Portal-created Function Apps usually enable App Insights by default. IaC deployments must set the connection string explicitly.

## Telemetry Layers and Correlation

| Layer | Captures | Tables |
|---|---|---|
| Host | Startup, scale, worker health, bindings | `traces`, `FunctionAppLogs` |
| Invocation | Result, duration, trigger metadata | `requests`, `FunctionAppLogs` |
| Custom SDK | Dependencies, events, spans | `dependencies`, `customEvents` |

`FunctionAppLogs` is available when diagnostic logs route to Log Analytics; App Insights-only setups may only have `requests`, `traces`, and `exceptions`. Each invocation gets a `FunctionInvocationId`; correlate with `OperationId` in `FunctionAppLogs` or `operation_Id` in App Insights tables.

> ⚠️ **Warning:** Outbound HTTP or database calls need instrumented clients (Application Insights SDK or OpenTelemetry) to preserve distributed trace correlation.

## Durable Functions

Durable Functions emit orchestration and activity telemetry automatically. Names often appear as `Orchestrator:*` or `Activity:*`, but prefixes vary by Durable Task version; fall back to Durable properties in `customDimensions` if needed.

```kql
requests
| where name startswith "Orchestrator:" or name startswith "Activity:"
| summarize count(), avg(duration), percentile(duration, 95) by name, success
| order by count_ desc
```

Use Durable Functions Monitor or `/runtime/webhooks/durableTask` for orchestration history when KQL is not enough.

## KQL Query Library

### Error count by function

```kql
FunctionAppLogs
| where Level == "Error"
| summarize errorCount = count() by FunctionName, bin(TimeGenerated, 1h)
| order by errorCount desc
```

### Duration percentiles

```kql
requests
| where cloud_RoleName == "<function-app-name>"
| summarize p50=percentile(duration,50), p95=percentile(duration,95), p99=percentile(duration,99) by name, bin(timestamp, 1h)
| order by timestamp desc
```

### Cold starts

```kql
traces
| where message contains "Host started" or message contains "Host initialized"
| summarize coldStarts=count() by cloud_RoleName, bin(timestamp, 1h)
| order by timestamp desc
```

Cold starts are most common on Consumption. Premium and Dedicated plans with pre-warmed instances should show fewer.

### Failed invocations with exceptions

```kql
FunctionAppLogs
| where Level == "Error" and isnotempty(ExceptionMessage)
| project TimeGenerated, FunctionName, FunctionInvocationId, ExceptionMessage, OperationId
| order by TimeGenerated desc
| take 50
```

Join `exceptions` on `OperationId == operation_Id` for stack traces.

### Scale events

```kql
traces
| where message contains "scaling" or message contains "Adding worker" or message contains "Removing worker"
| project timestamp, cloud_RoleName, message
| order by timestamp desc
| take 100
```

## Hosting Plan Impact

| Plan | Sampling | Notes |
|---|---|---|
| Consumption | Adaptive on | Cost-effective; may miss rare events at high volume |
| Premium | Adaptive on, configurable | Use pre-warmed instances; can reduce sampling for fidelity |
| Dedicated | Adaptive on, configurable | Same App Service behavior |

For full-fidelity investigations, temporarily disable or tune sampling in `host.json`:

```json
{
  "logging": {
    "applicationInsights": {
      "samplingSettings": { "isEnabled": false }
    }
  }
}
```

> ⚠️ **Warning:** Disabling sampling on high-throughput apps can increase costs. Prefer `maxTelemetryItemsPerSecond` when possible.
