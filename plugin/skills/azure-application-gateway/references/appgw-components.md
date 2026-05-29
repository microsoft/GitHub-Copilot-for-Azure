# Application Gateway Components — How They Connect

## Component Relationship Flow

```
Client Request
    │
    ▼
Frontend IP (public/private)
    │
    ▼
Listener (port + protocol + hostname)
    │
    ▼
Request Routing Rule
    ├── Basic Rule → Backend Pool + HTTP Settings
    └── Path-based Rule → URL Path Map
                            ├── /api/* → API Pool + API Settings
                            ├── /images/* → Static Pool + Static Settings
                            └── default → Default Pool + Default Settings
    │
    ▼ (optionally through)
Rewrite Rules (modify headers/URL before sending to backend)
    │
    ▼
Health Probe verifies backend → Backend Pool member
```

## Frontend IP Configurations

### Public Frontend

Required for internet-facing applications.

```bash
# Create Standard public IP (required for v2)
az network public-ip create \
  --name appgw-pip \
  -g myRG \
  --sku Standard \
  --allocation-method Static

# Associate during gateway creation
az network application-gateway create \
  --name myAppGw -g myRG \
  --sku Standard_v2 \
  --public-ip-address appgw-pip \
  --vnet-name myVNet \
  --subnet AppGwSubnet
```

### Private Frontend (v2 Only)

For internal-only applications (no internet exposure).

```bash
# Add private frontend IP
az network application-gateway frontend-ip create \
  --gateway-name myAppGw -g myRG \
  --name privateFrontEnd \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --private-ip-address 10.0.0.10
```

**Note**: v2 supports both public AND private frontends simultaneously. Listeners bind to a specific frontend IP.

## Listeners

Listeners accept incoming connections on a combination of frontend IP, port, protocol, and (optionally) hostname.

### Basic HTTP Listener

```bash
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name httpListener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port 80
```

### Multi-Site HTTPS Listener

```bash
# Add frontend port for HTTPS
az network application-gateway frontend-port create \
  --gateway-name myAppGw -g myRG \
  --name port443 --port 443

# Create listener with hostname and SSL cert
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name contoso-https \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port443 \
  --ssl-cert contoso-cert \
  --host-name "www.contoso.com"
```

### Multi-Site Hosting

Multiple listeners can share the same frontend IP and port by specifying different hostnames:

| Listener | Frontend IP | Port | Hostname | SSL Cert |
|----------|------------|------|----------|----------|
| contoso-https | Public | 443 | www.contoso.com | contoso-cert |
| fabrikam-https | Public | 443 | www.fabrikam.com | fabrikam-cert |
| wildcard-https | Public | 443 | *.contoso.com | wildcard-cert |

## Backend Pools

Backend pools define the targets that serve requests.

### Supported Backend Types

| Type | Example | Notes |
|------|---------|-------|
| VM NIC | `10.0.1.4` | IP address of VM |
| VMSS | Instance IPs | Requires IP-based pool |
| App Service | `myapp.azurewebsites.net` | FQDN; requires custom probe with hostname |
| External | `api.partner.com` | Any reachable FQDN or IP |
| Private Endpoint | Private IP | Via VNet integration |

```bash
# Create pool with IP addresses
az network application-gateway address-pool create \
  --gateway-name myAppGw -g myRG \
  --name webPool \
  --servers 10.0.1.4 10.0.1.5 10.0.1.6

# Create pool with FQDN (App Service)
az network application-gateway address-pool create \
  --gateway-name myAppGw -g myRG \
  --name appServicePool \
  --servers myapp.azurewebsites.net
```

## HTTP Settings

HTTP settings define how Application Gateway communicates with backends.

| Setting | Purpose | Common Values |
|---------|---------|---------------|
| Port | Backend port | 80, 443, 8080 |
| Protocol | HTTP or HTTPS | Use HTTPS for end-to-end encryption |
| Cookie affinity | Session stickiness | Enabled/Disabled |
| Connection draining | Graceful removal | Enabled, 30-3600 sec |
| Request timeout | Backend response timeout | 1-86400 sec (default 20) |
| Override hostname | Rewrite Host header | Required for App Service backends |
| Custom probe | Associated health probe | Always configure for production |
| Trusted root cert | Backend SSL verification | Required for end-to-end HTTPS with self-signed certs |

```bash
# HTTPS backend settings with App Service hostname override
az network application-gateway http-settings create \
  --gateway-name myAppGw -g myRG \
  --name appServiceSettings \
  --port 443 \
  --protocol Https \
  --cookie-based-affinity Disabled \
  --timeout 30 \
  --host-name-from-backend-pool true
```

## Health Probes

### Default Probe

If no custom probe is configured, Application Gateway sends probes to `http://127.0.0.1:<port>/` using the backend HTTP settings. This rarely works for real applications.

### Custom Probe

```bash
az network application-gateway probe create \
  --gateway-name myAppGw -g myRG \
  --name customProbe \
  --protocol Https \
  --host-name-from-http-settings true \
  --path "/health" \
  --interval 30 \
  --threshold 3 \
  --timeout 30 \
  --match-status-codes "200-399"
```

### Probe Parameters

| Parameter | Description | Recommendation |
|-----------|-------------|----------------|
| `path` | URL path to probe | Use `/health` or `/healthz` |
| `interval` | Seconds between probes | 30 for most workloads |
| `threshold` | Failed probes before marking unhealthy | 3 |
| `timeout` | Seconds to wait for response | Match or exceed app response time |
| `match-status-codes` | HTTP codes considered healthy | `200-399` for most apps |
| `host-name-from-http-settings` | Use Host header from HTTP settings | `true` for App Service backends |

## Request Routing Rules

### Basic Rule

Direct mapping: Listener → one backend pool + HTTP settings.

```bash
az network application-gateway rule create \
  --gateway-name myAppGw -g myRG \
  --name basicRule \
  --rule-type Basic \
  --http-listener httpListener \
  --address-pool webPool \
  --http-settings defaultSettings \
  --priority 100
```

### Path-Based Rule

Routes to different backends based on URL path.

```bash
az network application-gateway rule create \
  --gateway-name myAppGw -g myRG \
  --name pathRule \
  --rule-type PathBasedRouting \
  --http-listener httpListener \
  --url-path-map myPathMap \
  --priority 200
```

**Note (v2)**: All rules require a `--priority` value. Lower numbers = higher priority.

## Troubleshooting Component Issues

| Symptom | Component to Check | Action |
|---------|-------------------|--------|
| 502 Bad Gateway | Backend health | `az network application-gateway show-backend-health` |
| 404 Not Found | URL path map / routing rule | Verify path patterns match request URLs |
| SSL errors | Listener certificate | Check cert validity, chain, and Key Vault access |
| Slow response | HTTP settings timeout | Increase timeout; check backend performance |
| Wrong backend | Routing rule priority | Lower priority number wins; check rule ordering |
| Session not sticky | HTTP settings | Enable cookie-based affinity |

## Source Documentation

- [Application Gateway components](https://learn.microsoft.com/azure/application-gateway/application-gateway-components)
- [Application Gateway configuration overview](https://learn.microsoft.com/azure/application-gateway/configuration-overview)
- [Troubleshoot backend health](https://learn.microsoft.com/azure/application-gateway/application-gateway-backend-health-troubleshooting)
