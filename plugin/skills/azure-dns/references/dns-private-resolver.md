# Azure DNS Private Resolver

## Overview

Azure DNS Private Resolver is a managed service that bridges DNS resolution between Azure virtual networks and on-premises or external networks. It eliminates the need to deploy and manage custom DNS server VMs for hybrid DNS scenarios.

The resolver sits inside your VNet and provides two endpoint types:
- **Inbound endpoints** — accept DNS queries from outside Azure (on-premises, other networks) and resolve them using Azure DNS (including Private DNS zones).
- **Outbound endpoints** — forward DNS queries from Azure VMs to external DNS servers (on-premises, third-party) based on forwarding rules.

## Architecture

```
On-Premises Network                         Azure Virtual Network (Hub)
┌──────────────────┐                       ┌─────────────────────────────────┐
│                  │                       │                                 │
│  On-prem DNS     │   Queries for         │  ┌─────────────────────┐       │
│  Server          │   *.internal ──────▶  │  │  Inbound Endpoint   │       │
│  (10.1.0.4)      │                       │  │  (10.0.0.4)         │       │
│                  │                       │  └──────────┬──────────┘       │
│                  │   Answers for         │             │                   │
│                  │ ◀── corp.contoso.com   │             ▼                   │
│                  │                       │     Azure DNS (168.63.129.16)   │
│                  │                       │     + Private DNS Zones         │
│                  │                       │                                 │
│                  │                       │  ┌─────────────────────┐       │
│                  │ ◀─────────────────────│  │  Outbound Endpoint  │       │
│                  │   Queries for         │  │  (10.0.1.4)         │       │
│                  │   corp.contoso.com    │  └──────────┬──────────┘       │
│                  │                       │             │                   │
│                  │                       │  ┌──────────▼──────────┐       │
│                  │                       │  │  Forwarding Ruleset │       │
│                  │                       │  │  corp.contoso.com.  │       │
│                  │                       │  │  → 10.1.0.4:53      │       │
│                  │                       │  └─────────────────────┘       │
└──────────────────┘                       └─────────────────────────────────┘
```

## When to Use DNS Private Resolver vs Custom DNS VMs

| Criteria | DNS Private Resolver | Custom DNS VMs |
|----------|---------------------|----------------|
| Management overhead | Fully managed, no patching | You manage OS, DNS software, HA |
| High availability | Built-in (zone-redundant) | You must deploy multiple VMs + load balancing |
| Cost | Pay for endpoints + queries | VM compute costs (often higher) |
| Performance | Optimized, low-latency | Depends on VM size and configuration |
| Customization | Forwarding rules only | Full DNS server features (BIND, Windows DNS) |
| DNSSEC validation | Supported | Depends on your DNS software |
| Conditional forwarding | Yes, via ruleset rules | Yes, via DNS server configuration |

**Recommendation:** Use DNS Private Resolver unless you need advanced DNS server features like custom zone hosting, DNS-based load balancing, or complex rewrite rules.

## Creating a DNS Private Resolver

### Prerequisites

- A VNet in the region where you want the resolver.
- Two dedicated subnets: one for inbound, one for outbound (minimum /28 each).
- The subnets must be delegated to `Microsoft.Network/dnsResolvers`.

### Subnet Preparation

```bash
# Create the inbound endpoint subnet
az network vnet subnet create \
  --resource-group MyRG \
  --vnet-name HubVNet \
  --name InboundDnsSubnet \
  --address-prefixes 10.0.0.0/28 \
  --delegations Microsoft.Network/dnsResolvers

# Create the outbound endpoint subnet
az network vnet subnet create \
  --resource-group MyRG \
  --vnet-name HubVNet \
  --name OutboundDnsSubnet \
  --address-prefixes 10.0.1.0/28 \
  --delegations Microsoft.Network/dnsResolvers
```

**Subnet requirements:**
- Minimum size: /28 (16 addresses, 11 usable after Azure reserved).
- The subnet must be dedicated — no other resources can be deployed in it.
- Subnet delegation to `Microsoft.Network/dnsResolvers` is mandatory.
- Inbound and outbound endpoints must be in separate subnets.

### Creating the Resolver

```bash
az dns-resolver create \
  --resource-group MyRG \
  --name HubDnsResolver \
  --location eastus \
  --id /subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/HubVNet
```

## Inbound Endpoints

Inbound endpoints receive DNS queries from on-premises or peered networks and resolve them against Azure DNS (168.63.129.16), which includes Private DNS zones linked to the resolver's VNet.

**Use case:** On-premises servers need to resolve Azure Private DNS zone records (e.g., `myvm.contoso.internal` or `mystorage.privatelink.blob.core.windows.net`).

```bash
az dns-resolver inbound-endpoint create \
  --resource-group MyRG \
  --resolver-name HubDnsResolver \
  --name InboundEndpoint \
  --location eastus \
  --ip-configurations "[{\
    private-ip-allocation-method:Dynamic,\
    id:/subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/HubVNet/subnets/InboundDnsSubnet\
  }]"
```

After creation, note the assigned private IP (e.g., `10.0.0.4`). Configure your on-premises DNS server to forward relevant zones to this IP.

**On-premises DNS server configuration (example for Windows DNS):**
1. Create a conditional forwarder for `contoso.internal` pointing to `10.0.0.4`.
2. Create a conditional forwarder for `privatelink.blob.core.windows.net` pointing to `10.0.0.4`.
3. Ensure there is network connectivity (VPN or ExpressRoute) from on-premises to the inbound endpoint subnet.

## Outbound Endpoints

Outbound endpoints send DNS queries from Azure VMs to external DNS servers (typically on-premises). They work together with forwarding rulesets to control which domains are forwarded and where.

```bash
az dns-resolver outbound-endpoint create \
  --resource-group MyRG \
  --resolver-name HubDnsResolver \
  --name OutboundEndpoint \
  --location eastus \
  --id /subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/HubVNet/subnets/OutboundDnsSubnet
```

## Forwarding Rulesets

A forwarding ruleset is a collection of rules that define which DNS queries to forward and where. Rulesets are linked to outbound endpoints and VNets.

### Creating a Ruleset

```bash
az dns-resolver forwarding-ruleset create \
  --resource-group MyRG \
  --name HybridForwardingRuleset \
  --location eastus \
  --outbound-endpoints "[{\
    id:/subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/dnsResolvers/HubDnsResolver/outboundEndpoints/OutboundEndpoint\
  }]"
```

### Creating Forwarding Rules

Each rule matches a domain suffix and forwards matching queries to specified target DNS servers.

```bash
# Forward corp.contoso.com queries to on-premises DNS
az dns-resolver forwarding-rule create \
  --resource-group MyRG \
  --ruleset-name HybridForwardingRuleset \
  --name ForwardCorpDomain \
  --domain-name "corp.contoso.com." \
  --forwarding-rule-state Enabled \
  --target-dns-servers "[{ip-address:10.1.0.4,port:53},{ip-address:10.1.0.5,port:53}]"

# Forward another on-premises domain
az dns-resolver forwarding-rule create \
  --resource-group MyRG \
  --ruleset-name HybridForwardingRuleset \
  --name ForwardLegacyDomain \
  --domain-name "legacy.internal." \
  --forwarding-rule-state Enabled \
  --target-dns-servers "[{ip-address:10.1.0.4,port:53}]"
```

**Rule matching:**
- Domain names must end with a trailing dot (e.g., `corp.contoso.com.`).
- Rules match the domain and all subdomains (e.g., `corp.contoso.com.` matches `app.corp.contoso.com`).
- More specific rules take precedence (longest suffix match).
- Queries that don't match any rule go to Azure DNS as normal.

### Linking a Ruleset to VNets

A forwarding ruleset must be linked to VNets for the rules to take effect on VMs in those VNets.

```bash
# Link the ruleset to the hub VNet
az dns-resolver vnet-link create \
  --resource-group MyRG \
  --ruleset-name HybridForwardingRuleset \
  --name HubVNetRulesetLink \
  --id /subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/HubVNet

# Link to spoke VNets as well
az dns-resolver vnet-link create \
  --resource-group MyRG \
  --ruleset-name HybridForwardingRuleset \
  --name Spoke1RulesetLink \
  --id /subscriptions/{sub}/resourceGroups/MyRG/providers/Microsoft.Network/virtualNetworks/Spoke1VNet
```

## Network Architecture: Placement Guidance

**Place the DNS Private Resolver in the hub VNet** of a hub-spoke topology.

```
                     ┌──────────────────────────┐
                     │        Hub VNet           │
    On-Premises ◀═══▶│  DNS Private Resolver     │
    (VPN/ER)         │  ├─ Inbound Endpoint      │
                     │  ├─ Outbound Endpoint     │
                     │  └─ Forwarding Ruleset    │
                     │                            │
                     │  Private DNS Zone Links    │
                     └──────────┬─────────────────┘
                       ┌────────┼────────┐
                       ▼        ▼        ▼
                    Spoke 1  Spoke 2  Spoke 3
```

**Why the hub?**
- On-premises connectivity (VPN/ExpressRoute) terminates in the hub.
- The inbound endpoint needs to be reachable from on-premises.
- The outbound endpoint needs to reach on-premises DNS servers.
- Spoke VNets connect via peering — DNS queries traverse the peering link.

**Spoke VNet DNS configuration:**
- If spokes use Azure default DNS, they automatically use 168.63.129.16, which respects forwarding ruleset links.
- If spokes use custom DNS settings pointing to the resolver inbound endpoint IP, queries go through the resolver for all names.

## Performance and Scaling

- Each inbound or outbound endpoint can handle up to **10,000 DNS queries per second**.
- A resolver can have up to 10 inbound and 10 outbound endpoints.
- For higher throughput, add more endpoints in the same or different subnets.
- DNS Private Resolver is zone-redundant within the region (built-in high availability).
- Latency is typically sub-millisecond within the same region.

**Scaling example:** If you need 25,000 QPS inbound from on-premises, create 3 inbound endpoints and distribute queries across their IPs (using on-premises DNS round-robin or load balancing).

## Troubleshooting

### Resolver Not Forwarding Queries

1. **Verify the forwarding ruleset is linked to the correct VNet:**
   ```bash
   az dns-resolver vnet-link list --ruleset-name HybridForwardingRuleset -g MyRG -o table
   ```
2. **Verify the forwarding rule domain name ends with a dot:** `corp.contoso.com.` not `corp.contoso.com`.
3. **Verify the rule state is Enabled:**
   ```bash
   az dns-resolver forwarding-rule show -g MyRG --ruleset-name HybridForwardingRuleset -n ForwardCorpDomain
   ```
4. **Test from a VM in the linked VNet:**
   ```bash
   nslookup app.corp.contoso.com
   ```

### Timeout or No Response

1. **Check network connectivity** between the outbound endpoint subnet and the target DNS servers. NSG rules on the outbound subnet must allow UDP/TCP port 53 outbound.
2. **Check the on-premises firewall** — it must allow DNS traffic from the outbound endpoint subnet.
3. **Verify the target DNS server is running** and accepting queries on port 53.
4. **Check the inbound endpoint reachability** from on-premises — the VPN/ExpressRoute path must allow traffic to the inbound endpoint subnet on UDP/TCP port 53.

### Subnet Conflicts

1. **Delegation error:** The subnet must be delegated to `Microsoft.Network/dnsResolvers`. Check:
   ```bash
   az network vnet subnet show -g MyRG --vnet-name HubVNet -n InboundDnsSubnet --query delegations
   ```
2. **Subnet too small:** Minimum /28. If you get size errors, resize or create a new subnet.
3. **Subnet already in use:** The subnet must be dedicated to the resolver. No VMs, NICs, or other services can share it.
4. **NSG on the subnet:** While NSGs are supported on resolver subnets, ensure they do not block DNS traffic (UDP/TCP 53 inbound for inbound endpoints, outbound for outbound endpoints).

### On-Premises DNS Not Resolving Azure Private Zones

1. Confirm the inbound endpoint IP is reachable from on-premises (ping or traceroute).
2. Confirm the on-premises DNS server has a conditional forwarder pointing to the inbound endpoint IP for the Azure Private DNS zone name.
3. Confirm the Private DNS zone is linked (resolution or registration link) to the resolver's VNet.
4. Test by querying the inbound endpoint directly:
   ```bash
   nslookup myvm.contoso.internal 10.0.0.4
   ```
