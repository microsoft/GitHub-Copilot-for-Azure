# Azure Private DNS Zones

## Overview

Azure Private DNS provides a reliable and secure DNS service for your virtual networks. Private DNS zones let you use your own custom domain names instead of the Azure-provided names, with name resolution scoped entirely within your virtual network. Records in a Private DNS zone are not resolvable from the internet.

Private DNS zones are a global resource — they are not tied to a single region. VNets from any region can link to them.

## Core Concepts

**Private DNS zone:** A DNS zone that is only resolvable from linked virtual networks. You control the zone name (e.g., `contoso.internal`, `app.local`, or even `contoso.com` for split-horizon).

**VNet link:** A connection between a Private DNS zone and a virtual network. Without at least one link, the zone is useless. There are two types:
- **Resolution link** (`--registration-enabled false`): VMs in the linked VNet can resolve records in the zone, but their names are NOT automatically registered.
- **Registration link** (`--registration-enabled true`): VMs in the linked VNet can resolve records AND their names are automatically registered as A records.

## Creating a Private DNS Zone

```bash
# Create the zone
az network private-dns zone create \
  --resource-group MyRG \
  --name contoso.internal

# Verify
az network private-dns zone show \
  --resource-group MyRG \
  --name contoso.internal
```

## VNet Links

### Creating a Registration Link (Auto-Registration Enabled)

```bash
az network private-dns link vnet create \
  --resource-group MyRG \
  --zone-name contoso.internal \
  --name HubVNetLink \
  --virtual-network /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/HubVNet \
  --registration-enabled true
```

### Creating a Resolution-Only Link

```bash
az network private-dns link vnet create \
  --resource-group MyRG \
  --zone-name contoso.internal \
  --name SpokeVNetLink \
  --virtual-network /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/SpokeVNet \
  --registration-enabled false
```

### Listing and Managing Links

```bash
# List all VNet links for a zone
az network private-dns link vnet list -g MyRG -z contoso.internal -o table

# Delete a link
az network private-dns link vnet delete -g MyRG -z contoso.internal -n OldLink --yes
```

## Auto-Registration

When a VNet link has `--registration-enabled true`, Azure automatically creates and manages DNS records for VMs in that VNet.

**What gets registered:**
- Primary NIC's primary private IP address → A record using the VM name
- If the VM name is `webserver01`, the A record is `webserver01.contoso.internal`
- When the VM is deallocated or deleted, the record is automatically removed

**Limitations and rules:**
- A VNet can have auto-registration enabled for only ONE Private DNS zone.
- A Private DNS zone can have up to 100 VNet links with auto-registration enabled.
- Only VMs get auto-registered — other resources (load balancers, private endpoints, etc.) must have manual records.
- Auto-registration uses the VM name, not a custom hostname. If two VMs in linked VNets have the same name, it creates a conflict.
- NICs with multiple IP configurations: only the primary IP of the primary NIC is registered.

```bash
# Check if auto-registration is working
az network private-dns record-set a list -g MyRG -z contoso.internal -o table
```

## Split-Horizon DNS

Split-horizon means using the **same zone name** for both public and private DNS. For example, `contoso.com` can be a public zone in Azure DNS and a private zone in Azure Private DNS.

**How it works:**
- VMs in linked VNets resolve `app.contoso.com` from the Private DNS zone (returns internal IP).
- Internet clients resolve `app.contoso.com` from the public DNS zone (returns public IP).

**Setup:**

```bash
# Public zone (already exists or create it)
az network dns zone create -g MyRG -n contoso.com

# Private zone with the SAME name
az network private-dns zone create -g MyRG -n contoso.com

# Link the private zone to your VNet
az network private-dns link vnet create -g MyRG --zone-name contoso.com \
  -n InternalLink --virtual-network MyVNet --registration-enabled false

# Add internal record to private zone
az network private-dns record-set a add-record -g MyRG -z contoso.com -n app -a 10.0.1.50

# Add public record to public zone
az network dns record-set a add-record -g MyRG -z contoso.com -n app -a 203.0.113.50
```

**Important:** The private zone takes precedence for VMs in linked VNets. Any record in the private zone shadows the same record in the public zone for those VMs. If a record exists only in the public zone, VMs will still resolve it via the public internet.

## Linking Multiple VNets

A common pattern is to link multiple VNets to a single Private DNS zone for shared name resolution.

```bash
# Link hub VNet with registration
az network private-dns link vnet create -g MyRG --zone-name contoso.internal \
  -n HubLink --virtual-network HubVNet --registration-enabled true

# Link spoke VNets with resolution only
az network private-dns link vnet create -g MyRG --zone-name contoso.internal \
  -n Spoke1Link --virtual-network Spoke1VNet --registration-enabled false

az network private-dns link vnet create -g MyRG --zone-name contoso.internal \
  -n Spoke2Link --virtual-network Spoke2VNet --registration-enabled false
```

With this setup:
- VMs in HubVNet are auto-registered.
- VMs in all three VNets can resolve records in the zone.
- VMs in spoke VNets must have records created manually (or enable registration there too, but remember the one-zone-per-VNet auto-registration limit).

## Hub-Spoke DNS Architecture

The recommended architecture for large environments:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Spoke VNet  │     │   Hub VNet   │     │  Spoke VNet  │
│  (10.1.0.0)  │────▶│  (10.0.0.0)  │◀────│  (10.2.0.0)  │
│  resolution  │     │ registration │     │  resolution  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  Private DNS  │
                    │    Zone       │
                    │ contoso.int   │
                    └──────────────┘
```

**Design principles:**
1. Place registration links on the hub VNet (or shared services VNet).
2. Place resolution-only links on spoke VNets.
3. Use VNet peering between hub and spokes so DNS queries can flow.
4. For large deployments, consider a DNS Private Resolver in the hub for on-premises integration.
5. Use separate zones for different environments (e.g., `dev.internal`, `prod.internal`).

## Conditional Forwarding for On-Premises

When VMs need to resolve on-premises domains (e.g., `corp.contoso.com`), you must forward those queries to your on-premises DNS servers. Private DNS zones alone cannot do this — you need either:

1. **Azure DNS Private Resolver** (recommended) — see [DNS Private Resolver](dns-private-resolver.md).
2. **Custom DNS server VMs** in Azure that forward queries conditionally.

If using custom DNS VMs, configure the VNet's DNS settings to point to those VMs, and configure the VMs to forward `corp.contoso.com` queries to on-premises DNS (e.g., 10.1.0.4).

## Private DNS Zones for Private Endpoints

Azure private endpoints use Private DNS zones to resolve the private endpoint's private IP instead of the public IP. Each Azure service has a recommended zone name.

| Azure Service | Private DNS Zone Name |
|---------------|----------------------|
| Azure SQL Database | `privatelink.database.windows.net` |
| Azure Storage (Blob) | `privatelink.blob.core.windows.net` |
| Azure Storage (File) | `privatelink.file.core.windows.net` |
| Azure Key Vault | `privatelink.vaultcore.azure.net` |
| Azure App Service | `privatelink.azurewebsites.net` |
| Azure Container Registry | `privatelink.azurecr.io` |
| Azure Cosmos DB | `privatelink.documents.azure.com` |
| Azure Event Hubs | `privatelink.servicebus.windows.net` |
| Azure Monitor | `privatelink.monitor.azure.com` |

**Setup pattern:**

```bash
# Create the Private DNS zone for the service
az network private-dns zone create -g MyRG -n privatelink.database.windows.net

# Link it to VNets that need resolution
az network private-dns link vnet create -g MyRG \
  --zone-name privatelink.database.windows.net \
  -n HubLink --virtual-network HubVNet --registration-enabled false

# When creating a private endpoint, integrate with the zone
az network private-endpoint dns-zone-group create \
  --resource-group MyRG \
  --endpoint-name MySqlPE \
  --name default \
  --private-dns-zone /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/privateDnsZones/privatelink.database.windows.net \
  --zone-name privatelink-database-windows-net
```

The DNS zone group automatically creates an A record in the Private DNS zone mapping the service FQDN to the private endpoint's private IP.

## Troubleshooting

### VMs Not Registering (Auto-Registration)

1. **Verify the VNet link has registration enabled:**
   ```bash
   az network private-dns link vnet show -g MyRG -z contoso.internal -n MyLink \
     --query registrationEnabled
   ```
2. **Check if another zone already has auto-registration for that VNet.** A VNet can only auto-register with one zone.
3. **Confirm the VM is running.** Deallocated VMs have their records removed.
4. **Wait a few minutes.** Auto-registration is eventual — it can take 1-2 minutes after VM creation.

### Resolution Failing Across Peered VNets

1. **Verify VNet peering is active** on both sides. DNS queries flow over peering.
2. **Verify the spoke VNet has a resolution link** to the Private DNS zone.
3. **Check VNet DNS settings.** If the VNet is configured with custom DNS servers, those servers must be able to resolve the Private DNS zone (or forward to Azure's 168.63.129.16).
4. **Test from inside a VM:**
   ```bash
   nslookup myvm.contoso.internal
   # Should return the private IP from the Private DNS zone
   ```

### Resolution Failing for Private Endpoints

1. **Verify the Private DNS zone exists** with the correct name for the service.
2. **Verify a VNet link exists** between the zone and the VNet where the client VM lives.
3. **Check the A record exists** in the zone: `az network private-dns record-set a list -g MyRG -z privatelink.database.windows.net`
4. **If using custom DNS servers**, they must forward `privatelink.*` zones to Azure DNS (168.63.129.16).
5. **Test resolution:**
   ```bash
   nslookup myserver.database.windows.net
   # Should return a CNAME to myserver.privatelink.database.windows.net → private IP
   ```

### Records Not Resolving Despite Link Existing

1. **Check the link provisioning state:**
   ```bash
   az network private-dns link vnet show -g MyRG -z contoso.internal -n MyLink \
     --query provisioningState
   ```
   It should be `Succeeded`.
2. **Check if the VNet uses custom DNS.** Custom DNS servers must forward to 168.63.129.16 for Private DNS zone resolution.
3. **Verify the record exists:** `az network private-dns record-set a show -g MyRG -z contoso.internal -n myvm`
