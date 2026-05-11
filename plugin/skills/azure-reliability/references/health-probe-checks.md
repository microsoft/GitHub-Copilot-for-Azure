# Health Probe & Monitoring Checks

## Overview

Health probes enable automated failover and recovery. Without them, load balancers and platform services cannot detect failures automatically.

## Resource Graph Queries

### Check App Service / Function App Health Check Configuration

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.web/sites'
| extend healthCheckPath = tostring(properties.siteConfig.healthCheckPath)
| extend hasHealthCheck = isnotempty(healthCheckPath)
| project name, resourceGroup, kind, location, hasHealthCheck, healthCheckPath
| order by hasHealthCheck asc
" -o table
```

**Interpretation:**
- `hasHealthCheck = true` → ✅ Health check endpoint configured
- `hasHealthCheck = false` → ⚠️ No health check — platform cannot auto-detect unhealthy instances

### Check Container Apps Health Probes

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.app/containerapps'
| extend containers = properties.template.containers
| mv-expand container = containers
| extend probes = container.probes
| extend probeTypes = iff(isnotempty(probes), extract_all('\"type\":\"([^\"]+)\"', tostring(probes)), dynamic([]))
| extend hasLiveness = probeTypes has 'Liveness' or probeTypes has 'liveness'
| extend hasReadiness = probeTypes has 'Readiness' or probeTypes has 'readiness'
| summarize hasLiveness=max(hasLiveness), hasReadiness=max(hasReadiness) by name, resourceGroup, location
| extend probeStatus = case(
    hasLiveness and hasReadiness, 'Both (liveness + readiness)',
    hasLiveness, 'Liveness only (missing readiness)',
    hasReadiness, 'Readiness only (missing liveness)',
    'None')
| project name, resourceGroup, location, probeStatus
" -o table
```

**Interpretation:**
- `Both (liveness + readiness)` → ✅ Fully configured
- `Liveness only` or `Readiness only` → ⚠️ Partial — recommend adding both
- `None` → ❌ No health probes

### Check Front Door Health Probe Configuration

```bash
az afd origin-group list \
  --profile-name <front-door-name> \
  --resource-group <rg> \
  --query "[].{name:name, probePath:healthProbeSettings.probePath, probeProtocol:healthProbeSettings.probeProtocol, intervalSeconds:healthProbeSettings.probeIntervalInSeconds}" -o table
```

### Check Traffic Manager Endpoint Monitoring

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.network/trafficmanagerprofiles'
| extend monitorPath = tostring(properties.monitorConfig.path)
| extend monitorProtocol = tostring(properties.monitorConfig.protocol)
| extend monitorPort = tostring(properties.monitorConfig.port)
| project name, resourceGroup, monitorProtocol, monitorPort, monitorPath
" -o table
```

## What to Check

| Component | Check | Pass | Fail |
|---|---|---|---|
| App Service / Functions | Health check path configured | ✅ `/api/health` or similar | ⚠️ Empty |
| Container Apps | Liveness + readiness probes defined | ✅ Both present | ⚠️ Missing |
| Front Door | Health probe on origin group | ✅ Probe configured | ❌ No probe |
| Traffic Manager | Monitor endpoint configured | ✅ Path + protocol set | ❌ No monitoring |
| Application Insights | Connected to app | ✅ Instrumentation key set | ⚠️ No APM |

## Best Practices for Health Endpoints

### Function App Health Check

```csharp
// Example: HTTP trigger as health endpoint
[Function("health")]
public HttpResponseData Health([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
{
    var response = req.CreateResponse(HttpStatusCode.OK);
    response.WriteString("Healthy");
    return response;
}
```

Configure in Azure:
```bash
az webapp config set \
  --name <app-name> \
  --resource-group <rg> \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

### Container App Health Probes

```yaml
# In container app template
properties:
  template:
    containers:
      - name: my-app
        probes:
          - type: liveness
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          - type: readiness
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
```

### What a Good Health Endpoint Should Check

A health endpoint should verify:
1. App process is running (implicit if endpoint responds)
2. Database/storage connectivity (optional deep check)
3. Critical dependency availability

⚠️ Don't make health checks too heavy — they run every few seconds. A simple 200 OK is sufficient for load balancer routing. Deep checks should be on a separate `/health/deep` endpoint.

## Monitoring Checks

### Verify Application Insights is Connected

App settings are not reliably queryable via Resource Graph. Use Azure CLI directly:

```bash
az webapp config appsettings list \
  --name <app-name> \
  --resource-group <rg> \
  --query "[?contains(name, 'APPINSIGHTS') || contains(name, 'APPLICATIONINSIGHTS')].{name:name}" -o table
```

For Function Apps:
```bash
az functionapp config appsettings list \
  --name <app-name> \
  --resource-group <rg> \
  --query "[?contains(name, 'APPINSIGHTS') || contains(name, 'APPLICATIONINSIGHTS')].{name:name}" -o table
```

To check across all apps in a resource group:
```bash
# List all web/function apps, then check each
az graph query -q "
Resources
| where type =~ 'microsoft.web/sites'
| project name, resourceGroup, kind
" -o tsv | while read name rg kind; do
  echo "=== $name ==="
  az webapp config appsettings list --name "$name" --resource-group "$rg" \
    --query "[?contains(name, 'APPINSIGHTS')].name" -o tsv 2>/dev/null
done
```

## Reporting

For the reliability checklist, mark the **Health Probe** column per resource:
- ✅ — health endpoint defined and (where applicable) Application Insights wired up
- ❌ — missing health endpoint or monitoring on a web-facing service
- `❌ (code-only fix)` — the resource is on **Flex Consumption (FC1)** or **Consumption (Y1)**, where `healthCheckPath` is not supported as an IaC property. The `/api/health` endpoint must be implemented in app code; do not patch the Bicep/Terraform `siteConfig.healthCheckPath`.
- — — not applicable for this resource type
