# Secured Virtual Hub

## Overview

A secured virtual hub is an Azure Virtual WAN hub with Azure Firewall (or a supported third-party security-as-a-service provider) deployed inside it. The hub and firewall are managed together through Azure Firewall Manager, providing centralized security policy management across multiple hubs and regions.

## Architecture

```
                  ┌─────────────────────────────────┐
                  │     Secured Virtual Hub          │
                  │                                  │
  Branch ─── VPN GW ─── Azure Firewall ─── VNet Connections ─── Spoke VNets
                  │         │                        │
  On-Prem ── ER GW ────────┘                        │
                  │                                  │
  Users ─── P2S GW ─────────────────────────────────│
                  └─────────────────────────────────┘
```

All traffic between connections (VPN, ER, VNet, P2S) can be inspected by the Azure Firewall when routing intent is enabled.

## Deploying a Secured Virtual Hub

### Option 1: Deploy Azure Firewall in an Existing Hub

```bash
# Deploy Azure Firewall in the hub
# This is typically done through Firewall Manager in the Azure portal
# CLI alternative: create a firewall policy first, then associate with the hub

# Create a firewall policy
az network firewall policy create \
  --name <policy-name> \
  --resource-group <rg> \
  --sku Premium \
  --threat-intel-mode Deny \
  --idps-mode Deny

# Deploy Azure Firewall in the vWAN hub (portal recommended)
# The hub becomes a "secured virtual hub" after firewall deployment
```

### Option 2: Create Hub as Secured from the Start

Using Azure Firewall Manager in the portal:
1. Open Firewall Manager → Secured Virtual Hubs
2. Select "Create new secured virtual hub"
3. Specify vWAN, hub region, address space
4. Choose Azure Firewall tier (Standard or Premium)
5. Attach a firewall policy

## Azure Firewall SKUs in vWAN

| Feature | Standard | Premium |
|---------|----------|---------|
| Network rules (L3-L4) | Yes | Yes |
| Application rules (L7 FQDN) | Yes | Yes |
| Threat intelligence | Yes | Yes |
| DNAT rules | Yes | Yes |
| TLS inspection | No | Yes |
| IDPS (Intrusion Detection/Prevention) | No | Yes |
| URL filtering (full URL path) | No | Yes |
| Web categories | Limited | Full |

**Recommendation:** Use Premium for production workloads requiring TLS inspection or IDPS. Use Standard for basic traffic filtering.

## Firewall Policy Structure

Firewall policies define the security rules applied to the secured hub. Policies support inheritance for multi-hub management.

### Policy Hierarchy

```
Base Policy (global defaults)
├── Regional Policy A (inherits base + regional rules)
│   └── Hub Policy A1 (inherits regional + hub-specific rules)
└── Regional Policy B (inherits base + regional rules)
    └── Hub Policy B1 (inherits regional + hub-specific rules)
```

### Create and Configure Firewall Policy

```bash
# Create base firewall policy
az network firewall policy create \
  --name base-policy \
  --resource-group <rg> \
  --sku Premium \
  --threat-intel-mode Alert

# Create child policy inheriting from base
az network firewall policy create \
  --name regional-policy \
  --resource-group <rg> \
  --sku Premium \
  --base-policy <base-policy-resource-id>

# Create a rule collection group
az network firewall policy rule-collection-group create \
  --name DefaultNetworkRuleGroup \
  --policy-name regional-policy \
  --resource-group <rg> \
  --priority 200

# Add network rule collection
az network firewall policy rule-collection-group collection add-filter-collection \
  --name AllowInternalTraffic \
  --policy-name regional-policy \
  --resource-group <rg> \
  --rule-collection-group-name DefaultNetworkRuleGroup \
  --collection-priority 100 \
  --action Allow \
  --rule-name AllowVNetToVNet \
  --rule-type NetworkRule \
  --source-addresses "10.0.0.0/8" \
  --destination-addresses "10.0.0.0/8" \
  --destination-ports "*" \
  --ip-protocols Any

# Add application rule collection for internet access
az network firewall policy rule-collection-group collection add-filter-collection \
  --name AllowInternet \
  --policy-name regional-policy \
  --resource-group <rg> \
  --rule-collection-group-name DefaultNetworkRuleGroup \
  --collection-priority 200 \
  --action Allow \
  --rule-name AllowWeb \
  --rule-type ApplicationRule \
  --source-addresses "10.0.0.0/8" \
  --protocols Https=443 Http=80 \
  --target-fqdns "*.microsoft.com" "*.azure.com"
```

## Firewall Manager Integration

Azure Firewall Manager provides a centralized management plane for secured virtual hubs:

### Capabilities

- **Single pane of glass** for managing firewalls across multiple hubs and regions
- **Security policy management** — create, assign, and update firewall policies
- **Security partner providers** — integrate third-party SECaaS (ZScaler, iBoss, Check Point) for internet traffic filtering
- **Routing intent management** — configure which traffic flows through the firewall
- **DDoS protection plan association** — link DDoS protection to the secured hub

### Third-Party SECaaS Integration

For internet traffic, you can use a third-party security partner instead of (or alongside) Azure Firewall:

| Provider | Traffic Type | Integration |
|----------|-------------|-------------|
| ZScaler | Internet | Cloud proxy redirect |
| iBoss | Internet | Cloud proxy redirect |
| Check Point Harmony Connect | Internet | Cloud proxy redirect |

SECaaS providers handle internet traffic filtering. Azure Firewall (or NVA) handles private traffic filtering. They can work together:
- **Internet traffic** → SECaaS provider
- **Private traffic** → Azure Firewall

## DNAT Rules in Secured Hub

DNAT (Destination NAT) rules allow inbound internet access to services behind the firewall.

```bash
# Add DNAT rule collection
az network firewall policy rule-collection-group collection add-nat-collection \
  --name InboundDNAT \
  --policy-name <policy-name> \
  --resource-group <rg> \
  --rule-collection-group-name DefaultDnatRuleGroup \
  --collection-priority 100 \
  --action DNAT \
  --rule-name WebServer \
  --rule-type NatRule \
  --source-addresses "*" \
  --destination-addresses <firewall-public-ip> \
  --destination-ports 443 \
  --ip-protocols TCP \
  --translated-address 10.1.1.10 \
  --translated-port 443
```

**Note:** In vWAN, Azure Firewall's public IP is managed by the platform. Retrieve it from the hub's firewall resource.

## Monitoring and Logging

### Diagnostic Settings

```bash
# Enable firewall diagnostic logging
az monitor diagnostic-settings create \
  --name fw-diagnostics \
  --resource <firewall-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"category":"AzureFirewallNetworkRule","enabled":true},{"category":"AzureFirewallApplicationRule","enabled":true},{"category":"AzureFirewallDnsProxy","enabled":true}]'
```

### Key Log Categories

| Category | What It Captures |
|----------|-----------------|
| AzureFirewallNetworkRule | Network rule matches (allow/deny) |
| AzureFirewallApplicationRule | Application rule matches (FQDN, URL) |
| AzureFirewallDnsProxy | DNS proxy queries |
| AzureFirewallThreatIntel | Threat intelligence matches |
| AzureFirewallIdpsSignature | IDPS signature matches (Premium) |

### Workbooks and Dashboards

Azure Firewall provides built-in workbooks in Azure Monitor:
- **Azure Firewall Workbook** — overview of rule hits, threat intel, blocked traffic
- **IDPS Workbook** (Premium) — intrusion detection/prevention alerts

## Troubleshooting

### Firewall Blocking Expected Traffic

1. **Check rule order** — rules are processed in priority order within rule collection groups. Lower priority number = higher precedence.
2. **Check rule collection group order** — DNAT rules → Network rules → Application rules
3. **Check rule scope** — verify source/destination addresses cover the actual traffic IPs
4. **Check firewall logs** — query AzureFirewallNetworkRule and AzureFirewallApplicationRule logs in Log Analytics

### DNS Issues with Secured Hub

1. **Enable DNS proxy** — Azure Firewall should act as DNS proxy for spoke VNets
2. **Point VNet DNS** to the Azure Firewall private IP
3. **Configure firewall DNS settings** to use Azure DNS (168.63.129.16) or custom DNS servers

### Performance Considerations

- Azure Firewall Standard supports up to **30 Gbps** throughput
- Azure Firewall Premium supports up to **100 Gbps** throughput
- IDPS and TLS inspection add processing overhead — size firewall appropriately
- Use network rules (L3/L4) instead of application rules (L7) when FQDN filtering is not needed, for lower latency

## Additional References

- [Secured virtual hub overview](https://learn.microsoft.com/azure/firewall-manager/secured-virtual-hub)
- [Azure Firewall Manager](https://learn.microsoft.com/azure/firewall-manager/overview)
- [Deploy Azure Firewall in vWAN](https://learn.microsoft.com/azure/virtual-wan/howto-firewall)
- [Firewall policy rule processing](https://learn.microsoft.com/azure/firewall/rule-processing)
