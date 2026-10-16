# Traffic Manager Health Checks

Traffic Manager uses continuous health probing to determine which endpoints are healthy and eligible to receive traffic. Understanding the probe mechanism is critical for configuring reliable failover and minimizing downtime.

---

## Health Probe Mechanism

Traffic Manager sends periodic health probes to each endpoint from multiple Azure data center locations worldwide. If an endpoint fails to respond correctly within the configured thresholds, Traffic Manager marks it as Degraded and removes it from DNS responses.

### Probe Flow

1. Traffic Manager sends a probe request (HTTP GET, HTTPS GET, or TCP connection) to the endpoint.
2. The endpoint must respond within the configured timeout period.
3. For HTTP/HTTPS probes, the response status code must be in the acceptable range (200–299 by default).
4. If the probe fails, Traffic Manager increments a failure counter for that endpoint.
5. After exceeding the tolerated failure count, Traffic Manager marks the endpoint as Degraded.
6. Once Degraded, the endpoint is removed from DNS responses.
7. Traffic Manager continues probing the Degraded endpoint. When it passes probes again, it transitions back to Online.

---

## Protocol Options

### HTTP Probes

- Traffic Manager sends an HTTP GET request to the configured path and port.
- Expects an HTTP 200–299 status code by default.
- Use for standard web applications that do not require encryption.
- Probe path example: `/health` or `/api/healthcheck`.

### HTTPS Probes

- Identical to HTTP probes but over TLS/SSL.
- The endpoint must present a valid TLS certificate from a trusted CA — self-signed certificates will cause probe failures.
- Traffic Manager does NOT validate the certificate's hostname against the endpoint FQDN; it only validates the trust chain.
- **Recommended for production** — most web applications should use HTTPS probes.

### TCP Probes

- Traffic Manager attempts a TCP connection to the configured port.
- Success = TCP connection established (SYN-ACK received).
- Use for non-HTTP services: databases, message queues, custom TCP services.
- TCP probes do not check response content — only connectivity.

```bash
# HTTP probe
az network traffic-manager profile create -g MyRG -n HttpProfile \
  --routing-method Priority --unique-dns-name myapp-http \
  --protocol HTTP --port 80 --path /health

# HTTPS probe (recommended)
az network traffic-manager profile create -g MyRG -n HttpsProfile \
  --routing-method Priority --unique-dns-name myapp-https \
  --protocol HTTPS --port 443 --path /health

# TCP probe (non-HTTP services)
az network traffic-manager profile create -g MyRG -n TcpProfile \
  --routing-method Priority --unique-dns-name myapp-tcp \
  --protocol TCP --port 3306
```

---

## Custom Headers

You can add custom HTTP headers to health probe requests. This is essential for endpoints that use host-based routing or require specific headers for health checks.

### Host Header for Shared Hosting

If multiple applications share the same IP address (e.g., App Service with custom domains), the health probe must include the correct Host header:

```bash
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --custom-headers host=myapp.contoso.com
```

### Multiple Custom Headers

Add multiple headers for specialized health check endpoints:

```bash
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --custom-headers host=myapp.contoso.com x-health-check=traffic-manager
```

### Common Custom Header Use Cases

| Header | Purpose |
|--------|---------|
| `Host: myapp.contoso.com` | Target specific app on shared hosting |
| `X-Health-Check: traffic-manager` | Identify probe source in application logs |
| `Authorization: Bearer <token>` | Authenticate probes to protected health endpoints |

---

## Expected Status Codes

By default, Traffic Manager considers HTTP 200–299 as healthy. You can configure custom acceptable status code ranges:

```bash
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --status-code-ranges 200-299 301
```

### Common Configurations

| Scenario | Status Codes | Reason |
|----------|-------------|--------|
| Standard web app | 200–299 (default) | Normal healthy response |
| App with redirects | 200–299, 301, 302 | Health path redirects to login page |
| API with custom codes | 200 | Strict — only explicit 200 is healthy |

> **Note**: 3xx redirects are NOT followed by Traffic Manager. If the health path returns a 301 redirect, you must either include 301 in acceptable codes or change the health path to return 200 directly.

---

## Probe Path Design

The health probe path (`--path`) determines what URL Traffic Manager checks. A well-designed health endpoint goes beyond "is the web server running" and verifies the application is actually functional.

### Recommended Health Check Layers

```
Level 1 — Shallow: /health → Returns 200 if the process is running
Level 2 — Medium:  /health → Checks database connectivity, returns 200 if connected
Level 3 — Deep:    /health → Checks database + downstream APIs + cache, returns 200 if all healthy
```

### Guidelines

- **Use a dedicated health endpoint** — don't use `/` (home page) because it may return 200 even when backend services are down.
- **Check critical dependencies** — if the app needs a database, the health check should verify database connectivity.
- **Don't check non-critical dependencies** — a slow logging service should not make the health check fail.
- **Return quickly** — the health endpoint should respond within 2–3 seconds. Long-running checks may cause timeouts.
- **Use GET, not POST** — Traffic Manager sends HTTP GET requests for health probes.
- **Return appropriate status codes** — 200 for healthy, 503 for unhealthy.

### Example Health Endpoint (ASP.NET)

```csharp
app.MapGet("/health", async (DbContext db) =>
{
    try
    {
        await db.Database.CanConnectAsync();
        return Results.Ok(new { status = "healthy" });
    }
    catch
    {
        return Results.StatusCode(503);
    }
});
```

---

## Failover Timing

Failover time is the total elapsed time from when an endpoint goes down to when DNS queries are routed to a different endpoint.

### Calculation Formula

```
Failover time = (Probe interval × Tolerated failures) + Probe interval + DNS TTL

Components:
  - Detection:  Probe interval × Tolerated failures  (time to confirm failure)
  - Propagation: Probe interval                       (next probe cycle to update)
  - DNS cache:   DNS TTL                               (clients cache old DNS response)
```

### Configuration Scenarios

| Config | Interval | Failures | TTL | Failover Time |
|--------|----------|----------|-----|---------------|
| Default | 30s | 3 | 60s | (30×3)+30+60 = **180s (3 min)** |
| Fast | 10s | 1 | 30s | (10×1)+10+30 = **50s** |
| Aggressive | 10s | 0 | 10s | (10×0)+10+10 = **20s** |
| Conservative | 30s | 5 | 120s | (30×5)+30+120 = **300s (5 min)** |

### Fast Failover Configuration

For the fastest failover (with increased probe cost):

```bash
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --interval 10 --timeout 5 --tolerated-failures 1
az network traffic-manager profile update -g MyRG -n MyTMProfile --ttl 30
```

> **Trade-off**: Faster detection means more probe traffic and more DNS queries. The 10s interval with 0 tolerated failures is aggressive and may cause false positives from transient issues.

---

## Endpoint Monitor Status State Machine

Endpoints transition through states based on health probe results:

```
                  ┌─────────────────┐
                  │ CheckingEndpoint │  ← Initial state / re-enabled
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            │            ▼
        ┌──────────┐      │     ┌────────────┐
        │  Online  │◄─────┘     │  Degraded  │
        └────┬─────┘            └─────┬──────┘
             │                        │
             │  Probe failures        │  Probe successes
             │  exceed threshold      │  resume
             │                        │
             └───────►Degraded────────┘
                         │
                    ┌────┴────┐
                    │ Stopped │  ← Resource stopped (App Service, etc.)
                    └─────────┘
```

### State Descriptions

| State | Probes Sent? | In DNS? | Trigger |
|-------|-------------|---------|---------|
| CheckingEndpoint | Yes | Sometimes | Endpoint just created, re-enabled, or profile restarted |
| Online | Yes | Yes | Probes succeeding within thresholds |
| Degraded | Yes | No (unless all degraded) | Probe failures exceed tolerated count |
| Disabled | No | No | Admin manually disabled |
| Stopped | No | No | Underlying Azure resource is stopped |
| Inactive | No | No | Profile disabled or endpoint misconfigured |

---

## Cascading Failures in Nested Profiles

In nested profile configurations, health status cascades from inner to outer profiles:

1. **Inner profile** probes each child endpoint directly.
2. If healthy child endpoints drop below `MinChildEndpoints`, the inner profile is considered unhealthy.
3. **Outer profile** detects the nested endpoint as Degraded and stops routing traffic to it.
4. Traffic shifts to the next outer-level endpoint.

### Example Cascade

```
Outer Profile (Priority routing)
├── Priority 1: Inner Profile East US (MinChildEndpoints=2)
│   ├── App Service A — Online ✓
│   ├── App Service B — Degraded ✗
│   └── App Service C — Degraded ✗
│   → Only 1 healthy (A) < MinChildEndpoints (2) → Outer marks East US as Degraded
├── Priority 2: Inner Profile West US (MinChildEndpoints=1)
│   ├── App Service D — Online ✓
│   └── App Service E — Online ✓
│   → 2 healthy ≥ MinChildEndpoints (1) → Outer routes traffic here
```

---

## Health Check Source IPs

Traffic Manager probes originate from Azure data center IP addresses. These IPs are published under the **AzureTrafficManager** service tag.

### Allowing Probe Traffic Through Firewalls

```bash
# Download the service tag list to find Traffic Manager IP ranges
az network list-service-tags --location eastus --query "values[?name=='AzureTrafficManager'].properties.addressPrefixes" -o tsv
```

Add these IP ranges to your firewall allow list for the configured probe port.

---

## Troubleshooting

### Endpoint Shows Degraded but Application Is Healthy

**Cause 1: Probe path returns non-200 status code**
```bash
# Test what the probe path returns
curl -v https://myapp.azurewebsites.net/health
# Verify status code is 200-299
```

**Cause 2: Wrong port or protocol configured**
```bash
# Check current profile probe settings
az network traffic-manager profile show -g MyRG -n MyTMProfile \
  --query monitorConfig
```

**Cause 3: Probe timeout too short**
If your health endpoint is slow (checking database, downstream services), increase the timeout or optimize the health check.

**Cause 4: SSL certificate issues**
HTTPS probes require a valid TLS certificate from a trusted CA. Self-signed certificates or expired certificates will fail probes.

### Firewall Blocking Traffic Manager Probe IPs

**Symptoms**: Endpoint shows Degraded immediately after creation. Application responds correctly when accessed directly.

**Fix**: Add Azure Traffic Manager probe IPs to the firewall allow list for the probe port (typically 80 or 443). Use the `AzureTrafficManager` service tag.

```bash
# NSG rule to allow Traffic Manager probes
az network nsg rule create -g MyRG --nsg-name MyNSG \
  -n AllowTrafficManagerProbes --priority 100 \
  --source-address-prefixes AzureTrafficManager \
  --destination-port-ranges 443 --protocol Tcp --access Allow
```

### Probe Path Returning Wrong Status Code

**Symptoms**: Endpoint alternates between Online and Degraded, or is persistently Degraded.

**Diagnosis**:
```bash
# Check what status code the probe path returns
curl -s -o /dev/null -w "%{http_code}" https://myapp.azurewebsites.net/health
# If it returns 301, 302, 403, or 500 — that's the problem
```

**Fixes**:
- Change the probe path to one that returns 200.
- Add the returned status code to the acceptable range: `--status-code-ranges 200-299 301`.
- Fix the application health endpoint to return 200 when healthy.

### SSL Certificate Issues with HTTPS Probes

**Symptoms**: Endpoint shows Degraded. Switching to HTTP probes resolves the issue.

**Common causes**:
- Self-signed certificate on the endpoint.
- Expired TLS certificate.
- Intermediate CA certificate missing from the chain.
- Certificate issued for a different hostname (Traffic Manager does not enforce hostname matching but the TLS handshake may fail if the server requires SNI).

**Fix**: Install a valid certificate from a trusted CA (Let's Encrypt, DigiCert, etc.) with a complete certificate chain.

### Endpoint Flapping Between Online and Degraded

**Symptoms**: Endpoint status changes frequently, causing intermittent routing changes.

**Common causes**:
1. **Health endpoint is slow**: Response time occasionally exceeds probe timeout.
   - Fix: Optimize health endpoint or increase timeout (max 10s).
2. **Tolerated failures too low**: Single transient failure causes Degraded status.
   - Fix: Increase `--tolerated-failures` to 2 or 3.
3. **Intermittent dependency failure**: Health check depends on a flaky downstream service.
   - Fix: Remove non-critical dependency checks from the health endpoint.

```bash
# Increase resilience to transient failures
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --timeout 10 --tolerated-failures 3
```
