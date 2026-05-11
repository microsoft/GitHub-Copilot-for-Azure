# Configure Health Probes

## Overview

Health probes enable the platform and load balancers to detect unhealthy instances and route traffic away from them. Every production app should have a health endpoint.

## Azure Functions / App Service

### ⚠️ Plan Compatibility

App Service Health Check is only supported on certain plans:
- **Premium (EP1-EP3):** ✅ Supported
- **Dedicated (App Service plan):** ✅ Supported
- **Flex Consumption:** ❌ Not supported — use app-level health endpoint only (no platform health check)
- **Consumption:** ❌ Not supported — use app-level health endpoint only

For **Flex Consumption / Consumption plans:** Skip the `az webapp config set` step below. There is no platform health check to configure; the only remediation is to add a `/api/health` HTTP endpoint **in your function code**, which can be used by Front Door or Traffic Manager for external health probing.

### ⛔ STOP — Confirm Before Adding HTTP-Trigger Health Endpoint (FC1 / Consumption)

Adding a health endpoint on FC1 / Consumption is **not an IaC patch** — it requires **adding a new HTTP-triggered function to the user's code**. Do **not** generate or modify code without explicit consent.

Before touching any source files, ask the user:

```
⚠️ This Function App is on Flex Consumption (FC1).
   The platform `healthCheckPath` setting is not supported on this plan, so the only way
   to enable health probing is to add an HTTP-triggered `/api/health` function to your code.

   This means I would:
     • Add a new HTTP trigger (anonymous, GET) returning 200 OK
     • Touch your source code (not just IaC)
     • Require a redeploy (`func azure functionapp publish` or `azd deploy`)

   Do you want me to add the `/api/health` HTTP trigger to your function app code? (yes/no)
```

Proceed only on an explicit **yes**. If the user says no:
- Leave the code untouched
- Leave the IaC untouched (do **not** add `healthCheckPath` — it's unsupported on FC1)
- Note in the assessment that this row remains `❌ (code-only fix — declined)` and continue with other patches

If the user says yes:
1. Detect the function app's language by inspecting the project (look for `host.json`, `requirements.txt`, `package.json`, `*.csproj`, `pom.xml`)
2. Add the matching minimal HTTP trigger from the language-specific snippets below
3. Tell the user which file(s) you added/edited and that they must redeploy

### Enable Health Check (Premium / Dedicated only)

⚠️ **Warning:** Changing the health check configuration will **restart the app**. Confirm with user before proceeding on production apps.

```bash
# Set health check path
az webapp config set \
  --name <app-name> \
  --resource-group <rg> \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

### Verify

```bash
az webapp show \
  --name <app-name> \
  --resource-group <rg> \
  --query "siteConfig.healthCheckPath"
```

### What the Health Endpoint Should Do

Minimal health endpoint (just confirms app is running):

**Python (Azure Functions):**
```python
import azure.functions as func

app = func.FunctionApp()

@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("OK", status_code=200)
```

**JavaScript/TypeScript (Azure Functions):**
```typescript
import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
        return { status: 200, body: "OK" };
    }
});
```

**C# (Azure Functions):**
```csharp
[Function("health")]
public HttpResponseData Health(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
{
    var response = req.CreateResponse(HttpStatusCode.OK);
    response.WriteString("OK");
    return response;
}
```

### Health Check Behavior (Premium / Dedicated)

When health check is configured:
- Platform pings the path every **1 minute** per instance
- If an instance accumulates **10 failed requests** (configurable 2-10 via `WEBSITE_HEALTHCHECK_MAXPINGFAILURES`), it's marked unhealthy
- Unhealthy instances are removed from load balancer rotation after **2 consecutive failures**
- Persistently unhealthy instances are replaced after **1 hour**

```bash
# Optionally tune failure threshold (default: 10, range: 2-10)
az webapp config appsettings set \
  --name <app-name> \
  --resource-group <rg> \
  --settings "WEBSITE_HEALTHCHECK_MAXPINGFAILURES=5"
```

## Azure Container Apps

### Add Liveness + Readiness Probes

```bash
# Update container app with probes via YAML
az containerapp update \
  --name <app-name> \
  --resource-group <rg> \
  --yaml probes.yaml
```

**probes.yaml:**
```yaml
properties:
  template:
    containers:
      - name: <container-name>
        probes:
          - type: liveness
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          - type: readiness
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
            failureThreshold: 3
```

### Probe Types

| Probe | Purpose | If fails |
|---|---|---|
| **Liveness** | Is the container alive? | Container is restarted |
| **Readiness** | Can it serve traffic? | Removed from load balancer (not restarted) |
| **Startup** | Has it finished starting? | Liveness/readiness checks paused until startup passes |

### Verify

```bash
az containerapp show \
  --name <app-name> \
  --resource-group <rg> \
  --query "properties.template.containers[0].probes"
```

## Best Practices

1. **Keep health endpoints lightweight** — return 200 quickly, don't do heavy DB queries
2. **Use anonymous auth** — health probes can't pass auth tokens
3. **Both liveness + readiness for Container Apps** — liveness alone isn't enough
4. **Test the health endpoint** — `curl https://<app-url>/api/health`
5. **Don't include health endpoints in trigger-based Functions** — only HTTP-triggered apps need explicit health endpoints; timer/queue-triggered apps rely on platform health monitoring
