# Load Balancer Selection Guide

Decision tree for choosing between Azure Load Balancer, Application Gateway, Front Door, and Traffic Manager based on workload requirements.

## The Decision Tree

Start with these three questions:

### Question 1: HTTP/HTTPS or non-HTTP?

| Answer | Next Step |
|--------|-----------|
| **HTTP/HTTPS** (web apps, APIs, REST) | Go to Question 2 |
| **Non-HTTP** (TCP, UDP, databases, gaming, IoT) | → **Azure Load Balancer** |

### Question 2: Global or regional?

| Answer | Next Step |
|--------|-----------|
| **Global** (multi-region, global users) | Go to Question 3 |
| **Regional** (single region, or region-specific) | → **Application Gateway** |

### Question 3: Need CDN, edge WAF, or SSL offload at edge?

| Answer | Recommendation |
|--------|---------------|
| **Yes** — need CDN, edge caching, global WAF, or low-latency edge termination | → **Azure Front Door** |
| **No** — just DNS-based failover between regions | → **Traffic Manager** |

## Service Comparison Matrix

| Feature | Load Balancer | Application Gateway | Front Door | Traffic Manager |
|---------|:------------:|:-------------------:|:----------:|:--------------:|
| **Layer** | L4 (TCP/UDP) | L7 (HTTP/HTTPS) | L7 (HTTP/HTTPS) | DNS-based |
| **Scope** | Regional | Regional | Global | Global |
| **SSL termination** | No | Yes | Yes (edge) | No |
| **URL-based routing** | No | Yes | Yes | No |
| **WAF** | No | Yes (v2) | Yes (edge) | No |
| **Session affinity** | Hash-based | Cookie-based | Cookie-based | No |
| **Health probes** | TCP/HTTP | HTTP/HTTPS | HTTP/HTTPS | HTTP/HTTPS/TCP |
| **WebSocket** | Yes (pass-through) | Yes | Yes | N/A |
| **Private only** | Yes | Yes | No (internet-facing) | No |
| **Cross-region** | Yes (cross-region LB) | No | Yes | Yes (DNS) |
| **Autoscaling** | N/A | Yes (v2) | Yes | N/A |
| **Pricing model** | Rules + data | Capacity units | Base + routing + data | Queries + health checks |

## When to Use Each Service

### Azure Load Balancer

**Use for:**
- Non-HTTP traffic (SQL, RDP, SSH, custom TCP/UDP protocols)
- Internal load balancing between application tiers
- HA ports for NVA deployments
- Ultra-low latency requirements (no L7 processing overhead)
- UDP workloads (gaming, VoIP, DNS)

**SKUs:**
- **Standard** — production use, zone-redundant, any backend pool size
- **Gateway** — chaining third-party NVAs transparently
- **Cross-region** — global L4 load balancing with regional LB backends

```bash
# Create a Standard internal load balancer
az network lb create \
  --resource-group <rg> \
  --name my-ilb \
  --sku Standard \
  --vnet-name <vnet> \
  --subnet <subnet> \
  --frontend-ip-name frontend \
  --backend-pool-name backend-pool
```

### Application Gateway

**Use for:**
- Regional HTTP/HTTPS load balancing
- SSL termination with centralized certificate management
- URL-based routing (e.g., `/api/*` to one pool, `/images/*` to another)
- Web Application Firewall (WAF v2) for OWASP protection
- Internal web application load balancing (not internet-facing)
- Mutual TLS (mTLS) authentication
- WebSocket and HTTP/2 support

**Choose v2 SKU** — v1 is legacy. v2 supports autoscaling, zone redundancy, and better performance.

```bash
# Create Application Gateway v2 with WAF
az network application-gateway create \
  --resource-group <rg> \
  --name my-appgw \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name <vnet> \
  --subnet appgw-subnet \
  --public-ip-address appgw-pip \
  --http-settings-port 80 \
  --http-settings-protocol Http
```

### Azure Front Door

**Use for:**
- Global HTTP/HTTPS load balancing with anycast
- CDN and edge caching for static content
- Edge-based WAF (DDoS and bot protection at the edge)
- SSL offload at global edge POPs (reduces latency for TLS handshake)
- Multi-region active-active web applications
- A/B testing and weighted routing
- Instant global failover (< 30 seconds)

**Tiers:**
- **Standard** — CDN + basic routing
- **Premium** — CDN + WAF + Private Link origins + advanced analytics

```bash
# Create Front Door profile
az afd profile create \
  --resource-group <rg> \
  --profile-name my-frontdoor \
  --sku Premium_AzureFrontDoor
```

**Front Door + Application Gateway combo:** Use Front Door for global distribution and WAF at the edge, with Application Gateway as the regional origin for URL routing and additional WAF rules.

### Traffic Manager

**Use for:**
- DNS-based global traffic routing (non-HTTP workloads that need multi-region)
- Simple failover between regions (primary/secondary)
- Geographic routing (route users to nearest region by DNS)
- Weighted round-robin between endpoints
- Nested profiles for complex routing hierarchies

**Limitations:**
- DNS-based only — no inline processing of traffic
- Failover speed depends on DNS TTL (typically 30-60 seconds)
- No SSL termination, no WAF, no caching
- Clients may cache DNS and not respect TTL changes

```bash
# Create Traffic Manager profile with priority routing
az network traffic-manager profile create \
  --resource-group <rg> \
  --name my-tm \
  --routing-method Priority \
  --unique-dns-name my-app-tm \
  --monitor-protocol HTTPS \
  --monitor-port 443 \
  --monitor-path "/health"
```

## Common Combination Patterns

### Pattern 1: Global web app (most common)

```
Users → Front Door (global L7 + WAF + CDN)
          → Application Gateway (regional L7 + URL routing)
              → VMs / VMSS / App Service
```

### Pattern 2: Multi-tier application

```
Internet → Application Gateway (L7, SSL, WAF)
              → Web tier VMs
                  → Internal Load Balancer (L4)
                      → App tier VMs
                          → Internal Load Balancer (L4)
                              → Database tier
```

### Pattern 3: Global non-HTTP service

```
Users → Traffic Manager (DNS routing)
          → Azure Load Balancer (regional L4)
              → Backend VMs (TCP/UDP service)
```

### Pattern 4: NVA high availability

```
Spoke traffic → UDR →
    Gateway Load Balancer (transparent chaining)
        → NVA instance 1
        → NVA instance 2
    → Azure Load Balancer (destination)
        → Backend VMs
```

## Quick Decision Cheat Sheet

| Scenario | Service |
|----------|---------|
| Internal TCP load balancing | **Load Balancer** (Standard, internal) |
| Public-facing web app, single region | **Application Gateway** (v2 + WAF) |
| Public-facing web app, global users | **Front Door** (Premium) |
| Global failover for any protocol | **Traffic Manager** |
| NVA transparent chaining | **Gateway Load Balancer** |
| L4 global distribution | **Cross-region Load Balancer** |
| API with URL-based routing | **Application Gateway** or **Front Door** |
| Static site with CDN | **Front Door** (Standard) |
| Gaming / UDP workload | **Load Balancer** (Standard) |
| Micro-services with multiple backends | **Application Gateway** (URL routing) |

## Pricing Comparison (approximate)

| Service | Base Cost | Data Processing |
|---------|-----------|----------------|
| Load Balancer (Standard) | ~$18/month per rule | ~$5/TB |
| Application Gateway (v2) | ~$175/month (2 instances) | ~$8/CU (capacity units) |
| Front Door (Standard) | ~$35/month base | ~$0.01-0.02/GB routing |
| Front Door (Premium) | ~$330/month base | ~$0.02-0.03/GB routing |
| Traffic Manager | ~$0.75/million queries | Health check: $0.36/endpoint/month |

Prices are approximate and region-dependent. Check [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) for current rates.

## Related Resources

- [Choose a load balancing solution — Microsoft decision tree](https://learn.microsoft.com/azure/architecture/guide/technology-choices/load-balancing-overview)
- [Azure Load Balancer overview](https://learn.microsoft.com/azure/load-balancer/load-balancer-overview)
- [Application Gateway overview](https://learn.microsoft.com/azure/application-gateway/overview)
- [Azure Front Door overview](https://learn.microsoft.com/azure/frontdoor/front-door-overview)
- [Traffic Manager overview](https://learn.microsoft.com/azure/traffic-manager/traffic-manager-overview)
- For Load Balancer configuration → use `azure-load-balancer` skill
- For Application Gateway configuration → use `azure-application-gateway` skill
- For Front Door configuration → use `azure-front-door` skill
- For Traffic Manager configuration → use `azure-traffic-manager` skill
