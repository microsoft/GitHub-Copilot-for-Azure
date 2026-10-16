# ExpressRoute Peering Configuration

## Peering Types Overview

ExpressRoute supports two peering types (Azure public peering is deprecated):

| Peering | Purpose | What You Reach | BGP Required |
|---------|---------|---------------|-------------|
| **Azure Private Peering** | Connect to VNets | VMs, ILBs, private endpoints, all private IPs in linked VNets | Yes |
| **Microsoft Peering** | Connect to Microsoft services | Microsoft 365, Azure PaaS public IPs, Dynamics 365 | Yes |

Both peerings can be configured on the same circuit simultaneously.

## Azure Private Peering

Private peering connects your on-premises network to Azure VNets over ExpressRoute. All traffic stays on the Microsoft backbone and never traverses the public internet.

### Subnet Requirements

You must provide two /30 subnets (or /126 for IPv6) — one for the primary link and one for the secondary link:

- **Primary subnet:** /30 — first usable IP for your router, second usable IP for Microsoft router
- **Secondary subnet:** /30 — same pattern, for redundancy

Example:
- Primary: 10.0.0.0/30 → Your router: 10.0.0.1, Microsoft: 10.0.0.2
- Secondary: 10.0.0.4/30 → Your router: 10.0.0.5, Microsoft: 10.0.0.6

These subnets **must not overlap** with any VNet address space or on-prem ranges.

### VLAN ID

You must assign a unique VLAN ID for each peering. This VLAN isolates the peering traffic on the physical link. Coordinate with your provider for available VLAN IDs.

### Create Private Peering

```bash
az network express-route peering create \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --peering-type AzurePrivatePeering \
  --peer-asn <on-prem-asn> \
  --primary-peer-subnet 10.0.0.0/30 \
  --secondary-peer-subnet 10.0.0.4/30 \
  --vlan-id 100
```

### BGP Configuration for Private Peering

| Parameter | Value |
|-----------|-------|
| Azure ASN | 12076 (always) |
| Your ASN | Any valid private ASN (e.g., 65001). Avoid: 12076, 65515, 65520 |
| Primary BGP session | Your router (10.0.0.1) ↔ Microsoft (10.0.0.2) |
| Secondary BGP session | Your router (10.0.0.5) ↔ Microsoft (10.0.0.6) |

**Route advertisement:** Azure advertises all VNet address prefixes linked to the circuit. Your on-prem advertises your network prefixes.

### Route Limits

| SKU | Max Routes (Private Peering) |
|-----|------------------------------|
| Standard | 4,000 |
| Premium | 10,000 |

If you exceed the route limit, the BGP session drops. Monitor route count:

```bash
az network express-route peering show \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name AzurePrivatePeering \
  --query "ipv4PeeringInfo.{advertisedRoutes:primaryPeerAddressPrefix, routeCount:routeCount}"
```

### MD5 Hash (Optional)

For additional security, configure an MD5 hash on the BGP session:

```bash
az network express-route peering update \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name AzurePrivatePeering \
  --shared-key <md5-hash>
```

## Microsoft Peering

Microsoft peering provides access to Microsoft public services (Microsoft 365, Azure PaaS with public IPs, Dynamics 365) over the ExpressRoute circuit.

### Requirements

- **Public IP prefixes or ASN** — you must own the public IP prefixes you advertise, or use an ASN registered in an IRR (Internet Routing Registry)
- **Route filter mandatory** — you must create and attach a route filter specifying which BGP communities to accept
- **VLAN ID** — separate VLAN from private peering

### Create Microsoft Peering

```bash
az network express-route peering create \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --peering-type MicrosoftPeering \
  --peer-asn <your-public-asn> \
  --primary-peer-subnet <primary-public-/30> \
  --secondary-peer-subnet <secondary-public-/30> \
  --vlan-id 200 \
  --advertised-public-prefixes <your-public-prefix>
```

### Route Filters

Route filters control which Microsoft service prefixes are advertised to your network. Without a route filter, no Microsoft service routes are received.

```bash
# Create a route filter
az network route-filter create \
  --name <filter-name> \
  --resource-group <rg>

# Add a rule to allow specific service communities
az network route-filter rule create \
  --filter-name <filter-name> \
  --resource-group <rg> \
  --name AllowAzureServices \
  --access Allow \
  --communities "12076:5010" "12076:5020" "12076:5030"

# Attach route filter to Microsoft peering
az network express-route peering update \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name MicrosoftPeering \
  --route-filter <filter-resource-id>
```

### Common BGP Community Values

| Community | Service |
|-----------|---------|
| 12076:5010 | Azure region services (e.g., Azure Storage, SQL) |
| 12076:5020 | Microsoft 365 (Exchange Online, SharePoint) |
| 12076:5030 | Other Microsoft online services |
| 12076:5040 | Azure region-specific (varies by region) |

Region-specific communities allow you to receive routes only for specific Azure regions (e.g., 12076:51004 for West US).

## Verifying Peering Status

```bash
# Show all peerings on a circuit
az network express-route peering list \
  --circuit-name <circuit-name> \
  --resource-group <rg>

# Check BGP session state for private peering
az network express-route peering show \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name AzurePrivatePeering \
  --query "{state:peeringState, primaryPeer:primaryPeerAddressPrefix, secondaryPeer:secondaryPeerAddressPrefix}"
```

### Expected States

| State | Meaning |
|-------|---------|
| `Enabled` | Peering configured and active |
| `Disabled` | Peering configured but not active (check BGP) |
| Not present | Peering not yet configured |

## Route Table Inspection

View routes learned and advertised on the peering:

```bash
# View routes advertised by Azure to your router (primary link)
az network express-route list-route-tables \
  --name <circuit-name> \
  --resource-group <rg> \
  --path primary \
  --peering-name AzurePrivatePeering

# View routes advertised by Azure to your router (secondary link)
az network express-route list-route-tables \
  --name <circuit-name> \
  --resource-group <rg> \
  --path secondary \
  --peering-name AzurePrivatePeering
```

## Troubleshooting Peering Issues

### BGP Session Not Establishing

1. **Verify VLAN tagging** — ensure your router tags traffic with the correct VLAN ID
2. **Check subnet IPs** — your router must use the first usable IP; Microsoft uses the second
3. **Verify ASN** — your peer ASN must match what you configured; don't use 12076
4. **Check MD5 hash** — if configured, both sides must use the same key
5. **Provider status** — circuit must be in `Provisioned` state before peering works

### Routes Not Being Received

1. **Route filter missing** (Microsoft peering) — attach a route filter with appropriate communities
2. **Route limit exceeded** — reduce the number of prefixes advertised from on-prem
3. **Circuit not linked to VNet** (private peering) — connect the ER gateway to the circuit
4. **Asymmetric routing** — verify both primary and secondary links are active and correctly configured

### BGP Flapping

1. **Check physical link stability** with your provider
2. **Verify hold timer** — default is 180 seconds; overly aggressive timers cause flapping
3. **Enable BFD** — Bidirectional Forwarding Detection provides faster failure detection without BGP timer sensitivity

## Additional References

- [Configure ExpressRoute peering](https://learn.microsoft.com/azure/expressroute/expressroute-howto-routing-arm)
- [Route filters for Microsoft peering](https://learn.microsoft.com/azure/expressroute/how-to-routefilter-cli)
- [BGP communities](https://learn.microsoft.com/azure/expressroute/expressroute-routing)
