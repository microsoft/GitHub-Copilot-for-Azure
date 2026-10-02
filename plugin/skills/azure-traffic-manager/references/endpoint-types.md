# Traffic Manager Endpoint Types

Traffic Manager supports three endpoint types: Azure endpoints, external endpoints, and nested endpoints. Each type connects Traffic Manager to a different kind of backend resource.

---

## Azure Endpoints

Azure endpoints connect Traffic Manager to resources hosted within Azure. Traffic Manager resolves the endpoint directly using the Azure resource's metadata.

### Supported Resource Types

| Resource Type | Provider Path | Notes |
|---------------|--------------|-------|
| App Service (Web Apps) | `Microsoft.Web/sites` | Most common; must be Standard tier or higher |
| Cloud Service | `Microsoft.ClassicCompute/domainNames` | Classic deployment model |
| Public IP Address | `Microsoft.Network/publicIPAddresses` | Must be static; typically attached to a VM or load balancer |
| App Service Slot | `Microsoft.Web/sites/slots` | Route to a specific deployment slot |

### Finding the Target Resource ID

The `--target-resource-id` is the full Azure Resource Manager path to the resource:

```bash
# Find App Service resource ID
az webapp show -g MyRG -n myapp-eastus --query id -o tsv
# Output: /subscriptions/aaaa-bbbb/resourceGroups/MyRG/providers/Microsoft.Web/sites/myapp-eastus

# Find Public IP resource ID
az network public-ip show -g MyRG -n myapp-pip --query id -o tsv

# Use directly in endpoint creation
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n EastUSEndpoint --type azureEndpoints \
  --target-resource-id $(az webapp show -g MyRG -n myapp-eastus --query id -o tsv) \
  --priority 1
```

### Cross-Subscription Endpoints

Azure endpoints can reference resources in a different subscription than the Traffic Manager profile. The user configuring the endpoint needs read access to the target resource.

```bash
# Reference an App Service in a different subscription
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n CrossSubEndpoint --type azureEndpoints \
  --target-resource-id /subscriptions/OTHER-SUB-ID/resourceGroups/OtherRG/providers/Microsoft.Web/sites/other-app \
  --priority 2
```

### Automatic Region Detection

For Azure endpoints, Traffic Manager automatically determines the endpoint's Azure region from the resource metadata. This is used by Performance routing to make latency-based decisions. You do NOT need to set `--endpoint-location` for Azure endpoints.

### App Service Requirements

- App Service must be on a Standard, Premium, or Isolated tier (Free and Basic tiers do not support Traffic Manager integration).
- Each App Service must have a unique DNS name within `.azurewebsites.net`.
- When using multiple App Services across regions, each must be a separate App Service plan in its target region.

---

## External Endpoints

External endpoints connect Traffic Manager to resources outside Azure — on-premises data centers, other cloud providers, or any internet-accessible service.

### Addressing Options

External endpoints can be specified using:
- **FQDN (Fully Qualified Domain Name)**: `onprem.contoso.com`, `app.aws.example.com`
- **IPv4 address**: `203.0.113.50`
- **IPv6 address**: `2001:db8::1`

```bash
# FQDN-based external endpoint
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n OnPremEndpoint --type externalEndpoints \
  --target onprem.contoso.com --priority 2

# IP-based external endpoint (required for MultiValue routing)
az network traffic-manager endpoint create -g MyRG --profile-name MyTMProfile \
  -n AWSEndpoint --type externalEndpoints \
  --target 52.10.20.30 --priority 3
```

### Health Probe Requirements

External endpoint health probes are sent from Azure data centers. The external endpoint MUST:

1. **Be accessible from the internet** — Traffic Manager probes cannot reach private/internal IPs.
2. **Accept connections on the configured probe port** (typically 80 or 443).
3. **Return an HTTP 200 status** at the configured probe path (for HTTP/HTTPS probes).
4. **Allow Traffic Manager probe source IPs** through any firewalls. Probe IPs are published as the `AzureTrafficManager` service tag.

If the external endpoint is behind a firewall, add rules to permit inbound connections from the [Traffic Manager probe IP ranges](https://www.microsoft.com/download/details.aspx?id=56519).

### Use Cases for External Endpoints

| Scenario | Configuration |
|----------|--------------|
| Multi-cloud (Azure + AWS) | Azure endpoint priority 1, external AWS endpoint priority 2 |
| On-premises failover | Azure endpoint priority 1, on-prem FQDN priority 2 |
| Hybrid deployment | Performance routing with Azure and on-prem endpoints in different locations |
| Third-party CDN | External endpoint pointing to CDN origin |

### Explicit Location Required for Performance Routing

External endpoints do not have Azure region metadata. When using Performance routing, you MUST set `--endpoint-location`:

```bash
az network traffic-manager endpoint create -g MyRG --profile-name PerfProfile \
  -n OnPremDC --type externalEndpoints \
  --target dc.contoso.com --endpoint-location "East US"
```

The location should represent the Azure region closest to the external resource.

---

## Nested Endpoints

Nested endpoints use another Traffic Manager profile as the target. This enables combining different routing methods at multiple levels — for example, geographic routing at the outer level with priority failover at the inner level.

### When to Use Nested Profiles

- **Combining routing methods**: Performance routing globally, weighted routing within each region.
- **Geographic failover**: Geographic routing at the outer level prevents failover to other regions, but an inner Priority profile provides failover within the assigned region.
- **Gradual migration with regional control**: Outer profile routes by region, inner profile handles canary deployments with weighted routing.
- **Large endpoint sets**: A single Traffic Manager profile supports up to 200 endpoints. Nesting allows scaling beyond this limit.

### MinChildEndpoints Setting

The `--min-child-endpoints` parameter controls when the outer profile considers the nested endpoint unhealthy:

- If the number of healthy endpoints in the inner profile drops below `MinChildEndpoints`, the outer profile marks the nested endpoint as Degraded.
- Default value is 1 — the nested endpoint is considered healthy as long as at least one child endpoint is healthy.
- Set higher values when you need a minimum level of capacity before routing to a region.

```bash
# Nested endpoint requiring at least 2 healthy child endpoints
az network traffic-manager endpoint create -g MyRG --profile-name OuterProfile \
  -n RegionA --type nestedEndpoints \
  --target-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/trafficManagerProfiles/InnerProfileA \
  --min-child-endpoints 2 --endpoint-location "East US"
```

### Cascading Health Checks

Health checks cascade from inner to outer profiles:

1. Inner profile probes individual endpoint health (App Service, VM, etc.).
2. If enough inner endpoints fail (below MinChildEndpoints), the inner profile is considered unhealthy.
3. Outer profile detects this and stops routing to the nested endpoint.
4. Traffic shifts to the next outer endpoint based on the outer profile's routing method.

### Complex Routing Example

Three-level nesting: Geographic → Performance → Priority:

```
Outer: Geographic routing
├── GEO-EU → Mid: Performance routing (Europe regions)
│   ├── West Europe → Inner: Priority (westeu-primary=1, westeu-secondary=2)
│   └── North Europe → Inner: Priority (northeu-primary=1, northeu-secondary=2)
├── GEO-NA → Mid: Performance routing (North America regions)
│   ├── East US → Inner: Priority (eastus-primary=1, eastus-secondary=2)
│   └── West US → Inner: Priority (westus-primary=1, westus-secondary=2)
└── WORLD → Fallback endpoint
```

### Nested Profile Endpoint Location

For nested endpoints used in Performance routing profiles, you MUST set `--endpoint-location`. This tells the outer profile what region the inner profile represents.

---

## Endpoint Monitoring Status Values

Traffic Manager assigns a monitoring status to each endpoint based on health probe results:

| Status | Meaning | Traffic Manager Behavior |
|--------|---------|------------------------|
| **Online** | Endpoint is healthy and passing probes | Included in DNS responses |
| **Degraded** | Endpoint is failing health probes | Excluded from DNS responses (unless all are degraded) |
| **Disabled** | Administrator manually disabled the endpoint | Excluded from DNS responses; no probes sent |
| **Inactive** | Endpoint configuration is incomplete or profile is disabled | Excluded from DNS responses; no probes sent |
| **Stopped** | The underlying Azure resource is stopped (e.g., App Service stopped) | Excluded from DNS responses |
| **CheckingEndpoint** | Traffic Manager just started or endpoint was just re-enabled; probes in progress | May be included in DNS responses during initial check |

### All-Degraded Fallback

When ALL endpoints in a profile are Degraded, Traffic Manager returns all endpoints in DNS responses as a best-effort measure rather than returning no results. This prevents a total outage caused by false-positive health check failures.

---

## Endpoint Weight and Priority

### Weight (for Weighted Routing)

- Range: 1–1000
- Default: 1
- Weight 0 removes the endpoint from DNS responses (drain traffic).
- All weights are relative: endpoints with weight 100 and 200 get 33% and 67% of traffic.

### Priority (for Priority Routing)

- Range: 1–1000
- Lower value = higher precedence (1 is checked first).
- Each endpoint must have a unique priority within the profile.
- If the highest-priority healthy endpoint fails, traffic shifts to the next priority.

---

## Always-Serve Endpoints

The Always Serve setting overrides health checking for an endpoint. When enabled, Traffic Manager includes the endpoint in DNS responses regardless of its health probe status.

### When to Use

- The endpoint has a non-standard health check that Traffic Manager probes cannot reach.
- You are handling health checks at the application level (client-side retry logic).
- During debugging — temporarily include an endpoint that is showing as Degraded.

```bash
az network traffic-manager endpoint update -g MyRG --profile-name MyTMProfile \
  -n MyEndpoint --type azureEndpoints --always-serve Enabled
```

> **Warning**: Using Always Serve bypasses Traffic Manager's health monitoring. If the endpoint is actually down, users will be directed to an unavailable service.

---

## Troubleshooting

### Endpoint Shows Degraded but Application Is Healthy

1. **Check the probe path**: Verify the path configured in the Traffic Manager profile returns HTTP 200 on the endpoint.
   ```bash
   curl -I https://myapp-eastus.azurewebsites.net/health
   ```
2. **Check the probe port**: The port in the profile must match the port the application listens on.
3. **Check HTTPS certificate**: If using HTTPS probes, the endpoint must have a valid TLS certificate trusted by Traffic Manager (no self-signed certs).
4. **Check firewall rules**: Traffic Manager probes come from Azure data center IPs. Ensure the endpoint allows inbound traffic from the `AzureTrafficManager` service tag.
5. **Check App Service tier**: Free and Basic tiers do not support Traffic Manager. Upgrade to Standard or higher.

### Endpoint Not Receiving Traffic

1. **Check endpoint status**: Ensure the endpoint is Enabled, not Disabled or Stopped.
   ```bash
   az network traffic-manager endpoint show -g MyRG --profile-name MyTMProfile \
     -n MyEndpoint --type azureEndpoints --query endpointStatus
   ```
2. **Check DNS resolution**: Verify that the Traffic Manager DNS name resolves to the expected endpoint.
   ```bash
   nslookup myapp-tm.trafficmanager.net
   ```
3. **Check routing method and configuration**: For Priority routing, verify the endpoint has the correct priority. For Weighted routing, verify the weight is not 0.
4. **Check DNS TTL caching**: DNS resolvers cache responses. After a change, wait for the TTL to expire before testing.
5. **Check profile status**: Ensure the profile itself is Enabled.
   ```bash
   az network traffic-manager profile show -g MyRG -n MyTMProfile --query profileStatus
   ```
