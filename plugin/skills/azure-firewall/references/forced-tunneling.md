# Azure Firewall Forced Tunneling

Forced tunneling allows you to route all internet-bound traffic from Azure Firewall to an on-premises network or network virtual appliance (NVA) for inspection before it reaches the internet. This is a common requirement for organizations with regulatory mandates that all internet egress pass through an on-premises proxy or security stack.

## How Forced Tunneling Works

In normal operation, Azure Firewall sends internet-bound traffic directly to the internet. With forced tunneling:

1. A default route (0.0.0.0/0) on the AzureFirewallSubnet points to an on-premises gateway (VPN/ExpressRoute) or NVA
2. Internet-bound traffic from the firewall is routed to the on-premises network instead of directly to the internet
3. The on-premises appliance inspects, logs, or modifies the traffic before forwarding it to the internet (or dropping it)
4. The firewall retains a **separate management path** via the AzureFirewallManagementSubnet for its own control-plane traffic (health probes, updates, metrics)

```
Spoke VNet traffic
       │
       ▼
┌──────────────┐    Data plane traffic    ┌────────────────┐
│ Azure        │ ───(0.0.0.0/0 UDR)───→  │ On-premises /  │ ──→ Internet
│ Firewall     │                          │ NVA            │
│              │    Management traffic     └────────────────┘
│              │ ───(mgmt public IP)───→ Internet (direct)
└──────────────┘
```

## Prerequisites

Forced tunneling requires:

1. **Azure Firewall Standard or Premium** — forced tunneling is not supported on Basic SKU
2. **AzureFirewallManagementSubnet** — a dedicated /26 (minimum) subnet in the same VNet
3. **Management public IP** — a separate public IP address associated with the management subnet
4. **UDR on AzureFirewallSubnet** — default route (0.0.0.0/0) pointing to the on-premises gateway or NVA next hop

## Subnet Requirements

| Subnet | Name (exact) | Minimum size | Purpose |
|--------|-------------|--------------|---------|
| Firewall subnet | `AzureFirewallSubnet` | /26 | Handles data-plane traffic (user workload traffic) |
| Management subnet | `AzureFirewallManagementSubnet` | /26 | Handles management-plane traffic (health probes, updates, telemetry) |

**Important**:
- The management subnet name must be exactly `AzureFirewallManagementSubnet` — Azure will not accept any other name
- The management subnet must have a direct internet path via its public IP (no UDR overriding 0.0.0.0/0 on this subnet)
- The management subnet must not have an NSG that blocks outbound internet access
- Do not apply a UDR with a 0.0.0.0/0 route to the management subnet

## Configuration Steps

### Step 1: Create the management subnet

```bash
az network vnet subnet create \
  --name AzureFirewallManagementSubnet \
  --resource-group <rg-name> \
  --vnet-name <vnet-name> \
  --address-prefix 10.0.2.0/26
```

### Step 2: Create the management public IP

```bash
az network public-ip create \
  --name <fw-mgmt-pip-name> \
  --resource-group <rg-name> \
  --sku Standard \
  --allocation-method Static
```

### Step 3: Deploy the firewall with forced tunneling

When deploying a new firewall with forced tunneling:

```bash
az network firewall create \
  --name <fw-name> \
  --resource-group <rg-name> \
  --vnet-name <vnet-name> \
  --conf-name data-ip-config \
  --public-ip <fw-data-pip-name> \
  --m-conf-name mgmt-ip-config \
  --m-public-ip <fw-mgmt-pip-name>
```

The `--m-conf-name` and `--m-public-ip` parameters enable the management interface for forced tunneling.

### Step 4: Create a UDR for the AzureFirewallSubnet

```bash
# Create route table
az network route-table create \
  --name <fw-rt-name> \
  --resource-group <rg-name>

# Add default route pointing to on-premises/NVA
az network route-table route create \
  --name "forced-tunnel-default" \
  --resource-group <rg-name> \
  --route-table-name <fw-rt-name> \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <on-prem-gateway-or-nva-ip>

# Associate route table with AzureFirewallSubnet
az network vnet subnet update \
  --name AzureFirewallSubnet \
  --resource-group <rg-name> \
  --vnet-name <vnet-name> \
  --route-table <fw-rt-name>
```

### For VPN/ExpressRoute gateway as next hop

If using a VPN Gateway or ExpressRoute gateway for the tunnel (instead of an NVA IP):

```bash
az network route-table route create \
  --name "forced-tunnel-default" \
  --resource-group <rg-name> \
  --route-table-name <fw-rt-name> \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualNetworkGateway
```

## Important Behavior Notes

1. **DNAT is not supported**: When forced tunneling is enabled, DNAT rules cannot be used because the inbound return path would be asymmetric. Remove or avoid DNAT rules on forced-tunneled firewalls.

2. **Public IP on the data plane**: The firewall still has a public IP on the data subnet even with forced tunneling. This IP is used for SNAT of private-to-private traffic and Azure service dependencies. It does NOT receive inbound traffic from the internet when forced tunneling is active.

3. **DNS considerations**: If DNS queries also route through the tunnel, ensure the on-premises DNS infrastructure can resolve Azure-specific FQDNs needed by firewall application rules.

4. **Firewall health**: If the management subnet loses internet connectivity, the firewall becomes unhealthy. Always ensure the management path has uninterrupted internet access.

5. **Asymmetric routing prevention**: Traffic from spokes to the internet must flow: Spoke → Firewall → On-prem → Internet, and the return path must follow the same reverse path. Asymmetric routing will cause dropped connections.

## Adding Forced Tunneling to an Existing Firewall

An existing firewall without forced tunneling cannot have forced tunneling added in-place. You must:

1. Stop (deallocate) the existing firewall
2. Create the management subnet and management public IP
3. Reallocate the firewall with the management IP configuration
4. Create the UDR on the AzureFirewallSubnet

```bash
# Deallocate the firewall
az network firewall ip-config delete \
  --firewall-name <fw-name> \
  --resource-group <rg-name> \
  --name <ip-config-name>

# Reallocate with management interface (portal or ARM template recommended)
```

> **Tip**: For existing firewalls, it is often easier to use an ARM/Bicep template or the Azure portal to reconfigure with forced tunneling than CLI.

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Firewall shows unhealthy | Management subnet has a UDR overriding 0.0.0.0/0 | Remove UDR from AzureFirewallManagementSubnet; it must have direct internet access |
| Firewall shows unhealthy | NSG blocking outbound on management subnet | Remove or adjust NSG to allow outbound internet |
| Internet traffic not reaching on-prem | UDR not applied to AzureFirewallSubnet | Verify route table association on the correct subnet |
| DNAT rules not working | Expected — DNAT is incompatible with forced tunneling | Use a load balancer or different ingress method |
| Spoke traffic bypasses firewall | Spoke UDRs not pointing to firewall | Ensure spoke subnets have UDR 0.0.0.0/0 → firewall private IP |

## Related

- [firewall-skus.md](firewall-skus.md) — SKU support for forced tunneling (Standard and Premium only)
- [rule-types.md](rule-types.md) — DNAT incompatibility with forced tunneling
- [Azure Firewall forced tunneling](https://learn.microsoft.com/azure/firewall/forced-tunneling)
