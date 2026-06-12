# Origin Groups and Origins

## Concepts

### Origin Group

An origin group is a collection of origins (backend servers) that serve the same content. Front Door load-balances across origins within a group and fails over when origins are unhealthy.

### Origin

An origin is a backend server or service that serves content. Origins can be:

| Origin Type | Example | Notes |
|-------------|---------|-------|
| App Service | `myapp.azurewebsites.net` | Most common; set origin host header |
| Storage (static website) | `myaccount.z13.web.core.windows.net` | Enable static website hosting first |
| Cloud Service | `myservice.cloudapp.net` | Legacy |
| Custom hostname | `api.contoso.com` | Any publicly reachable FQDN |
| Public IP | `20.30.40.50` | Direct IP addressing |
| Internal LB (Premium) | Private IP via Private Link | Requires Premium + Private Link |
| API Management | `myapim.azure-api.net` | Set correct origin host header |

## Origin Group Configuration

### Health Probes

Health probes verify origin availability. Configured at the origin group level.

| Parameter | Default | Range | Recommendation |
|-----------|---------|-------|----------------|
| Probe path | `/` | Any path | Use `/health` or `/healthz` |
| Probe protocol | HTTPS | HTTP, HTTPS | HTTPS for production |
| Probe method | HEAD | HEAD, GET | HEAD (lightweight) |
| Probe interval | 30 sec | 5-255 sec | 30 sec for most workloads |

```bash
az afd origin-group create \
  --origin-group-name myOriginGroup \
  --profile-name myFD -g myRG \
  --probe-request-type HEAD \
  --probe-protocol Https \
  --probe-path "/health" \
  --probe-interval-in-seconds 30 \
  --sample-size 4 \
  --successful-samples-required 3 \
  --additional-latency-in-milliseconds 50
```

### Load Balancing Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Sample size | Number of recent probe results to evaluate | 4 |
| Successful samples required | Min healthy probes in sample to mark origin healthy | 3 |
| Additional latency (ms) | Latency tolerance for routing to closest origin | 50 ms |

**How latency-based routing works:**
1. Front Door measures latency to all healthy origins from the edge POP
2. Origins within `additional-latency-in-milliseconds` of the fastest are in the "acceptable" pool
3. Traffic is distributed across the acceptable pool by weight
4. Higher latency tolerance → more origins in pool → better load distribution
5. Lower latency tolerance → fewer origins → more strict nearest-region routing

## Origin Configuration

### Creating an Origin

```bash
az afd origin create \
  --origin-name eastus-app \
  --origin-group-name myOriginGroup \
  --profile-name myFD -g myRG \
  --host-name "myapp-eastus.azurewebsites.net" \
  --origin-host-header "myapp-eastus.azurewebsites.net" \
  --http-port 80 \
  --https-port 443 \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled
```

### Origin Parameters

| Parameter | Purpose | Notes |
|-----------|---------|-------|
| `host-name` | Address FD connects to | FQDN or IP of the backend |
| `origin-host-header` | Host header sent to origin | Critical for App Service (must match app hostname) |
| `priority` | Failover order | 1-5; lower = preferred. Same priority = active-active |
| `weight` | Traffic distribution | 1-1000; relative within same priority |
| `http-port` | HTTP port | Default 80 |
| `https-port` | HTTPS port | Default 443 |

### Priority and Weight Explained

```
Origin Group
├── Priority 1 (primary)
│   ├── Origin A (weight: 750) → receives 75% of traffic
│   └── Origin B (weight: 250) → receives 25% of traffic
└── Priority 2 (failover, only when all Priority 1 unhealthy)
    └── Origin C (weight: 1000) → receives 100% of failover traffic
```

### Common Patterns

#### Active-Active (Equal Distribution)

```bash
# Both origins priority 1, equal weight
az afd origin create --origin-name eastus --priority 1 --weight 1000 ...
az afd origin create --origin-name westeu --priority 1 --weight 1000 ...
```

#### Active-Passive (Failover)

```bash
# Primary region, failover region
az afd origin create --origin-name primary --priority 1 --weight 1000 ...
az afd origin create --origin-name failover --priority 2 --weight 1000 ...
```

#### Weighted Distribution

```bash
# 80/20 traffic split
az afd origin create --origin-name primary --priority 1 --weight 800 ...
az afd origin create --origin-name secondary --priority 1 --weight 200 ...
```

#### Canary Deployment

```bash
# 95% to stable, 5% to canary
az afd origin create --origin-name stable --priority 1 --weight 950 ...
az afd origin create --origin-name canary --priority 1 --weight 50 ...
```

## Session Affinity

Session affinity ensures requests from the same user go to the same origin.

```bash
az afd origin-group update \
  --origin-group-name myOriginGroup \
  --profile-name myFD -g myRG \
  --enable-session-affinity true
```

**How it works**: Front Door sets a cookie (`AFDID`) on the first response. Subsequent requests with this cookie route to the same origin.

**When to use**: Stateful applications that store session data locally on the server. Prefer stateless architectures with external session stores when possible.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| All origins unhealthy | Probe path returns non-200 | Fix health endpoint; verify probe path and protocol |
| Traffic goes to wrong region | Latency tolerance too high | Reduce `additional-latency-in-milliseconds` |
| App Service returns 404 | Wrong origin host header | Set `origin-host-header` to match App Service hostname |
| Failover not working | Priority not configured | Ensure primary = priority 1, secondary = priority 2 |
| Uneven traffic distribution | Weight imbalance | Adjust weights proportionally |

## Source Documentation

- [Origins and origin groups](https://learn.microsoft.com/azure/frontdoor/origin)
- [Health probes](https://learn.microsoft.com/azure/frontdoor/health-probes)
- [Traffic routing methods](https://learn.microsoft.com/azure/frontdoor/routing-methods)
