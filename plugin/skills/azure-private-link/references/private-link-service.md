# Private Link Service Guide

Azure Private Link Service allows you to expose your own application — running behind a Standard Load Balancer — as a private endpoint destination. Consumers in other VNets, subscriptions, or tenants can create private endpoints that connect to your service over the Microsoft backbone, without any public internet exposure.

## Architecture Overview

```
Consumer Side                                    Provider Side
─────────────                                    ─────────────

Consumer VNet                                    Provider VNet
┌──────────────────┐                             ┌──────────────────────────┐
│                  │                             │                          │
│  Consumer App    │                             │  Private Link Service    │
│       │          │                             │       │                  │
│       ▼          │                             │       ▼                  │
│  Private         │     Microsoft Backbone      │  Standard Internal LB    │
│  Endpoint  ──────┼─────────────────────────────┼──►  │                   │
│  (10.1.0.5)      │                             │     ▼                   │
│                  │                             │  Backend VMs / VMSS     │
└──────────────────┘                             │  (your application)     │
                                                 └──────────────────────────┘
```

The consumer sees only a private IP address in their own VNet. They have no visibility into the provider's network topology, IP addresses, or infrastructure. The Private Link Service uses NAT to translate between the consumer's private endpoint IP and the provider's load balancer frontend.

## Requirements

1. **Standard Load Balancer** — Private Link Service only works with Standard SKU internal load balancers (not Basic, not public).
2. **Dedicated subnet** — The PLS requires a subnet in the provider VNet. This subnet can be shared with other PLS instances but should not host other resources.
3. **Disable network policies on the PLS subnet** — Network policies (NSGs, UDRs) must be disabled on the subnet used for PLS NAT IPs:

```bash
az network vnet subnet update \
  -g ProviderRG \
  --vnet-name ProviderVNet \
  -n PLSSubnet \
  --disable-private-link-service-network-policies true
```

4. **At least one NAT IP configuration** — The PLS needs one or more NAT IPs from the PLS subnet for address translation.

## NAT IP Configuration

The Private Link Service uses NAT (Network Address Translation) to map consumer private endpoint IPs to the provider's load balancer frontend. NAT IPs are allocated from the PLS subnet.

### Static vs Dynamic NAT IPs

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Dynamic** | Azure assigns an IP from the subnet | Default, simplest setup |
| **Static** | You specify the exact IP from the subnet | When you need predictable IPs for firewall rules or logging |

### NAT IP Limits

- **Maximum 8 NAT IPs** per Private Link Service
- Each NAT IP supports approximately 64,000 TCP connections (port space)
- For high-connection-count scenarios, add more NAT IPs (up to 8 × 64K = ~512K connections)

## Creating a Private Link Service Step-by-Step

### Step 1: Ensure You Have a Standard Internal Load Balancer

```bash
# Create an internal Standard LB (if not already present)
az network lb create \
  -g ProviderRG \
  -n ProviderInternalLB \
  --sku Standard \
  --vnet-name ProviderVNet \
  --subnet BackendSubnet \
  --frontend-ip-name ProviderFrontend \
  --backend-pool-name ProviderBackendPool \
  --private-ip-address 10.0.1.10
```

### Step 2: Disable Private Link Service Network Policies on the PLS Subnet

```bash
az network vnet subnet update \
  -g ProviderRG \
  --vnet-name ProviderVNet \
  -n PLSSubnet \
  --disable-private-link-service-network-policies true
```

### Step 3: Create the Private Link Service

```bash
az network private-link-service create \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --vnet-name ProviderVNet \
  --subnet PLSSubnet \
  --lb-name ProviderInternalLB \
  --lb-frontend-ip-configs ProviderFrontend \
  --private-ip-address 10.0.2.5 \
  --private-ip-address-version IPv4 \
  --private-ip-allocation-method Static
```

### Step 4: Note the PLS Alias for Consumer Use

```bash
az network private-link-service show \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --query alias -o tsv
```

The alias looks like: `MyPrivateLinkService.{guid}.{region}.azure.privatelinkservice`

Provide this alias to consumers. They use it to create private endpoints connecting to your service without needing your resource ID.

### Step 5: Consumer Creates a Private Endpoint Using the Alias

```bash
# Run by the consumer in their own subscription
az network private-endpoint create \
  -g ConsumerRG \
  -n ConsumerPE \
  --vnet-name ConsumerVNet \
  --subnet ConsumerSubnet \
  --private-connection-resource-id "" \
  --manual-request-connection-id MyPrivateLinkService.{guid}.{region}.azure.privatelinkservice \
  --connection-name ToProviderService \
  --request-message "Please approve our connection"
```

Alternatively, if the consumer has the full resource ID of the PLS (same-tenant or shared ID):

```bash
az network private-endpoint create \
  -g ConsumerRG \
  -n ConsumerPE \
  --vnet-name ConsumerVNet \
  --subnet ConsumerSubnet \
  --private-connection-resource-id /subscriptions/{providerSub}/resourceGroups/ProviderRG/providers/Microsoft.Network/privateLinkServices/MyPrivateLinkService \
  --connection-name ToProviderService
```

## Visibility and Auto-Approval Configuration

### Visibility

Visibility controls which subscriptions can **discover** your Private Link Service. Options:

| Setting | Behavior |
|---------|----------|
| No visibility list (default) | Any subscription with Azure RBAC on the PLS resource ID or alias can request a connection |
| Specific subscription IDs | Only listed subscriptions can see and connect to the PLS |
| `*` (all) | Any subscription can see the PLS (useful for marketplace offerings) |

```bash
# Restrict visibility to specific subscriptions
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --visibility subscription1-id subscription2-id
```

### Auto-Approval

Auto-approval controls which subscriptions have their private endpoint connections **automatically approved** without manual intervention:

```bash
# Auto-approve connections from specific subscriptions
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --auto-approval subscription1-id subscription2-id
```

Connections from subscriptions not in the auto-approval list remain in **Pending** state until manually approved.

## Proxy Protocol v2 for Source IP Preservation

By default, the PLS performs NAT, which hides the consumer's original source IP. If your backend application needs the consumer's real IP (e.g., for logging or access control), enable Proxy Protocol v2:

```bash
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --enable-proxy-protocol true
```

When enabled, the PLS prepends a Proxy Protocol v2 header to every TCP connection. Your backend application must parse this header to extract:

- **Source address** — the consumer's private endpoint IP (in the consumer's VNet)
- **Destination address** — the PLS NAT IP
- **Link ID** — unique identifier for the private endpoint connection

> **Important:** Your application (or load balancer/reverse proxy behind the Standard LB) must support Proxy Protocol v2 parsing. If it doesn't, connections will appear malformed. Common applications with PP v2 support: HAProxy, NGINX (with `proxy_protocol`), and custom TCP servers.

## Service Limits

| Limit | Value |
|-------|-------|
| Private Link Services per subscription | 800 |
| NAT IP configurations per PLS | 8 |
| Private endpoint connections per PLS | 1,000 |
| Subscriptions in visibility list | 100 |
| Subscriptions in auto-approval list | 100 |
| TCP connections per NAT IP | ~64,000 |

## Troubleshooting

### Connection Stuck in Pending State

**Cause:** The consumer's subscription is not in the auto-approval list, and the provider hasn't manually approved.

**Fix:** The provider must approve the connection:

```bash
# List pending connections
az network private-link-service show \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --query "privateEndpointConnections[?privateLinkServiceConnectionState.status=='Pending']" \
  -o table

# Approve a specific connection
az network private-endpoint-connection approve \
  --resource-name MyPrivateLinkService \
  -g ProviderRG \
  --type Microsoft.Network/privateLinkServices \
  -n {connection-name}
```

### NAT Port Exhaustion

**Symptoms:** New connections fail or time out; existing connections work fine.

**Cause:** A single NAT IP has ~64,000 ports. If your service handles very high connection counts, you can exhaust the NAT port space.

**Fix:** Add more NAT IPs (up to 8 per PLS):

```bash
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --ip-configs '[
    {"name":"natIp1","private-ip-address":"10.0.2.5","private-ip-allocation-method":"Static","subnet":{"id":"/subscriptions/{sub}/resourceGroups/ProviderRG/providers/Microsoft.Network/virtualNetworks/ProviderVNet/subnets/PLSSubnet"},"primary":true},
    {"name":"natIp2","private-ip-address":"10.0.2.6","private-ip-allocation-method":"Static","subnet":{"id":"/subscriptions/{sub}/resourceGroups/ProviderRG/providers/Microsoft.Network/virtualNetworks/ProviderVNet/subnets/PLSSubnet"},"primary":false}
  ]'
```

### Consumer Cannot Resolve the Private Endpoint

If the consumer creates a private endpoint to your PLS but can't connect:

1. **DNS is not configured.** Unlike PaaS private endpoints, Private Link Service private endpoints do NOT have automatic public DNS CNAME insertion. The consumer must manually configure DNS (private DNS zone, hosts file, or custom DNS) to map a hostname to the private endpoint IP.

2. **Connection is not approved.** Check the connection state:

```bash
az network private-endpoint show \
  -g ConsumerRG \
  -n ConsumerPE \
  --query "manualPrivateLinkServiceConnections[0].privateLinkServiceConnectionState" \
  -o json
```

3. **Backend health probe failing.** The PLS forwards traffic to the Standard LB. If backend VMs are unhealthy, traffic is blackholed. Check LB health probes:

```bash
az network lb show \
  -g ProviderRG \
  -n ProviderInternalLB \
  --query "loadBalancingRules[].backendAddressPool" -o json
```

### Consumer Gets Connection Reset

**Cause:** Proxy Protocol v2 is enabled on the PLS but the backend application doesn't parse the PP v2 header.

**Fix:** Either configure the backend to parse Proxy Protocol v2, or disable it on the PLS if source IP preservation is not required:

```bash
az network private-link-service update \
  -g ProviderRG \
  -n MyPrivateLinkService \
  --enable-proxy-protocol false
```
