# Azure Virtual Network Fundamentals

## Overview

An Azure Virtual Network (VNet) is the fundamental building block for private networking in Azure. It enables Azure resources such as VMs, App Services, and databases to securely communicate with each other, the internet, and on-premises networks.

Each VNet is isolated from other VNets by default. Resources in one VNet cannot communicate with resources in another VNet unless you explicitly configure connectivity through peering, VPN gateways, or other mechanisms.

VNets are scoped to a single Azure region and a single subscription. To span regions, you use global VNet peering or VPN/ExpressRoute connections.

## Address Space Planning

### RFC 1918 Private Address Ranges

Azure VNets support the following private address ranges defined in RFC 1918:

| Range | CIDR | Total Addresses | Common Use |
|-------|------|-----------------|------------|
| 10.0.0.0 – 10.255.255.255 | 10.0.0.0/8 | 16,777,216 | Large enterprise networks |
| 172.16.0.0 – 172.31.255.255 | 172.16.0.0/12 | 1,048,576 | Medium deployments |
| 192.168.0.0 – 192.168.255.255 | 192.168.0.0/16 | 65,536 | Small labs, dev/test |

Azure also supports:
- **100.64.0.0/10** (CGNAT range) — usable in VNets but may conflict with some ISP traffic
- **Public IP ranges you own** (BYOIP) — requires validation through Azure Custom IP Prefix

### Recommended Address Space Strategy

1. **Plan for growth**: allocate a larger CIDR block than currently needed (e.g., /16 instead of /20).
2. **Use a consistent scheme**: assign address ranges systematically across subscriptions and regions.
3. **Avoid overlaps**: overlapping address spaces prevent VNet peering and VPN connectivity.
4. **Document allocations**: maintain an IP Address Management (IPAM) registry.
5. **Align with on-premises**: if hybrid, coordinate with on-premises network teams to avoid conflicts.

### Example Enterprise Address Plan

| Environment | Region | VNet CIDR | Purpose |
|-------------|--------|-----------|---------|
| Hub | East US | 10.0.0.0/16 | Shared services, firewall, DNS |
| Spoke-Prod | East US | 10.1.0.0/16 | Production workloads |
| Spoke-Dev | East US | 10.2.0.0/16 | Development workloads |
| Hub | West US | 10.10.0.0/16 | DR shared services |
| Spoke-Prod | West US | 10.11.0.0/16 | DR production workloads |
| On-premises DC | — | 172.16.0.0/12 | Corporate data center |

## Subnet Design Patterns

### Hub-Spoke Pattern

The hub VNet contains shared services; spoke VNets contain workload-specific resources.

**Hub VNet (10.0.0.0/16) subnets:**

| Subnet | CIDR | Usable IPs | Purpose |
|--------|------|------------|---------|
| AzureFirewallSubnet | 10.0.0.0/26 | 59 | Azure Firewall (required name and min /26) |
| AzureBastionSubnet | 10.0.1.0/26 | 59 | Azure Bastion (required name and min /26) |
| GatewaySubnet | 10.0.2.0/27 | 27 | VPN/ExpressRoute gateway (required name) |
| SharedServicesSubnet | 10.0.3.0/24 | 251 | DNS, AD DS, monitoring |
| ManagementSubnet | 10.0.4.0/24 | 251 | Jump boxes, DevOps agents |

**Spoke VNet (10.1.0.0/16) subnets:**

| Subnet | CIDR | Usable IPs | Purpose |
|--------|------|------------|---------|
| WebSubnet | 10.1.0.0/24 | 251 | Front-end web servers |
| AppSubnet | 10.1.1.0/24 | 251 | Application tier |
| DataSubnet | 10.1.2.0/24 | 251 | Database tier |
| IntegrationSubnet | 10.1.3.0/24 | 251 | API Management, Logic Apps |

### Tiered Application Pattern

For a single VNet hosting a traditional 3-tier application:

| Subnet | CIDR | NSG | Purpose |
|--------|------|-----|---------|
| FrontendSubnet | 10.0.0.0/24 | Allow 80/443 inbound from Internet | Load balancers, web servers |
| BackendSubnet | 10.0.1.0/24 | Allow app ports from FrontendSubnet only | Application servers |
| DatabaseSubnet | 10.0.2.0/24 | Allow DB ports from BackendSubnet only | SQL, Cosmos DB endpoints |
| ManagementSubnet | 10.0.3.0/24 | Allow SSH/RDP from Bastion only | Admin access, jump boxes |

### Workload Isolation Pattern

Separate VNets per workload with peering through a hub:

- Each workload team owns their VNet and subnets.
- The hub VNet provides DNS, firewall, and gateway services.
- Peering connects spokes to the hub; spokes cannot communicate directly (non-transitive).
- Network Virtual Appliances (NVAs) or Azure Firewall enable spoke-to-spoke traffic when needed.

## Azure Reserved Addresses

Azure reserves 5 IP addresses in every subnet — the first 4 and the last 1:

| Offset | Address Example (/24) | Purpose |
|--------|----------------------|---------|
| +0 | 10.0.0.0 | Network identifier |
| +1 | 10.0.0.1 | Default gateway for the subnet |
| +2 | 10.0.0.2 | Azure DNS (primary) |
| +3 | 10.0.0.3 | Azure DNS (secondary) |
| Last | 10.0.0.255 | Network broadcast |

**Usable addresses per CIDR:**

| CIDR | Total | Usable | % Usable |
|------|-------|--------|----------|
| /28 | 16 | 11 | 69% |
| /27 | 32 | 27 | 84% |
| /26 | 64 | 59 | 92% |
| /25 | 128 | 123 | 96% |
| /24 | 256 | 251 | 98% |
| /23 | 512 | 507 | 99% |
| /22 | 1,024 | 1,019 | 99.5% |
| /20 | 4,096 | 4,091 | 99.9% |
| /16 | 65,536 | 65,531 | ~100% |

The smallest supported subnet in Azure is **/29** (8 addresses, 3 usable). However, some services require larger minimums — for example, AzureFirewallSubnet and AzureBastionSubnet require at minimum **/26**.

## Subnet Delegation

Subnet delegation assigns a subnet to a specific Azure service, giving that service permission to inject service-specific resources and configure networking.

### Delegated Services (Common)

| Service | Delegation Name | Min Subnet |
|---------|----------------|------------|
| Azure App Service | Microsoft.Web/serverFarms | /26 |
| Azure Container Instances | Microsoft.ContainerInstance/containerGroups | /24 recommended |
| Azure SQL Managed Instance | Microsoft.Sql/managedInstances | /27 (dedicated subnet) |
| Azure NetApp Files | Microsoft.Netapp/volumes | /28 |
| Azure Databricks | Microsoft.Databricks/workspaces | /26 per workspace |
| Azure API Management (v2) | Microsoft.ApiManagement/service | /27 |

### Delegation Rules

1. A subnet can be delegated to **only one service** at a time.
2. You **cannot** deploy non-delegated resources (like VMs) into a delegated subnet.
3. Removing delegation may require deleting all resources in the subnet first.
4. NSGs and UDRs still apply to delegated subnets (with some service-specific exceptions).
5. Plan delegated subnets separately — they cannot be shared with other workloads.

## VNet Limits

| Resource | Default Limit | Max (with support request) |
|----------|--------------|---------------------------|
| VNets per subscription per region | 1,000 | 1,000 |
| Subnets per VNet | 3,000 | 3,000 |
| VNet peerings per VNet | 500 | 500 (hard limit) |
| Address spaces per VNet | 100 | Varies |
| Private IP addresses per VNet | 65,536 | 65,536 |
| NSGs per subscription per region | 5,000 | 5,000 |
| Rules per NSG | 1,000 | 1,000 |
| Public IP addresses per subscription per region | 1,000 | Contact support |
| Route tables per subscription per region | 1,000 | 1,000 |
| Routes per route table | 400 | 400 |

> **Note**: Limits are per subscription per region. Request increases through Azure Support if needed. Some limits (like peerings per VNet) are hard limits that cannot be increased.

## VNet Encryption

VNet encryption encrypts traffic between VMs within the same VNet and across peered VNets. It provides an additional layer of protection for data in transit within Azure's backbone.

### Requirements

- VMs must support **Accelerated Networking** (required for encryption).
- Supported VM SKUs include most Dv4/Ev4 and newer generation series.
- Both source and destination VMs must have Accelerated Networking enabled.
- Encryption is configured at the VNet level and applies to all VM-to-VM traffic.
- Available in specific regions — check Azure documentation for current availability.

### Enabling VNet Encryption

```bash
# Enable encryption on an existing VNet
az network vnet update -g MyRG -n MyVNet --enable-encryption true \
  --encryption-enforcement-policy AllowUnencrypted

# Enforcement policies:
# - AllowUnencrypted: Allows both encrypted and unencrypted traffic (gradual rollout)
# - DropUnencrypted: Drops traffic from VMs that don't support encryption
```

### Considerations

- **DropUnencrypted** enforcement will block traffic from VMs without Accelerated Networking — use `AllowUnencrypted` initially and switch after verifying all VMs are compatible.
- VNet encryption is separate from and complementary to application-level TLS/SSL.
- No performance degradation for supported VM SKUs — encryption is offloaded to hardware.
- Works across VNet peering when both VNets have encryption enabled.

## Best Practices

1. **Always plan address spaces before deploying** — changing VNet address space later can disrupt peerings and gateways.
2. **Use /16 for hub VNets** — leaves room for dozens of subnets with growth.
3. **Use /24 as the default subnet size** — 251 usable IPs covers most workloads with room to spare.
4. **Name subnets descriptively** — include the workload or tier name (e.g., `AppGw-Subnet`, `AKS-Nodes`).
5. **Assign NSGs to subnets, not NICs** — simplifies management and reduces rule duplication.
6. **Use tags consistently** — tag VNets and subnets with environment, owner, and cost center.
7. **Enable diagnostics logging** — send VNet flow logs to Log Analytics for monitoring and compliance.
8. **Automate with IaC** — use Bicep, Terraform, or ARM templates for repeatable VNet deployments.

## Troubleshooting

### Address Space Conflicts

**Symptom**: Cannot create VNet peering — error about overlapping address spaces.
**Cause**: The two VNets share at least one overlapping CIDR block.
**Fix**: Resize one VNet's address space or use NAT (Azure VNet NAT or NVA) if resizing is not possible.

### Subnet Too Small

**Symptom**: Cannot deploy resources — "not enough available addresses in the subnet."
**Cause**: The subnet CIDR does not have enough free IPs for the requested resources.
**Fix**: Resize the subnet (requires removing all resources first) or create a new larger subnet.

### Resources Cannot Communicate Within VNet

**Symptom**: VMs in the same VNet cannot reach each other.
**Cause**: NSG rules blocking traffic, or VMs are in subnets with restrictive UDRs.
**Fix**: Check effective security rules (`az network nic list-effective-nsg`), check effective routes (`az network nic show-effective-route-table`), and verify no `None` next-hop UDR is blocking traffic.

### Cannot Add Address Space to Existing VNet

**Symptom**: Error when trying to add a new address space to a VNet.
**Cause**: New address space overlaps with existing address space or peered VNet address space.
**Fix**: Choose a non-overlapping range. If peered, you may need to delete and recreate peering after the change.

### Subnet Deletion Fails

**Symptom**: Cannot delete a subnet — "subnet is in use."
**Cause**: Resources (NICs, private endpoints, delegations, service endpoints) still exist in the subnet.
**Fix**: Remove all resources from the subnet first, then remove delegation if present, then delete.

```bash
# Check what's in a subnet
az network vnet subnet show -g MyRG --vnet-name MyVNet -n MySubnet --query '{delegation:delegations, serviceEndpoints:serviceEndpoints, ipConfigurations:ipConfigurations}'
```
