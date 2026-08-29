# Azure Functions Cold Start Mitigation

Cold starts occur when a function app must allocate infrastructure, load the runtime, and initialize your code before handling a request. Impact and mitigation options differ significantly by hosting plan.

## Cold Start Impact by Plan

| Plan | Typical Cold Start | Can Eliminate? |
|------|--------------------|----------------|
| Consumption (Y1) | Seconds, worse on Linux with large dependency trees | ❌ No built-in always-ready mechanism; timer warm-up is a workaround only |
| Flex Consumption (FC1) | Near-zero with always-ready instances configured | ✅ Yes, via always-ready instance groups |
| Premium (EP1–EP3) | Near-zero with minimum instances configured | ✅ Yes, via minimum instance count |
| Dedicated | None while `Always On` is enabled | ✅ Yes, plan runs continuously |
| Container Apps (Functions-on-ACA) | Depends on `minimumElasticInstanceCount` | ✅ Yes, set minimum instance count ≥ 1 |

## Mitigation Strategies

### Consumption Plan

No built-in always-ready mechanism. Available workarounds:

| Strategy | How | Trade-off |
|----------|-----|-----------|
| Timer trigger warm-up | Timer function every few minutes pings HTTP endpoints | Extra invocations; not guaranteed to prevent every cold start |
| Reduce package size | Trim unused dependencies; use tree-shaking/bundling | Development effort |
| Optimize startup code | Lazy-load heavy modules; defer non-critical connections | Code changes required |

```jsonc
// host.json — reduce extension bundle load time by pinning a narrower version range
{
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

> 💡 **Tip:** If cold starts are a consistent problem on Consumption, move to Flex Consumption or Premium — see [hosting-plans.md](hosting-plans.md) for the comparison.

### Flex Consumption Plan

Configure always-ready instances for a function group with the dedicated CLI command (do not hand-edit the `functionAppConfig` ARM array — indexing into it by position can silently overwrite other always-ready groups):

```bash
# Set 1 always-ready instance for the "http" function group
az functionapp scale config always-ready set \
  -g $RG -n $APP \
  --settings http=1
```

#### Bicep — Always-Ready Configuration

```bicep
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: flexPlan.id
    functionAppConfig: {
      runtime: {
        name: 'node'
        version: '22'
      }
      scaleAndConcurrency: {
        alwaysReady: [
          { name: 'http', instanceCount: 1 }
        ]
        instanceMemoryMB: 2048
        maximumInstanceCount: 100
      }
    }
  }
}
```

> ⚠️ **Warning:** Always-ready instances are billed continuously, separate from and in addition to on-demand instances (they don't count toward `maximumInstanceCount`). Start with 1 instance per group and scale based on observed traffic.

### Premium Plan

Premium plans support a configurable minimum instance count; the platform auto-calculates a floor from each app's always-ready requests, but you can raise it explicitly:

```bash
az functionapp plan update -g $RG -n $PLAN --min-instances 2
az functionapp plan update -g $RG -n $PLAN --max-burst 20
```

> `--min-elastic-worker-count` is not a valid parameter for `az functionapp plan update` — use `--min-instances`.

### Dedicated Plan

Enable `Always On` so the app is never unloaded due to idle timeout:

```bash
az functionapp config set -g $RG -n $APP --always-on true
```

### Functions on Container Apps

Functions running on Container Apps are deployed as a `Microsoft.Web/sites` resource pointed at a Container Apps managed environment — **not** a bare `Microsoft.App/containerApps` resource, which would produce a plain container app with no Functions host. Set the minimum instance count via `siteConfig.minimumElasticInstanceCount`:

```bicep
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux,container,azurecontainerapps'
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    siteConfig: {
      minimumElasticInstanceCount: 1
      linuxFxVersion: 'DOCKER|${containerImage}'
    }
  }
}
```

> ⚠️ **Warning:** `minimumElasticInstanceCount: 0` allows scale-to-zero (cold starts return); set it to `1` or higher to keep at least one instance warm.

## Language-Specific Optimization

| Language | Cold Start Tip |
|----------|---------------|
| .NET | Use ReadyToRun (or Native AOT where supported) compilation; avoid heavy DI registration in startup |
| Node.js | Minimize `node_modules`; bundle with esbuild/webpack; use Node 22 (current LTS) |
| Python | Reduce package count; avoid importing unused modules at the top of the file |
| Java | Prefer the latest supported Java version on Functions v4; minimize static initialization and classpath size |
| PowerShell | Minimize modules declared in `requirements.psd1` |

## Recommendation Summary

| Scenario | Recommended Plan | Cold Start Strategy |
|----------|-----------------|----------------------|
| Cost-sensitive, tolerates latency | Consumption | Timer warm-up + small deployment package |
| Low latency, Linux, bursty | Flex Consumption | 1-2 always-ready instances via `az functionapp scale config always-ready set` |
| Enterprise, strict SLA, Windows or slots needed | Premium | `--min-instances` set to cover peak-adjacent baseline |
| Shared App Service plan, always running | Dedicated | `Always On = true` |
| Containerized Functions | Container Apps (Functions-on-ACA) | `siteConfig.minimumElasticInstanceCount ≥ 1` on a `Microsoft.Web/sites` resource |
