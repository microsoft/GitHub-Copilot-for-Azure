## Azure Functions Observability

Observability guide for Azure Functions with Application Insights.

## Built-in Monitoring Integration

Azure Functions connects to Application Insights automatically when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. No SDK installation is needed for basic telemetry—invocations, durations, and errors are captured by the host runtime.

```bash
az functionapp config appsettings set \
  --name <function-app> \
  --resource-group <rg> \
  --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=<conn-string>"
```

> 💡 **Tip:** New Function Apps created via the Azure Portal have App Insights enabled by default. For IaC deployments, always include this app setting in your Bicep/Terraform.

## Host-Level vs Function-Level Telemetry

| Telemetry Layer | What It Captures | Table |
|----------------|-----------------|-------|
| **Host-level** | Startup, scaling, worker health, binding execution | `traces`, `FunctionAppLogs` |
| **Function-level** | Invocation result, duration, trigger metadata | `requests`, `FunctionAppLogs` |
| **Custom SDK** | Dependencies, custom events, manual spans | `dependencies`, `customEvents` |

Host telemetry is always collected by the runtime. Function-level detail enriches each invocation with `InvocationId` and `OperationId` for correlation.

## FunctionAppLogs Table

The `FunctionAppLogs` table consolidates host and function logs in one place:

| Column | Description |
|--------|-------------|
| `FunctionName` | Name of the executed function |
| `FunctionInvocationId` | Unique ID per invocation |
| `Level` | Log level (Information, Warning, Error) |
| `Message` | Log message text |
| `HostInstanceId` | Host process instance |
| `OperationId` | Correlation ID linking distributed traces |

## Invocation-Level Tracing

Each function invocation gets a unique `InvocationId`. The runtime also assigns an `OperationId` that propagates to downstream calls:

1. Trigger fires → host assigns `InvocationId` + `OperationId`
2. Function code executes → SDK-instrumented HTTP/DB calls inherit `OperationId`
3. All telemetry (requests, dependencies, traces) correlates via `OperationId`

> ⚠️ **Warning:** If you make outbound HTTP calls without an instrumented client, correlation breaks. Use OpenTelemetry-instrumented libraries or the Application Insights SDK.

## Durable Functions Monitoring

Durable Functions generate orchestration telemetry automatically:

| Event | Table | Key Fields |
|-------|-------|------------|
| Orchestration started/completed/failed | `requests` | `name`, `duration`, `success` |
| Activity execution | `requests` | `name`, `duration`, linked via `operation_Id` |
| Replay events | `traces` | Filtered by `sdkVersion` containing `durable` |

```kql
// Orchestration status summary
requests
| where name startswith "Orchestrator:" or name startswith "Activity:"
| summarize count(), avg(duration), percentile(duration, 95) by name, success
| order by count_ desc
```

> 💡 **Tip:** Use the Durable Functions Monitor extension or the built-in `/runtime/webhooks/durableTask` HTTP API to inspect orchestration history without KQL.

## KQL Query Library

### Error rate by function name

```kql
FunctionAppLogs
| where Level == "Error"
| summarize errorCount = count() by FunctionName, bin(TimeGenerated, 1h)
| order by errorCount desc
```

### Duration P50 / P95 / P99 by function

```kql
requests
| where cloud_RoleName == "<function-app-name>"
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99)
  by name, bin(timestamp, 1h)
| order by timestamp desc
```

### Cold start frequency per hosting plan

```kql
traces
| where message contains "Host started" or message contains "Host initialized"
| summarize coldStarts = count() by cloud_RoleName, bin(timestamp, 1h)
| order by timestamp desc
```

> 💡 **Tip:** Cold starts are most frequent on the Consumption plan. Premium and Dedicated plans with pre-warmed instances show significantly fewer.

### Failed invocations with stack traces

```kql
FunctionAppLogs
| where Level == "Error" and isnotempty(ExceptionMessage)
| project TimeGenerated, FunctionName, FunctionInvocationId, ExceptionMessage, ExceptionDetails
| order by TimeGenerated desc
| take 50
```

### Scaling events correlation

```kql
traces
| where message contains "scaling" or message contains "Adding worker" or message contains "Removing worker"
| project timestamp, cloud_RoleName, message
| order by timestamp desc
| take 100
```

## Hosting Plan Impact on Telemetry

| Plan | Default Sampling | Telemetry Fidelity | Notes |
|------|-----------------|-------------------|-------|
| **Consumption** | Adaptive sampling ON | Reduced at high volume | Cost-effective; may miss low-frequency events |
| **Premium** | Adaptive sampling ON (configurable) | High | Disable sampling in `host.json` for full fidelity |
| **Dedicated** | Adaptive sampling ON (configurable) | High | Same as App Service behavior |

Disable adaptive sampling in `host.json` for full-fidelity telemetry:

```json
{
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": false
      }
    }
  }
}
```

> ⚠️ **Warning:** Disabling sampling on high-throughput Consumption plans can increase Application Insights costs significantly. Use `maxTelemetryItemsPerSecond` to cap volume instead of fully disabling.
