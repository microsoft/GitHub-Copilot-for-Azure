# Health Probe Configuration and Troubleshooting

## Probe Types

| Protocol | Port | Path | When to Use |
|----------|------|------|-------------|
| TCP | Required | N/A | Simple port availability check; any TCP service |
| HTTP | Required | Required (default: `/`) | Web servers; custom health endpoint validation |
| HTTPS | Required | Required (default: `/`) | Encrypted health endpoints; certificate validation |

## Probe Configuration Parameters

| Parameter | Default | Range | Recommendation |
|-----------|---------|-------|----------------|
| Interval | 5 sec | 5-2,000,000 sec | 5-15 seconds for most workloads |
| Unhealthy threshold | 2 | 1-100 | 2-3 for production; lower = faster failover but more false positives |
| Port | (rule port) | 1-65535 | Use dedicated health port if app port may be busy |
| Path (HTTP/S) | `/` | Any valid path | Use a dedicated `/health` or `/healthz` endpoint |

### Probe Behavior

- **Probe source IP**: All probes originate from `168.63.129.16` (Azure infrastructure IP). Backend NSGs and host firewalls MUST allow this.
- **Healthy → Unhealthy**: Backend is removed from rotation after `unhealthyThreshold` consecutive failures.
- **Unhealthy → Healthy**: Backend is added back after ONE successful probe response.
- **All backends unhealthy**: LB sends traffic to ALL backends (fail-open behavior) — this is by design to prevent total outage.
- **HTTP response**: 200 OK is the only successful response. Any other status code = probe failure.

## Creating Health Probes

### TCP Probe

```bash
az network lb probe create \
  --lb-name myLB \
  --resource-group myRG \
  --name tcpProbe \
  --protocol Tcp \
  --port 443 \
  --interval 5 \
  --probe-threshold 2
```

### HTTP Probe with Custom Path

```bash
az network lb probe create \
  --lb-name myLB \
  --resource-group myRG \
  --name httpProbe \
  --protocol Http \
  --port 80 \
  --request-path "/health" \
  --interval 10 \
  --probe-threshold 2
```

### HTTPS Probe

```bash
az network lb probe create \
  --lb-name myLB \
  --resource-group myRG \
  --name httpsProbe \
  --protocol Https \
  --port 443 \
  --request-path "/healthz" \
  --interval 15 \
  --probe-threshold 3
```

## Designing Health Endpoints

### Best Practices for HTTP(S) Health Probes

1. **Dedicated health path** — Use `/health` or `/healthz`, not `/` (homepage may be slow or cached).
2. **Check dependencies** — Health endpoint should verify database, cache, and critical dependencies.
3. **Fast response** — Target < 200ms response time. LB expects timely responses.
4. **Return 200 only when healthy** — Return 503 or other error codes to signal unhealthy.
5. **No authentication** — Health probe path must be accessible without auth (probe has no credentials).
6. **Lightweight** — Avoid heavy computation or database queries in the health check hot path.

### Example Health Endpoint (Application-level)

```
GET /health → 200 OK  (app + dependencies healthy)
GET /health → 503     (app or dependency unhealthy)
```

## Troubleshooting Unhealthy Backends

### Step 1: Verify Probe Configuration

```bash
# Show all probes for a load balancer
az network lb probe list --lb-name <lb> -g <rg> -o table

# Show specific probe
az network lb probe show --lb-name <lb> -g <rg> --name <probe>
```

### Step 2: Check NSG Rules

The probe source IP `168.63.129.16` must be allowed inbound on the probe port.

```bash
# List NSGs on backend subnet
az network nsg list -g <rg> -o table

# Check for rules allowing health probe traffic
az network nsg rule list --nsg-name <nsg> -g <rg> \
  --query "[?direction=='Inbound' && (sourceAddressPrefix=='AzureLoadBalancer' || sourceAddressPrefix=='168.63.129.16')]" \
  -o table
```

### Step 3: Test from Backend VM

SSH/RDP into a backend VM and test locally:

```bash
# Test TCP port (from the VM itself)
nc -zv localhost 80
# or
curl -v http://localhost/health

# Test if firewall allows probe IP
sudo iptables -L -n | grep 168.63.129.16
```

### Step 4: Check Application Logs

If the probe is HTTP(S), check the web server access logs for requests from `168.63.129.16`.

### Step 5: Review Load Balancer Metrics

```bash
# Health probe status (per backend)
az monitor metrics list \
  --resource <lb-resource-id> \
  --metric "DipAvailability" \
  --aggregation Average \
  --interval PT1M
```

In Azure Portal: Load Balancer → Metrics → "Health Probe Status" → Split by BackendIPAddress.

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| All backends unhealthy | NSG blocking probe IP | Add inbound rule for `AzureLoadBalancer` service tag |
| All backends unhealthy | App not listening on probe port | Verify app binds to `0.0.0.0:<port>`, not `127.0.0.1` |
| Intermittent unhealthy | App responding slowly | Optimize health endpoint; increase probe interval |
| Single backend unhealthy | App crash or resource exhaustion | Check VM application logs, CPU/memory |
| HTTP probe fails, TCP works | App returns non-200 status | Fix health endpoint to return 200 when healthy |
| Probe works but no traffic | Load balancing rule not linked to probe | Verify rule references the correct probe name |
| Probes from wrong IP | UDR redirecting probe traffic | Ensure no UDR overrides route for 168.63.129.16 |

## Source Documentation

- [Azure Load Balancer health probes](https://learn.microsoft.com/azure/load-balancer/load-balancer-custom-probe-overview)
- [Troubleshoot Azure Load Balancer health probe status](https://learn.microsoft.com/azure/load-balancer/load-balancer-troubleshoot-health-probe-status)
- [What is IP address 168.63.129.16?](https://learn.microsoft.com/azure/virtual-network/what-is-ip-address-168-63-129-16)
