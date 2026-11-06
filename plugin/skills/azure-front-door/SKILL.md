---
name: azure-front-door
description: "Create, configure, and troubleshoot Azure Front Door Standard and Premium for global HTTP/HTTPS load balancing, CDN edge caching, SSL offload, rules engine, and Private Link origins. Includes WAF integration for edge protection. WHEN: front door, Azure Front Door, global load balancer, CDN, edge caching, global HTTP routing, content delivery, AFD, private link origin, rules engine, edge optimization, global acceleration, anycast, origin groups, cache purge, geo-filtering. DO NOT USE FOR: L4 TCP/UDP load balancing (use azure-load-balancer), regional-only L7 load balancing (use azure-application-gateway), DNS-only traffic routing (use azure-traffic-manager)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Front Door

## When to Use This Skill

- User asks about creating or configuring Azure Front Door (Standard or Premium)
- User needs global HTTP/HTTPS load balancing across multiple regions
- User wants CDN caching at edge locations for static or dynamic content
- User asks about origin groups, origins, and health probes for backend routing
- User needs rules engine for URL rewrite, redirect, or header modification
- User asks about Private Link origins for secure backend connectivity
- User wants WAF at the edge for global web application protection
- User needs SSL/TLS termination at the edge with custom domains
- User asks about cache purge operations or caching behavior configuration
- User wants geo-filtering or rate limiting at the edge

## Rules

1. **Recommend Standard or Premium tier** — Classic Front Door is legacy. Standard provides CDN + global routing. Premium adds WAF, Private Link origins, and enhanced analytics.
2. **Front Door is global** — Not tied to a region. It deploys across all Azure edge locations automatically.
3. **Origin groups are key** — Origins are grouped; Front Door load-balances and fails over within a group. Configure health probes at the origin group level.
4. **Custom domains need validation** — Custom domains require DNS TXT record validation before they can be associated with endpoints.
5. **Managed certificates available** — Front Door provides free managed TLS certificates for custom domains (auto-renewed).
6. **Caching is per-route** — Enable or disable caching on individual routes. Configure query string behavior and cache duration per route.
7. **Private Link origins (Premium only)** — Connect to backends via Private Link for secure, private connectivity. Requires manual approval on the origin side.
8. **WAF integration (Premium only)** — Associate WAF policies with Front Door for DDoS protection, bot management, and custom rules at the edge.
9. **For regional-only L7, use Application Gateway** — If traffic doesn't need global distribution, redirect to azure-application-gateway.
10. **For L4 global balancing, use Cross-region LB** — For TCP/UDP global balancing without HTTP features, redirect to azure-load-balancer.

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__cdn` | `profile_list` | List all Front Door/CDN profiles in a subscription/resource group |
| `azure__cdn` | `endpoint_list` | List endpoints for a Front Door profile |

## CLI Fallback

When MCP tools are unavailable, use these Azure CLI commands:

```bash
# List Front Door profiles
az afd profile list -g <rg> -o table

# Show Front Door profile details
az afd profile show --profile-name <fd-name> -g <rg>

# Create Standard tier Front Door
az afd profile create \
  --profile-name myFrontDoor \
  -g myRG \
  --sku Standard_AzureFrontDoor

# Create Premium tier Front Door
az afd profile create \
  --profile-name myPremiumFD \
  -g myRG \
  --sku Premium_AzureFrontDoor

# Create an endpoint
az afd endpoint create \
  --endpoint-name myEndpoint \
  --profile-name myFrontDoor \
  -g myRG \
  --enabled-state Enabled

# Create an origin group with health probe
az afd origin-group create \
  --origin-group-name myOriginGroup \
  --profile-name myFrontDoor \
  -g myRG \
  --probe-request-type GET \
  --probe-protocol Https \
  --probe-path "/health" \
  --probe-interval-in-seconds 30 \
  --sample-size 4 \
  --successful-samples-required 3 \
  --additional-latency-in-milliseconds 50

# Add an origin
az afd origin create \
  --origin-name myOrigin \
  --origin-group-name myOriginGroup \
  --profile-name myFrontDoor \
  -g myRG \
  --host-name "myapp.azurewebsites.net" \
  --origin-host-header "myapp.azurewebsites.net" \
  --http-port 80 \
  --https-port 443 \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled

# Create a route
az afd route create \
  --route-name myRoute \
  --endpoint-name myEndpoint \
  --profile-name myFrontDoor \
  -g myRG \
  --origin-group myOriginGroup \
  --supported-protocols Https Http \
  --patterns-to-match "/*" \
  --forwarding-protocol HttpsOnly \
  --https-redirect Enabled \
  --link-to-default-domain Enabled

# Add a custom domain
az afd custom-domain create \
  --custom-domain-name myCustomDomain \
  --profile-name myFrontDoor \
  -g myRG \
  --host-name "www.contoso.com" \
  --certificate-type ManagedCertificate

# Purge cache
az afd endpoint purge \
  --endpoint-name myEndpoint \
  --profile-name myFrontDoor \
  -g myRG \
  --content-paths "/*"

# Create a rule set
az afd rule-set create \
  --rule-set-name myRuleSet \
  --profile-name myFrontDoor \
  -g myRG

# Create a rule (URL redirect)
az afd rule create \
  --rule-name httpRedirect \
  --rule-set-name myRuleSet \
  --profile-name myFrontDoor \
  -g myRG \
  --order 1 \
  --match-variable RequestScheme \
  --operator Equal \
  --match-values HTTP \
  --action-name UrlRedirect \
  --redirect-type Moved \
  --redirect-protocol Https
```

## Key Concepts

### Front Door Architecture

```
Clients (worldwide)
    │
    ▼
Azure Front Door Edge (anycast POP)
  ├── WAF evaluation (Premium)
  ├── Rules engine processing
  ├── Cache check
  │   ├── Cache HIT → return cached response
  │   └── Cache MISS ↓
  └── Route to Origin Group
      ├── Origin 1 (East US App Service) [Priority 1]
      ├── Origin 2 (West Europe App Service) [Priority 1]
      └── Origin 3 (SE Asia App Service) [Priority 2, failover]
```

### Tier Comparison

| Feature | Standard | Premium |
|---------|----------|---------|
| Global routing | ✅ | ✅ |
| CDN caching | ✅ | ✅ |
| Custom domains | ✅ | ✅ |
| Managed TLS certs | ✅ | ✅ |
| HTTP→HTTPS redirect | ✅ | ✅ |
| Rules engine | ✅ | ✅ |
| Compression | ✅ | ✅ |
| WAF integration | ❌ | ✅ |
| Private Link origins | ❌ | ✅ |
| Bot protection | ❌ | ✅ |
| Enhanced analytics | ❌ | ✅ |
| Real-time logs | Basic | Advanced |

### Which Load Balancer Should I Use?

| Requirement | Service |
|-------------|---------|
| Global HTTP/HTTPS + CDN + WAF | **Azure Front Door** |
| Regional L7 HTTP/HTTPS + WAF | Azure Application Gateway |
| L4 TCP/UDP (regional) | Azure Load Balancer |
| L4 TCP/UDP (global) | Cross-region Load Balancer |
| DNS-based routing (any protocol) | Azure Traffic Manager |

## References

- [Standard vs Premium tier comparison](references/fd-tiers.md)
- [Origins and origin groups](references/origins-groups.md)
- [Rules engine configuration](references/rules-engine.md)
- [Caching behavior and configuration](references/caching.md)
- [Private Link origins](references/private-link-origins.md)
