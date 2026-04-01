## Container Apps Observability

Observability guide for apps running in Azure Container Apps.

## Environment-Level Log Analytics

Every Container Apps environment requires a Log Analytics workspace. Configure it at environment creation:

```bash
az containerapp env create \
  --name <env-name> \
  --resource-group <rg> \
  --logs-workspace-id <workspace-id> \
  --logs-destination log-analytics
```

> 💡 **Tip:** All apps in the same environment share the workspace. Use `--logs-destination none` only for BYOB (bring-your-own-backend) scenarios.

## System Logs vs Application Logs

| Log Table | Content | Retention |
|-----------|---------|-----------|
| `ContainerAppConsoleLogs_CL` | stdout/stderr from containers | Workspace default |
| `ContainerAppSystemLogs_CL` | Platform events (scaling, restarts, image pulls) | Workspace default |

System logs capture events outside your code—replica scheduling, health probe results, and revision activation. Console logs capture everything your app writes to stdout/stderr.

## Built-in Metrics

Container Apps exposes these metrics without any SDK:

| Metric | Description | Dimension |
|--------|-------------|-----------|
| `Replicas` | Current replica count | `revisionName` |
| `Requests` | HTTP request count | `statusCodeCategory`, `revisionName` |
| `UsageNanoCores` | CPU usage per replica | `revisionName` |
| `WorkingSetBytes` | Memory usage per replica | `revisionName` |
| `RestartCount` | Container restart count | `revisionName` |
| `RxBytes` / `TxBytes` | Network I/O | `revisionName` |

> ⚠️ **Warning:** Built-in metrics cover infrastructure only. For request-level tracing, response times, and dependency tracking, add Application Insights SDK.

## Application Insights SDK Setup

Set `APPLICATIONINSIGHTS_CONNECTION_STRING` as an environment variable on the container app, then add the SDK per language:

| Language | Package | Init Pattern |
|----------|---------|-------------|
| Node.js | `@azure/monitor-opentelemetry` | Call `useAzureMonitor()` before app startup |
| Python | `azure-monitor-opentelemetry` | Call `configure_azure_monitor()` at entry |
| .NET | `Azure.Monitor.OpenTelemetry.AspNetCore` | `builder.Services.AddOpenTelemetry().UseAzureMonitor()` |
| Java | Auto-agent JAR | Set `JAVA_TOOL_OPTIONS=-javaagent:/agent/applicationinsights-agent.jar` |

```bash
az containerapp update \
  --name <app-name> \
  --resource-group <rg> \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=<conn-string>"
```

## Distributed Tracing Across Microservices

Container Apps with multiple services need correlation. The OpenTelemetry SDK propagates `traceparent` headers automatically through HTTP calls. Ensure:

1. Every microservice has the SDK initialized with the **same** Application Insights resource
2. HTTP clients use instrumented libraries (e.g., `requests` in Python, `fetch`/`axios` in Node.js)
3. Verify end-to-end traces in the **Application Map** blade

> 💡 **Tip:** Use `operation_Id` in KQL queries to trace a single request across all services.

## Dapr Observability

For apps using Dapr sidecars, telemetry is collected automatically for service invocation, pub/sub, and state operations.

Configure Dapr tracing in the environment:

```yaml
# dapr-config.yaml
apiVersion: dapr.io/v1alpha1
kind: Configuration
metadata:
  name: appconfig
spec:
  tracing:
    samplingRate: "1"
    otel:
      endpointAddress: "<app-insights-collector-endpoint>"
      isSecure: true
      protocol: grpc
```

Dapr generates spans for:
- **Service invocation** — caller → Dapr sidecar → target sidecar → target app
- **Pub/sub** — publisher → broker → subscriber
- **Bindings** — input/output binding operations

## ARG Queries — Monitoring Status

Discover Container Apps and their monitoring configuration:

```kql
// Container Apps without App Insights configured
resources
| where type == "microsoft.app/containerapps"
| extend envVars = properties.template.containers[0].env
| mv-expand envVar = envVars
| summarize hasAppInsights = countif(envVar.name == "APPLICATIONINSIGHTS_CONNECTION_STRING") by name, resourceGroup
| where hasAppInsights == 0
```

## KQL Query Library

### Console log errors

```kql
ContainerAppConsoleLogs_CL
| where Log_s contains "error" or Log_s contains "exception"
| project TimeGenerated, ContainerAppName_s, RevisionName_s, Log_s
| order by TimeGenerated desc
| take 50
```

### Replica restart events

```kql
ContainerAppSystemLogs_CL
| where EventSource_s == "ContainerAppController" and Reason_s == "Restarting"
| summarize restarts = count() by ContainerAppName_s, RevisionName_s, bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

### Scaling events

```kql
ContainerAppSystemLogs_CL
| where Reason_s in ("ScalingUp", "ScalingDown")
| project TimeGenerated, ContainerAppName_s, Reason_s, ReplicaCount_d
| order by TimeGenerated desc
```

### Request latency by revision

```kql
ContainerAppConsoleLogs_CL
| where isnotempty(Log_s)
| summarize logCount = count() by RevisionName_s, bin(TimeGenerated, 5m)
| render timechart
```

> 💡 **Tip:** For request-level latency and dependency analysis, query the `requests` and `dependencies` tables from Application Insights instead of console logs.
