# Azure Functions Cold Start Mitigation

Cold starts occur when a function app must allocate infrastructure, load the runtime, and initialize your code before handling a request.

## Cold Start Impact by Plan

| Plan | Typical Cold Start | Can Eliminate? |
|------|-------------------|----------------|
| Consumption (Y1) | 2–10 s | ❌ No (timer workaround only) |
| Flex Consumption (FC1) | <1 s (with always-ready) | ✅ Yes |
| Premium (EP1–EP3) | <1 s (pre-warmed) | ✅ Yes |
| Dedicated | None (always on) | ✅ Always running |
| Container Apps | 1–5 s (with minReplicas: 0) | ✅ Yes (set minReplicas ≥ 1) |

## Mitigation Strategies

### Consumption Plan

No built-in always-ready mechanism. Available workarounds:

| Strategy | How | Trade-off |
|----------|-----|-----------|
| Timer trigger warm-up | Timer function every 5 min pings HTTP endpoints | Extra invocations; not guaranteed |
| Reduce package size | Trim unused dependencies; use tree-shaking | Development effort |
| Use Windows over Linux | Windows Consumption generally has faster cold starts | Platform constraint |
| Optimize startup code | Lazy-load heavy modules; defer DB connections | Code changes required |

```json
// host.json — reduce extension bundle load time
{
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

> 💡 **Tip:** If cold starts are a consistent problem on Consumption, consider upgrading to Flex Consumption or Premium. See [hosting-plans.md](hosting-plans.md) for comparison.

### Flex Consumption Plan

Configure always-ready instances per function group to keep instances warm:

```bash
# Set always-ready instances
az functionapp update -n $APP -g $RG \
  --set functionAppConfig.runtime.scale.alwaysReady[0].name=http \
  --set functionAppConfig.runtime.scale.alwaysReady[0].instanceCount=1
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
        version: '20'
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

> ⚠️ **Warning:** Always-ready instances incur cost even when idle. Start with 1 instance and scale based on observed traffic patterns.

### Premium Plan

Premium plans include pre-warmed instances by default. Set minimum always-on instances:

```bash
az functionapp plan update -n $PLAN -g $RG --min-elastic-worker-count 2
az functionapp plan update -n $PLAN -g $RG --max-burst 20
```

#### Bicep — Premium Plan with Pre-warmed Instances

```bicep
resource premiumPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: planName
  location: location
  sku: { name: 'EP1', tier: 'ElasticPremium' }
  kind: 'elastic'
  properties: {
    maximumElasticWorkerCount: 20
  }
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: premiumPlan.id
    siteConfig: {
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_MAX_DYNAMIC_APPLICATION_SCALE_OUT', value: '20' }
      ]
      preWarmedInstanceCount: 2
    }
  }
}
```

### Container Apps Hosting

Set `minReplicas` ≥ 1 to avoid cold starts:

```bicep
scale: {
  minReplicas: 1
  maxReplicas: 10
}
```

## Language-Specific Optimization

| Language | Cold Start Tip |
|----------|---------------|
| .NET | Use ReadyToRun compilation; avoid heavy DI in startup |
| Node.js | Minimize `node_modules`; use ESM and tree-shaking |
| Python | Reduce package count; precompile `.pyc` files |
| Java | Use GraalVM native image or SnapStart (where supported) |
| PowerShell | Minimize modules loaded in `requirements.psd1` |

## Recommendation Summary

| Scenario | Recommended Plan | Cold Start Strategy |
|----------|-----------------|-------------------|
| Cost-sensitive, tolerates latency | Consumption | Timer warm-up + small packages |
| Low latency, Linux, bursty | Flex Consumption | always-ready: 1-2 instances |
| Enterprise, strict SLA | Premium | pre-warmed: 2+ instances |
| Shared plan, always running | Dedicated | Always On = true |
| Microservices / containers | Container Apps | minReplicas ≥ 1 |
