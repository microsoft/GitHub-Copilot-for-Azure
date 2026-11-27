# IP Address Planning Guide

Plan IP address spaces for Azure virtual networks, avoiding conflicts with on-premises networks, and sizing subnets for current and future growth.

## Azure IP Address Fundamentals

### Reserved addresses per subnet

Azure reserves **5 IP addresses** in every subnet:

| Address | Purpose |
|---------|---------|
| x.x.x.0 | Network address |
| x.x.x.1 | Default gateway |
| x.x.x.2 | Azure DNS mapping |
| x.x.x.3 | Azure DNS mapping |
| x.x.x.255 (or last) | Broadcast |

So a /24 subnet (256 addresses) has **251 usable IPs**, not 256.

### RFC 1918 private address ranges

| Range | CIDR | Total IPs | Typical Use |
|-------|------|-----------|-------------|
| 10.0.0.0 – 10.255.255.255 | 10.0.0.0/8 | 16,777,216 | Large enterprise, Azure VNets |
| 172.16.0.0 – 172.31.255.255 | 172.16.0.0/12 | 1,048,576 | Medium enterprise |
| 192.168.0.0 – 192.168.255.255 | 192.168.0.0/16 | 65,536 | Small networks, home labs |

**Best practice:** Use `10.0.0.0/8` for Azure. It provides the most room for growth and is easiest to summarize.

## Step 1 — Map Your Existing Address Space

Before planning Azure IPs, document all existing address usage:

```
On-premises networks:
  - Datacenter 1: 10.1.0.0/16
  - Datacenter 2: 10.2.0.0/16
  - Branch offices: 10.10.0.0/16

Existing Azure VNets:
  - Production hub: 10.100.0.0/22
  - Dev/test: 10.200.0.0/22

Other clouds (AWS/GCP):
  - AWS VPC: 172.16.0.0/16
```

**Critical rule:** Azure VNet address spaces must NOT overlap with on-premises networks if you're using VPN or ExpressRoute connectivity. Overlapping prefixes cause routing failures.

## Step 2 — Allocate Address Ranges

### Regional allocation strategy

Assign a large block per region and subdivide:

```
10.0.0.0/8 (entire Azure allocation)
├── 10.0.0.0/16   — Reserved (don't use .0 range for clarity)
├── 10.1.0.0/16   — East US (primary region)
│   ├── 10.1.0.0/22   — Hub VNet
│   ├── 10.1.4.0/22   — Spoke: App1
│   ├── 10.1.8.0/22   — Spoke: App2
│   └── 10.1.12.0/22  — Spoke: App3
├── 10.2.0.0/16   — West US (secondary region)
│   ├── 10.2.0.0/22   — Hub VNet
│   ├── 10.2.4.0/22   — Spoke: App1-DR
│   └── 10.2.8.0/22   — Spoke: App2-DR
├── 10.10.0.0/16  — On-premises (reserved, don't use in Azure)
├── 10.100.0.0/16 — Dev/Test
└── 10.200.0.0/16 — Sandbox
```

### Environment-based allocation

```
Production:   10.1.0.0/16 – 10.9.0.0/16
Staging:      10.50.0.0/16 – 10.59.0.0/16
Dev/Test:     10.100.0.0/16 – 10.109.0.0/16
Sandbox:      10.200.0.0/16 – 10.209.0.0/16
On-premises:  10.10.0.0/16 – 10.19.0.0/16 (reserved)
```

## Step 3 — Size VNets and Subnets

### CIDR sizing reference

| CIDR | Subnet Mask | Total IPs | Usable in Azure | Typical Use |
|------|-------------|-----------|----------------|-------------|
| /28 | 255.255.255.240 | 16 | 11 | Small dedicated subnets (DNS resolver, point-to-site) |
| /27 | 255.255.255.224 | 32 | 27 | GatewaySubnet, small service subnets |
| /26 | 255.255.255.192 | 64 | 59 | AzureFirewallSubnet, AzureBastionSubnet |
| /25 | 255.255.255.128 | 128 | 123 | Small application tiers |
| /24 | 255.255.255.0 | 256 | 251 | Standard workload subnet |
| /23 | 255.255.254.0 | 512 | 507 | Large workload subnet |
| /22 | 255.255.252.0 | 1,024 | 1,019 | Hub VNet, large spoke VNet |
| /21 | 255.255.248.0 | 2,048 | 2,043 | Large spoke VNet |
| /20 | 255.255.240.0 | 4,096 | 4,091 | AKS cluster VNet |
| /16 | 255.255.0.0 | 65,536 | 65,531 | Regional allocation block |

### VNet sizing guidelines

| VNet Type | Recommended Size | Rationale |
|-----------|-----------------|-----------|
| Hub VNet | /22 (1,019 IPs) | Firewall, gateway, bastion, DNS, shared services |
| Small spoke | /24 (251 IPs) | Single-tier app with < 50 VMs |
| Medium spoke | /22 (1,019 IPs) | Multi-tier app with 50-200 resources |
| Large spoke | /20 (4,091 IPs) | AKS, large VMSS, data platforms |
| AKS cluster | /20 or larger | Azure CNI assigns pod IPs from subnet |

### Subnet sizing for Azure services

Some Azure services have **minimum subnet size requirements:**

| Azure Service | Minimum Subnet Size | Recommended Size | Notes |
|---------------|---------------------|-----------------|-------|
| GatewaySubnet | /27 | /27 | Must be named "GatewaySubnet" |
| AzureFirewallSubnet | /26 | /26 | Must be named "AzureFirewallSubnet" |
| AzureBastionSubnet | /26 | /26 | Must be named "AzureBastionSubnet" |
| Application Gateway | /26 | /24 | Needs IPs for instances + private frontends |
| API Management (Premium) | /27 | /27 | Dedicated subnet required |
| Azure SQL MI | /27 | /27 | Dedicated subnet with delegation |
| AKS (Azure CNI) | Varies | /20 per node pool | Each pod gets a subnet IP |
| Private Endpoints | /27 minimum | /24 | Each endpoint uses 1 IP |
| DNS Private Resolver Inbound | /28 | /28 | Dedicated, no other resources |
| DNS Private Resolver Outbound | /28 | /28 | Dedicated, no other resources |

## Step 4 — Plan for Growth

### The 5x rule

Plan for **5x your current needs.** If you need 50 IPs today, allocate a subnet that can handle 250.

Why:
- Adding VMs during scale-out events
- Blue-green deployments temporarily double resource count
- Migration periods run old and new side by side
- Services like AKS consume IPs rapidly (pod IPs)

### You cannot resize a VNet without downtime

You CAN add additional address prefixes to a VNet:

```bash
# Add a second address prefix to an existing VNet
az network vnet update \
  -g <rg> \
  -n <vnet> \
  --address-prefixes 10.1.0.0/22 10.1.4.0/22
```

But you CANNOT shrink or change an existing prefix if subnets are deployed in it. Plan generously upfront.

## IPv6 Considerations

Azure supports dual-stack (IPv4 + IPv6) VNets. Key points:

- IPv6 subnets must be at least /64
- Most Azure services support dual-stack, but some (like Azure Firewall Basic) do not
- NSGs, UDRs, and peering all work with IPv6
- Private endpoints are IPv4-only as of 2024

```bash
# Add IPv6 address space to existing VNet
az network vnet update \
  -g <rg> \
  -n <vnet> \
  --address-prefixes 10.1.0.0/22 fd00:db8:1::/48

# Create dual-stack subnet
az network vnet subnet create \
  -g <rg> \
  --vnet-name <vnet> \
  -n dual-stack-subnet \
  --address-prefixes 10.1.1.0/24 fd00:db8:1:1::/64
```

## Avoiding IP Conflicts

### Conflict detection checklist

Before deploying a new VNet:

1. Check on-premises IPAM (IP Address Management) system
2. List all existing VNet address spaces:
   ```bash
   az network vnet list --query "[].{name:name, rg:resourceGroup, prefixes:addressSpace.addressPrefixes}" -o table
   ```
3. Check VPN/ExpressRoute local network gateways (advertised on-premises ranges):
   ```bash
   az network local-gateway list -g <rg> --query "[].{name:name, prefixes:localNetworkAddressSpace.addressPrefixes}"
   ```
4. Check for any peering address space overlaps

### When you do have an overlap

If you inherit overlapping address spaces (e.g., after a merger):
- **NAT Gateway** can translate between overlapping ranges
- **Azure Firewall DNAT** rules can map overlapping addresses
- **Re-IP one side** — the cleanest solution but most disruptive
- **Private Link** — access PaaS services without worrying about IP overlaps

## Example: Complete IP Plan for a 3-tier Application

```
Region: East US
VNet: app-prod-eastus (10.1.4.0/22)

Subnets:
├── web-subnet        10.1.4.0/26   (59 usable)  — Web tier VMs, App Gateway
├── app-subnet        10.1.4.64/26  (59 usable)  — App tier VMs
├── data-subnet       10.1.4.128/26 (59 usable)  — Database VMs
├── pe-subnet         10.1.4.192/27 (27 usable)  — Private endpoints
├── appgw-subnet      10.1.5.0/24   (251 usable) — Application Gateway (dedicated)
└── reserved          10.1.6.0/23   (507 usable) — Future expansion
```

## IP Planning Checklist

- [ ] Existing on-premises and cloud IP spaces documented
- [ ] Regional allocation blocks assigned (no overlaps)
- [ ] Hub VNet sized for all shared service subnets
- [ ] Spoke VNets sized for current needs + 5x growth
- [ ] Special Azure subnet sizes respected (Gateway, Firewall, Bastion)
- [ ] AKS CIDR requirements calculated (if using Azure CNI)
- [ ] IPv6 requirements assessed
- [ ] Overlap check completed against all environments
- [ ] IP plan documented and added to IPAM system

## Related Resources

- [Plan virtual networks](https://learn.microsoft.com/azure/virtual-network/virtual-network-vnet-plan-design-arm)
- [Azure VNet FAQ — address space](https://learn.microsoft.com/azure/virtual-network/virtual-networks-faq#what-address-ranges-can-i-use-in-my-vnets)
- [IPv6 for Azure VNet](https://learn.microsoft.com/azure/virtual-network/ip-services/ipv6-overview)
- For hub-spoke topology → see [hub-spoke-design.md](hub-spoke-design.md)
- For VNet configuration → use `azure-virtual-network` skill
