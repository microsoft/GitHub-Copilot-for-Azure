# ExpressRoute Global Reach

## Overview

ExpressRoute Global Reach enables direct connectivity between two on-premises networks through the Microsoft global backbone, leveraging their existing ExpressRoute circuits. Traffic between the sites flows through the Microsoft network and never touches the public internet.

```
On-Premises Site A ──── ExpressRoute Circuit A ──── Microsoft Backbone ──── ExpressRoute Circuit B ──── On-Premises Site B
```

Without Global Reach, site-to-site connectivity between two ExpressRoute-connected locations would require a VPN tunnel over the internet or a router in an Azure VNet acting as transit — both suboptimal.

## When to Use Global Reach

- **Branch-to-branch traffic** through Azure backbone instead of over the internet
- **Data replication** between two on-premises datacenters using Microsoft's private backbone
- **Disaster recovery** between on-premises sites using low-latency private connectivity
- **Migration** between datacenters connected to different ExpressRoute peering locations

## Requirements

- Both circuits must have **private peering** configured and active
- Both circuits must be in **Provisioned** state
- At least one circuit must be **Premium** SKU (unless both are in the same geopolitical region)
- Peering locations must be in [supported regions](https://learn.microsoft.com/azure/expressroute/expressroute-global-reach#availability)
- Non-overlapping **/29 subnets** for the Global Reach BGP sessions (one for primary, can auto-allocate)

## Supported Regions

Global Reach is available in select peering locations. As of the current documentation, supported regions include:

- **Americas:** Atlanta, Chicago, Dallas, Denver, Los Angeles, Miami, Minneapolis, New York, Phoenix, San Antonio, Seattle, Silicon Valley, Washington DC, Montreal, Toronto, Sao Paulo
- **Europe:** Amsterdam, Dublin, Frankfurt, Geneva, London, Madrid, Marseille, Milan, Oslo, Paris, Stockholm, Vienna, Zurich
- **Asia Pacific:** Hong Kong, Melbourne, Osaka, Perth, Seoul, Singapore, Sydney, Taipei, Tokyo
- **Middle East:** Dubai

Check the [latest availability](https://learn.microsoft.com/azure/expressroute/expressroute-global-reach#availability) as new locations are added regularly.

## Configuration

### Enable Global Reach Between Two Circuits

```bash
# Get the resource ID of Circuit B
CIRCUIT_B_ID=$(az network express-route show \
  --name <circuit-b-name> \
  --resource-group <circuit-b-rg> \
  --query id -o tsv)

# Enable Global Reach on Circuit A's private peering
az network express-route peering connection create \
  --circuit-name <circuit-a-name> \
  --resource-group <circuit-a-rg> \
  --peering-name AzurePrivatePeering \
  --name <global-reach-conn-name> \
  --peer-circuit $CIRCUIT_B_ID \
  --address-prefix 172.16.0.0/29
```

The `--address-prefix` is a /29 subnet used for the BGP sessions between the two circuits. It must not overlap with any VNet, on-prem, or peering subnet.

### Verify Global Reach Connection

```bash
az network express-route peering connection show \
  --circuit-name <circuit-a-name> \
  --resource-group <circuit-a-rg> \
  --peering-name AzurePrivatePeering \
  --name <global-reach-conn-name>
```

**Expected output:** `circuitConnectionStatus: Connected`

### Check Routes Learned via Global Reach

```bash
# On Circuit A — should now show Site B's prefixes
az network express-route list-route-tables \
  --name <circuit-a-name> \
  --resource-group <circuit-a-rg> \
  --path primary \
  --peering-name AzurePrivatePeering
```

You should see routes from Site B's on-premises network appearing in Circuit A's route table, and vice versa.

## Architecture Considerations

### Traffic Flow

```
Site A (10.1.0.0/16) → Circuit A → Azure Backbone → Circuit B → Site B (10.2.0.0/16)
```

- Traffic does **not** traverse any Azure VNet
- Traffic does **not** require any gateway or routing configuration in Azure VNets
- Both sites continue to reach Azure VNets through their respective circuit connections independently
- Global Reach adds site-to-site routes on top of existing Azure connectivity

### Address Space Planning

Ensure these ranges do not overlap:
- Site A on-premises prefixes
- Site B on-premises prefixes
- Azure VNet address spaces connected to either circuit
- Global Reach /29 peering subnet

### Bandwidth

Global Reach bandwidth is limited by the **lower bandwidth** of the two circuits. If Circuit A is 1 Gbps and Circuit B is 2 Gbps, the Global Reach connection is capped at 1 Gbps.

### Latency

Traffic follows the optimal path across the Microsoft backbone between the two peering locations. Latency depends on the physical distance between peering locations. For same-metro locations, latency is typically sub-millisecond. For cross-continent, expect tens of milliseconds.

## Multi-Circuit Scenarios

You can enable Global Reach between multiple circuit pairs to create a mesh:

```
Circuit A ←→ Circuit B (Global Reach)
Circuit A ←→ Circuit C (Global Reach)
Circuit B ←→ Circuit C (Global Reach)
```

This connects all three on-premises sites through the Microsoft backbone.

## Removing Global Reach

```bash
az network express-route peering connection delete \
  --circuit-name <circuit-a-name> \
  --resource-group <circuit-a-rg> \
  --peering-name AzurePrivatePeering \
  --name <global-reach-conn-name>
```

Removing Global Reach does not affect the circuits' connectivity to Azure VNets.

## Troubleshooting

### Connection Status Not "Connected"

1. **Both circuits must be Provisioned** — check `serviceProviderProvisioningState`
2. **Private peering must be active** on both circuits
3. **Premium SKU required** if circuits are in different geopolitical regions
4. **Check region support** — not all peering locations support Global Reach
5. **Overlapping subnets** — the /29 Global Reach subnet must not conflict with existing ranges

### Routes Not Propagating

1. **Wait 5-10 minutes** after enabling — BGP convergence may take time
2. **Check on-prem advertisement** — your router must be advertising on-prem prefixes over private peering
3. **Route limits** — combined routes from both sites must be within the circuit's route limit (4,000 standard / 10,000 premium)
4. **Verify BGP sessions** — check that private peering BGP sessions are established on both circuits

### Performance Issues

1. **Bandwidth cap** — check the lower bandwidth of the two circuits
2. **Sub-optimal routing** — verify that traffic is taking the expected path through peering locations
3. **Asymmetric paths** — if using multiple circuits, ensure routing is symmetric to avoid drops

## Cost Considerations

- Global Reach has its own pricing, billed per GB of data transferred between the circuits
- Circuit costs are separate and still apply for each circuit
- No additional infrastructure (gateways, VMs) needed in Azure — cost is purely for the Global Reach data transfer

## Additional References

- [ExpressRoute Global Reach](https://learn.microsoft.com/azure/expressroute/expressroute-global-reach)
- [Configure Global Reach](https://learn.microsoft.com/azure/expressroute/expressroute-howto-set-global-reach-cli)
- [Global Reach availability](https://learn.microsoft.com/azure/expressroute/expressroute-global-reach#availability)
