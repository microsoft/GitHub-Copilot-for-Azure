# Traffic Manager Routing Methods

## Priority Routing

Priority routing provides active-passive failover. Traffic Manager returns the healthy endpoint with the lowest priority value (1 = highest precedence). If that endpoint goes down, traffic shifts to the next healthy endpoint in priority order.

### How It Works

1. Each endpoint is assigned a unique priority value from 1 to 1000.
2. When a DNS query arrives, Traffic Manager returns the endpoint with the lowest priority value that is currently healthy.
3. If the primary endpoint fails its health check, Traffic Manager returns the next-lowest priority value endpoint.
4. When the primary recovers and passes health checks again, Traffic Manager shifts DNS responses back to it.

### Setup Example

```bash
# Create the profile
az network traffic-manager profile create -g MyRG -n FailoverProfile \
  --routing-method Priority --unique-dns-name myapp-failover \
  --ttl 30 --protocol HTTPS --port 443 --path /health

# Primary — East US (priority 1, checked first)
az network traffic-manager endpoint create -g MyRG --profile-name FailoverProfile \
  -n Primary-EastUS --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-eastus \
  --priority 1

# Secondary — West US (priority 2, used when primary is down)
az network traffic-manager endpoint create -g MyRG --profile-name FailoverProfile \
  -n Secondary-WestUS --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-westus \
  --priority 2

# Tertiary — North Europe (priority 3, last resort)
az network traffic-manager endpoint create -g MyRG --profile-name FailoverProfile \
  -n Tertiary-NorthEU --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-northeu \
  --priority 3
```

### Active-Passive Pattern

- **Active**: Priority 1 endpoint serves all traffic during normal operation.
- **Passive**: Priority 2+ endpoints remain on standby, receiving health probes but no user traffic.
- **Failover**: When the active endpoint fails, Traffic Manager automatically returns the next healthy endpoint.
- **Failback**: When the active endpoint recovers, Traffic Manager returns to it (no manual intervention).

### Important Behaviors

- Each endpoint MUST have a unique priority value within a profile.
- If all endpoints are unhealthy, Traffic Manager returns all endpoints in DNS (degraded mode) as a last resort.
- Failover time depends on probe interval, tolerated failures, and DNS TTL. See the health checks reference for calculation.

---

## Weighted Routing

Weighted routing distributes traffic across endpoints proportionally based on assigned weight values. Each endpoint receives a share of traffic equal to its weight divided by the total weight of all healthy endpoints.

### Weight Calculation

```
Traffic % to endpoint = (endpoint weight) / (sum of all healthy endpoint weights) × 100

Example: Three endpoints with weights 50, 30, 20
  Endpoint A: 50 / (50+30+20) = 50% of traffic
  Endpoint B: 30 / 100 = 30% of traffic
  Endpoint C: 20 / 100 = 20% of traffic
```

### A/B Testing Pattern

Route a small percentage of traffic to a canary deployment for testing:

```bash
az network traffic-manager profile create -g MyRG -n ABTestProfile \
  --routing-method Weighted --unique-dns-name myapp-abtest \
  --ttl 30 --protocol HTTPS --port 443 --path /health

# Production — receives 90% of traffic
az network traffic-manager endpoint create -g MyRG --profile-name ABTestProfile \
  -n Production --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-prod \
  --weight 90

# Canary — receives 10% of traffic
az network traffic-manager endpoint create -g MyRG --profile-name ABTestProfile \
  -n Canary --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-canary \
  --weight 10
```

### Gradual Migration (Blue-Green Deployment)

Shift traffic progressively from old to new deployment:

1. Start: Old = 100, New = 0 (all traffic to old).
2. Day 1: Old = 90, New = 10.
3. Day 2: Old = 70, New = 30.
4. Day 3: Old = 50, New = 50.
5. Final: Old = 0, New = 100 (all traffic to new).

```bash
# Update weights over time
az network traffic-manager endpoint update -g MyRG --profile-name MigrationProfile \
  -n OldDeployment --type azureEndpoints --weight 50
az network traffic-manager endpoint update -g MyRG --profile-name MigrationProfile \
  -n NewDeployment --type azureEndpoints --weight 50
```

### Weight 0 Behavior

- Setting an endpoint's weight to **0** effectively removes it from DNS responses.
- Traffic Manager does NOT return endpoints with weight 0 unless all other endpoints are also 0 or unhealthy.
- Weight 0 is useful for draining traffic during maintenance without disabling the endpoint.

### Valid Weight Range

Weights can be set from 1 to 1000. Equal weights distribute traffic evenly. All endpoints default to weight 1 if not specified.

---

## Performance Routing

Performance routing sends users to the endpoint with the lowest network latency from the user's location. Traffic Manager maintains an Internet Latency Table that maps IP address ranges to Azure regions.

### How the Azure Latency Table Works

1. Traffic Manager continuously measures round-trip latency from every Azure region to IP prefixes across the internet.
2. When a DNS query arrives, Traffic Manager identifies the source IP (the DNS resolver's IP, not the end user's IP).
3. It looks up which Azure region has the lowest latency for that source IP prefix.
4. It returns the healthy endpoint in that region.

### Regional Endpoint Placement Strategy

- Deploy endpoints in Azure regions closest to your largest user populations.
- For global reach: East US, West Europe, Southeast Asia cover most major populations.
- Check latency from key user locations using `az network traffic-manager profile show` diagnostics.

### Setup Example

```bash
az network traffic-manager profile create -g MyRG -n PerfProfile \
  --routing-method Performance --unique-dns-name myapp-perf \
  --ttl 60 --protocol HTTPS --port 443 --path /health

# Each endpoint's location is set by the Azure resource's region
az network traffic-manager endpoint create -g MyRG --profile-name PerfProfile \
  -n EastUS --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-eastus

az network traffic-manager endpoint create -g MyRG --profile-name PerfProfile \
  -n WestEurope --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-westeu

# External endpoints require explicit location
az network traffic-manager endpoint create -g MyRG --profile-name PerfProfile \
  -n AsiaDC --type externalEndpoints \
  --target asia.contoso.com --endpoint-location "Southeast Asia"
```

### Limitations

- Latency is measured from the DNS resolver, not the end user. Users behind centralized DNS resolvers (e.g., Google 8.8.8.8) may not get the closest endpoint.
- External endpoints must have `--endpoint-location` explicitly set because Traffic Manager cannot infer their Azure region.
- The latency table is periodically updated — it does not react to transient network congestion in real time.

---

## Geographic Routing

Geographic routing directs users to specific endpoints based on the geographic origin of their DNS query. This is used for data residency, compliance, and localized content delivery.

### Geographic Hierarchy

Traffic Manager uses a four-level hierarchy for mapping:

```
World (all regions — catch-all)
├── GEO-AF  Africa
├── GEO-AN  Antarctica
├── GEO-AS  Asia
├── GEO-EU  Europe
│   ├── FR  France
│   │   ├── FR-A  Alsace
│   │   └── ...
│   ├── DE  Germany
│   └── ...
├── GEO-ME  Middle East
├── GEO-NA  North America
│   ├── US  United States
│   │   ├── US-CA  California
│   │   └── ...
│   └── CA  Canada
├── GEO-SA  South America
└── GEO-OC  Oceania
```

### Assignment Rules

- Each geographic region can be assigned to ONLY ONE endpoint within a profile.
- An endpoint can have multiple regions assigned to it.
- If a region is not assigned to any endpoint, Traffic Manager returns NXDOMAIN (no answer) for queries from that region.
- Always assign "World" to a fallback endpoint to avoid unanswered queries.

### Setup Example

```bash
az network traffic-manager profile create -g MyRG -n GeoProfile \
  --routing-method Geographic --unique-dns-name myapp-geo \
  --ttl 60 --protocol HTTPS --port 443 --path /health

# Europe endpoint — serves all European queries
az network traffic-manager endpoint create -g MyRG --profile-name GeoProfile \
  -n EuropeEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-eu \
  --geo-mapping "GEO-EU"

# US endpoint — serves United States queries
az network traffic-manager endpoint create -g MyRG --profile-name GeoProfile \
  -n USEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-us \
  --geo-mapping "US"

# Catch-all endpoint — serves everything not explicitly mapped
az network traffic-manager endpoint create -g MyRG --profile-name GeoProfile \
  -n DefaultEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/myapp-default \
  --geo-mapping "WORLD"
```

### Fallback Behavior

- If the assigned endpoint is unhealthy, Traffic Manager returns NXDOMAIN for that region — it does NOT fall back to another geographic endpoint.
- To avoid this, use nested profiles: outer profile uses Geographic routing, inner profile uses Priority routing for failover within each region.

---

## MultiValue Routing

MultiValue routing returns multiple healthy endpoint IP addresses in a single DNS response. The client's DNS resolver or application can then choose among them, enabling client-side failover without waiting for DNS TTL expiry.

### When to Use

- Your clients support trying multiple IPs on connection failure (most HTTP clients and browsers do this).
- You want faster failover than DNS TTL-based switching provides.
- You need to expose multiple healthy endpoints simultaneously.

### MaxReturn Setting

- `MaxReturn` controls how many IP addresses are returned per DNS query (range: 1–8, but practically up to the number of healthy endpoints).
- Only healthy endpoints are included in the response.

```bash
az network traffic-manager profile create -g MyRG -n MultiProfile \
  --routing-method MultiValue --unique-dns-name myapp-multi \
  --ttl 60 --protocol HTTPS --port 443 --path /health \
  --max-return 3
```

### Behavior

- All healthy endpoints are candidates; Traffic Manager selects up to MaxReturn of them.
- Endpoints MUST have IPv4 or IPv6 addresses (not FQDNs) — only external endpoints with IP addresses or Azure endpoints with Public IP resources work.
- If fewer healthy endpoints exist than MaxReturn, all healthy endpoints are returned.

---

## Subnet Routing

Subnet routing maps specific client IP address ranges (or subnets) to designated endpoints. When a DNS query arrives, Traffic Manager checks the source IP against configured subnet mappings and returns the matched endpoint.

### Use Cases

- **Enterprise routing**: Route internal corporate users (by known IP ranges) to a specific deployment.
- **ISP-specific routing**: Direct users from specific ISPs to optimized endpoints.
- **Regional override**: Override performance routing for known IP ranges that perform better on a different endpoint.

### Setup Example

```bash
az network traffic-manager profile create -g MyRG -n SubnetProfile \
  --routing-method Subnet --unique-dns-name myapp-subnet \
  --ttl 60 --protocol HTTPS --port 443 --path /health

# Route corporate office traffic to internal endpoint
az network traffic-manager endpoint create -g MyRG --profile-name SubnetProfile \
  -n CorpEndpoint --type externalEndpoints \
  --target corp.contoso.com \
  --subnets 10.0.0.0:24 203.0.113.0:28

# Route all other traffic to public endpoint
az network traffic-manager endpoint create -g MyRG --profile-name SubnetProfile \
  -n PublicEndpoint --type externalEndpoints \
  --target public.contoso.com \
  --subnets 0.0.0.0:0
```

### Fallback Behavior

- If the source IP does not match any configured subnet, Traffic Manager returns the endpoint with the default/fallback subnet (0.0.0.0/0 or ::/0) if one exists.
- If no fallback is configured and no subnet matches, Traffic Manager returns NXDOMAIN.

---

## Routing Method Decision Tree

Use this guide to select the appropriate routing method:

```
Do you need active-passive failover?
  └── YES → Priority routing

Do you need to split traffic by percentage (A/B test, migration)?
  └── YES → Weighted routing

Do you need users routed to the lowest-latency endpoint?
  └── YES → Performance routing

Do you need to enforce data residency or geographic compliance?
  └── YES → Geographic routing

Do you need clients to receive multiple IPs for client-side failover?
  └── YES → MultiValue routing

Do you need to route based on the client's IP address or subnet?
  └── YES → Subnet routing

Not sure?
  └── Start with Performance routing (most common for global apps)
```

---

## Combining Methods with Nested Profiles

When a single routing method is insufficient, nest one Traffic Manager profile inside another. The outer profile determines the first-level routing decision; the inner profile refines it.

### Example: Performance (Outer) + Weighted (Inner)

Route users to the nearest region (performance), then distribute within that region using weighted routing for canary deployments.

```
Outer Profile (Performance routing)
├── East US → Inner Profile A (Weighted: prod=90, canary=10)
├── West Europe → Inner Profile B (Weighted: prod=80, canary=20)
└── Southeast Asia → Inner Profile C (Weighted: prod=100, canary=0)
```

```bash
# Create inner profile for East US
az network traffic-manager profile create -g MyRG -n EastUS-Inner \
  --routing-method Weighted --unique-dns-name eastus-inner \
  --ttl 30 --protocol HTTPS --port 443 --path /health

az network traffic-manager endpoint create -g MyRG --profile-name EastUS-Inner \
  -n Prod --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/prod-eastus \
  --weight 90

az network traffic-manager endpoint create -g MyRG --profile-name EastUS-Inner \
  -n Canary --type azureEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/canary-eastus \
  --weight 10

# Add inner profile as nested endpoint in outer profile
az network traffic-manager endpoint create -g MyRG --profile-name Outer-Perf \
  -n EastUS --type nestedEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/trafficManagerProfiles/EastUS-Inner \
  --min-child-endpoints 1 --endpoint-location "East US"
```

### Example: Geographic (Outer) + Priority (Inner)

Route users to a regional group (geographic), then use priority routing for failover within each region.

```
Outer Profile (Geographic routing)
├── GEO-EU → Inner Profile EU (Priority: westeu=1, northeu=2)
├── GEO-NA → Inner Profile NA (Priority: eastus=1, westus=2)
└── WORLD  → Inner Profile Default (Priority: eastus=1, westeu=2)
```

This pattern prevents Geographic routing's limitation of returning NXDOMAIN when an endpoint is unhealthy — the inner Priority profile provides automatic failover within the geographic group.

### Nesting Rules

- Maximum nesting depth is 10 levels (practical limit: 2–3 levels).
- The `--min-child-endpoints` setting on the nested endpoint controls when the outer profile considers the inner profile unhealthy. If healthy child endpoints drop below this threshold, the outer profile marks the nested endpoint as degraded.
- Nested profiles can use any combination of routing methods at each level.
