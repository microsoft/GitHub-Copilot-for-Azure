---
name: azure-application-gateway
description: "Create, configure, and troubleshoot Azure Application Gateway v2 for Layer 7 HTTP/HTTPS load balancing, URL-based routing, SSL/TLS termination, cookie-based affinity, header rewrites, and redirects. Includes WAF v2 integration for web application protection. WHEN: application gateway, app gateway, L7 load balancer, URL routing, path-based routing, SSL offload, SSL termination, web traffic load balancer, cookie affinity, redirect, rewrite headers, autoscale gateway, HTTP load balancing, multi-site hosting. DO NOT USE FOR: L4 TCP/UDP balancing (use azure-load-balancer), global edge routing or CDN (use azure-front-door), standalone WAF policy authoring (use azure-waf)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Application Gateway

## When to Use This Skill

- User asks about creating or configuring an Azure Application Gateway
- User needs Layer 7 (HTTP/HTTPS) load balancing within a region
- User wants URL-based or path-based routing (e.g., `/images/*` → one backend, `/api/*` → another)
- User needs SSL/TLS termination or end-to-end SSL encryption
- User asks about multi-site hosting (multiple domains on one gateway)
- User wants cookie-based session affinity
- User needs HTTP-to-HTTPS redirect configuration
- User asks about header rewrite rules or URL rewrite
- User wants to enable WAF (Web Application Firewall) on the gateway
- User needs autoscaling for the application gateway
- User asks about mutual TLS (mTLS) or client certificate authentication
- User needs to troubleshoot 502 Bad Gateway or backend health issues

## Rules

1. **Always recommend v2 SKU** — v1 is legacy. Application Gateway v2 supports autoscaling, zone redundancy, static VIP, Key Vault certificate integration, and improved performance.
2. **Dedicated subnet required** — Application Gateway must be deployed in its own subnet (named conventionally `AppGwSubnet`). No other resources allowed in this subnet except other App Gateways.
3. **Minimum subnet size** — Recommend /24 for production. Minimum is /26 for v2 (includes instances + private frontend IP + internal overhead).
4. **Frontend IP** — v2 supports both public and private frontend IPs simultaneously. Static public IP (Standard SKU) is required.
5. **Backend pool targets** — Can include VMs, VMSS, App Services, IP addresses, or FQDNs. Backends can be in different VNets (with peering) or external.
6. **Health probes are critical** — Always configure custom health probes with appropriate paths. Default probe (`/`) may not reflect real application health.
7. **WAF integration** — WAF v2 is a SKU tier on Application Gateway (WAF_v2), not a separate resource. It adds a WAF policy with OWASP rule sets.
8. **SSL certificates** — Recommend Key Vault integration for certificate management. Self-managed PFX upload also supported.
9. **For global routing, use Front Door** — Application Gateway is regional. For multi-region global HTTP routing, CDN, or edge WAF, redirect to azure-front-door.
10. **For L4 balancing, use Load Balancer** — If the user needs TCP/UDP (non-HTTP) balancing, redirect to azure-load-balancer.

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__network` | `application_gateway_list` | List all application gateways in a subscription/resource group |
| `azure__network` | `application_gateway_get` | Get detailed configuration of a specific application gateway |

## CLI Fallback

When MCP tools are unavailable, use these Azure CLI commands:

```bash
# List application gateways
az network application-gateway list --resource-group <rg> -o table

# Show application gateway details
az network application-gateway show --name <appgw> -g <rg>

# Create Application Gateway v2 (basic)
az network application-gateway create \
  --name myAppGw \
  --resource-group myRG \
  --sku Standard_v2 \
  --capacity 2 \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --public-ip-address myAppGwPIP \
  --frontend-port 80 \
  --http-settings-port 80 \
  --http-settings-protocol Http \
  --routing-rule-type Basic

# Create with WAF v2
az network application-gateway create \
  --name myWafAppGw \
  --resource-group myRG \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --public-ip-address myWafPIP

# Configure autoscaling
az network application-gateway update \
  --name myAppGw -g myRG \
  --set autoscaleConfiguration.minCapacity=2 \
  --set autoscaleConfiguration.maxCapacity=10 \
  --set sku.capacity=null

# Add a backend pool
az network application-gateway address-pool create \
  --gateway-name myAppGw -g myRG \
  --name apiBackendPool \
  --servers 10.0.1.4 10.0.1.5

# Add an HTTP setting
az network application-gateway http-settings create \
  --gateway-name myAppGw -g myRG \
  --name apiHttpSettings \
  --port 443 \
  --protocol Https \
  --cookie-based-affinity Enabled \
  --timeout 30

# Add a health probe
az network application-gateway probe create \
  --gateway-name myAppGw -g myRG \
  --name apiProbe \
  --protocol Https \
  --host-name-from-http-settings true \
  --path "/health" \
  --interval 30 \
  --threshold 3 \
  --timeout 30

# Add a URL path map (path-based routing)
az network application-gateway url-path-map create \
  --gateway-name myAppGw -g myRG \
  --name myPathMap \
  --default-address-pool defaultPool \
  --default-http-settings defaultSettings \
  --paths "/api/*" \
  --address-pool apiBackendPool \
  --http-settings apiHttpSettings \
  --rule-name apiPathRule

# Add a redirect configuration
az network application-gateway redirect-config create \
  --gateway-name myAppGw -g myRG \
  --name httpToHttpsRedirect \
  --type Permanent \
  --target-listener httpsListener \
  --include-path true \
  --include-query-string true

# Add a rewrite rule set
az network application-gateway rewrite-rule set create \
  --gateway-name myAppGw -g myRG \
  --name myRewriteRuleSet

# Show backend health
az network application-gateway show-backend-health \
  --name myAppGw -g myRG
```

## Key Concepts

### Application Gateway Components

| Component | Purpose | Key Config |
|-----------|---------|------------|
| Frontend IP | Client-facing IP (public and/or private) | Static Standard public IP for v2 |
| Listener | Receives incoming requests on port/protocol | HTTP/HTTPS, multi-site (hostname) |
| Rule | Routes listener traffic to backend | Basic (direct) or Path-based |
| Backend Pool | Target servers/services | VMs, VMSS, App Service, IPs, FQDNs |
| HTTP Settings | Backend connection config | Port, protocol, cookie affinity, timeout |
| Health Probe | Backend health monitoring | Protocol, path, interval, threshold |
| URL Path Map | Path-based routing rules | Paths → backend pool + HTTP settings |
| Rewrite Rule | Modify headers/URL | Request/response headers, URL components |
| Redirect Config | HTTP redirect | Permanent/temporary, to listener or URL |
| WAF Policy | Web application firewall | OWASP rules, custom rules, exclusions |
| SSL Certificate | TLS termination | PFX upload or Key Vault reference |

### SKU Comparison

| Feature | Standard_v2 | WAF_v2 |
|---------|-------------|--------|
| L7 Load Balancing | ✅ | ✅ |
| Autoscaling | ✅ | ✅ |
| Zone Redundancy | ✅ | ✅ |
| Static VIP | ✅ | ✅ |
| Private Frontend | ✅ | ✅ |
| URL Routing | ✅ | ✅ |
| SSL Termination | ✅ | ✅ |
| Header Rewrites | ✅ | ✅ |
| WAF (OWASP rules) | ❌ | ✅ |
| Bot Protection | ❌ | ✅ |
| Custom WAF Rules | ❌ | ✅ |

## References

- [Application Gateway components explained](references/appgw-components.md)
- [URL and path-based routing](references/url-routing.md)
- [SSL/TLS configuration](references/ssl-tls.md)
- [Autoscaling configuration](references/autoscale.md)
- [WAF v2 integration](references/waf-integration.md)
