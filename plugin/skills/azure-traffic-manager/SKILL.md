---
name: azure-traffic-manager
description: "Configure Azure Traffic Manager for DNS-based global traffic routing with priority, weighted, performance, geographic, multivalue, and subnet routing methods. WHEN: traffic manager, DNS load balancing, geographic routing, priority routing, weighted routing, performance routing, failover, global DNS. DO NOT USE FOR: HTTP/HTTPS load balancing (use azure-front-door or azure-application-gateway), private link connectivity (use azure-private-link), network-level load balancing (use azure-load-balancer)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Traffic Manager Skill

## When to Use This Skill

- User needs DNS-based global traffic distribution across Azure regions or external endpoints
- User wants active-passive failover with automatic health checking
- User asks about geographic routing to direct users to region-specific endpoints
- User needs weighted distribution of traffic across multiple endpoints
- User wants performance-based routing to send users to the lowest-latency endpoint
- User needs to configure health probes for endpoint monitoring
- User asks about nested Traffic Manager profiles for complex routing
- User wants to understand the difference between Traffic Manager and other load balancers

## Rules

1. Traffic Manager is DNS-based — it returns a DNS name/IP; it does NOT proxy traffic.
2. DNS TTL affects failover time — lower TTL (30s) = faster failover, more DNS queries; default is 60s.
3. Health probes are critical — an unhealthy endpoint is removed from DNS responses within ~30-60 seconds.
4. Geographic routing assigns regions to endpoints — every query MUST map to an endpoint or it gets no answer.
5. Priority routing: lower priority value = higher precedence (1 is first choice).
6. Nested profiles allow combining routing methods (e.g., performance at outer, weighted at inner level).
7. Traffic Manager works with any internet-facing endpoint — Azure, on-premises, other clouds.
8. External endpoints require health probe accessibility from the internet.
9. For HTTP/HTTPS applications, consider Azure Front Door instead — it provides TLS termination and caching.
10. Traffic Manager is NOT a proxy or gateway — source IP seen by the backend is the client's IP.

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__trafficmanager` | `profile_list` | List all Traffic Manager profiles in a subscription |
| `azure__trafficmanager` | `profile_get` | Get details of a Traffic Manager profile including endpoints and settings |

## CLI Fallback

```bash
# Create Traffic Manager profile (priority routing)
az network traffic-manager profile create -g MyRG -n MyTMProfile \
  --routing-method Priority --unique-dns-name myapp-tm \
  --ttl 60 --protocol HTTPS --port 443 --path /health

# Create Traffic Manager profile (weighted routing)
az network traffic-manager profile create -g MyRG -n MyWeightedTM \
  --routing-method Weighted --unique-dns-name myapp-weighted \
  --ttl 30 --protocol HTTPS --port 443 --path /health

# Add Azure endpoint
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n EastUSEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-eastus \
  --priority 1 --endpoint-status Enabled

# Add external endpoint
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n OnPremEndpoint --type externalEndpoints \
  --target onprem.contoso.com --priority 2 --endpoint-status Enabled

# Add nested profile endpoint
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n NestedEndpoint --type nestedEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/trafficManagerProfiles/InnerProfile \
  --priority 3 --min-child-endpoints 1

# Add geographic endpoint
az network traffic-manager endpoint create -g MyRG --profile-name MyGeoTM \
  -n EuropeEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-europe \
  --geo-mapping "GEO-EU"

# Show profile details
az network traffic-manager profile show -g MyRG -n MyTMProfile
az network traffic-manager profile list -g MyRG -o table

# Show endpoint details
az network traffic-manager endpoint show -g MyRG --profile-name MyTMProfile -n EastUSEndpoint --type azureEndpoints

# Update health probe settings
az network traffic-manager profile update -g MyRG -n MyTMProfile \
  --protocol HTTPS --port 443 --path /health \
  --interval 30 --timeout 10 --tolerated-failures 3

# Disable/enable an endpoint
az network traffic-manager endpoint update -g MyRG --profile-name MyTMProfile \
  -n EastUSEndpoint --type azureEndpoints --endpoint-status Disabled
```

## Key Concepts

### Routing Methods

| Method | Use When | How It Works |
|--------|----------|-------------|
| Priority | Active-passive failover | Returns highest priority (lowest value) healthy endpoint |
| Weighted | A/B testing, gradual migration | Distributes traffic by weight ratio |
| Performance | Lowest latency to user | Uses Azure latency table to find closest endpoint |
| Geographic | Data residency, regional compliance | Maps geographic regions to specific endpoints |
| MultiValue | Multiple healthy IPs needed | Returns all healthy endpoints (up to MaxReturn) |
| Subnet | Client IP-based routing | Maps client subnet ranges to specific endpoints |

### Health Probe Settings

| Setting | Default | Range | Notes |
|---------|---------|-------|-------|
| Protocol | HTTP | HTTP, HTTPS, TCP | HTTPS recommended for web apps |
| Port | 80 | 1-65535 | Must match application port |
| Path | / | Any valid path | Should return 200 when healthy |
| Interval | 30s | 10-300s | Time between probes |
| Timeout | 10s | 5-10s | Time to wait for response |
| Tolerated failures | 3 | 0-9 | Failures before marking unhealthy |

### Failover Timing Calculation

```
Failover time ≈ (Probe interval × Tolerated failures) + Probe interval + DNS TTL
Example: (30s × 3) + 30s + 60s = 180 seconds (3 minutes)
Fast config: (10s × 1) + 10s + 30s = 50 seconds
```

## References

- [Routing Methods Guide](references/routing-methods.md)
- [Endpoint Types](references/endpoint-types.md)
- [Health Checks Configuration](references/health-checks.md)
