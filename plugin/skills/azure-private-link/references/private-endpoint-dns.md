# Private Endpoint DNS Configuration

DNS is the most critical — and most frequently misconfigured — aspect of Azure Private Endpoints. A private endpoint assigns a private IP address from your VNet subnet to a PaaS resource, but unless DNS resolves the service's FQDN to that private IP, clients will continue reaching the public endpoint or fail entirely.

## Why DNS Is Critical: The CNAME Chain

When you create a private endpoint, Azure inserts a CNAME record into the public DNS hierarchy for the service. This CNAME chain is what redirects resolution from the public zone to the privatelink zone:

```
mystorageaccount.blob.core.windows.net
  → CNAME: mystorageaccount.privatelink.blob.core.windows.net
    → A record: 10.0.1.5  (from Azure Private DNS zone)
```

**Without a Private DNS zone (or custom DNS entry):**

```
mystorageaccount.blob.core.windows.net
  → CNAME: mystorageaccount.privatelink.blob.core.windows.net
    → A record: (public IP from Azure — the CNAME falls through to public resolution)
```

The CNAME to `privatelink.*` is always created in public DNS when a private endpoint exists. The difference is whether a Private DNS zone provides the final A record pointing to the private IP. If no Private DNS zone is linked to the VNet, the query resolves to the public IP, and the private endpoint is bypassed.

## Recommended Pattern: Azure Private DNS Zone Integration

The recommended approach is to create an Azure Private DNS zone matching the privatelink zone name for the service, link it to every VNet that needs private access, and use DNS zone groups for automatic A record management.

### Step-by-Step Setup

**1. Create the Private DNS zone:**

```bash
az network private-dns zone create \
  -g MyDnsRG \
  -n privatelink.blob.core.windows.net
```

**2. Link the zone to each VNet that should resolve private endpoint IPs:**

```bash
az network private-dns link vnet create \
  -g MyDnsRG \
  --zone-name privatelink.blob.core.windows.net \
  -n link-to-hub-vnet \
  --virtual-network /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/HubVNet \
  --registration-enabled false
```

> **Important:** Set `--registration-enabled false`. Auto-registration is for VM DNS records, not private endpoints. Enabling it on a privatelink zone causes confusion and is unsupported.

**3. Create a DNS zone group on the private endpoint for automatic A record management:**

```bash
az network private-endpoint dns-zone-group create \
  -g MyRG \
  --endpoint-name MyStoragePE \
  -n default \
  --private-dns-zone /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net \
  --zone-name blob
```

The DNS zone group automatically creates an A record in the Private DNS zone when the private endpoint is created and removes it when the endpoint is deleted. This eliminates manual record management.

## DNS Zone Group Details

A DNS zone group is a resource attached to a private endpoint that automates A record lifecycle:

- **On private endpoint creation** — the zone group creates A records in the linked Private DNS zone
- **On private endpoint deletion** — the zone group removes the A records
- **On IP change** (rare, e.g., if the PE is recreated) — the A record is updated

Without a DNS zone group, you must manually create and maintain A records:

```bash
# Manual A record creation (NOT recommended — use zone groups instead)
az network private-dns record-set a add-record \
  -g MyDnsRG \
  --zone-name privatelink.blob.core.windows.net \
  -n mystorageaccount \
  -a 10.0.1.5
```

## Comprehensive Private DNS Zone Names by Azure Service

| Azure Service | Sub-Resource (groupId) | Private DNS Zone Name |
|--------------|------------------------|----------------------|
| **Storage — Blob** | blob | `privatelink.blob.core.windows.net` |
| **Storage — Blob (secondary)** | blob_secondary | `privatelink.blob.core.windows.net` |
| **Storage — Table** | table | `privatelink.table.core.windows.net` |
| **Storage — Table (secondary)** | table_secondary | `privatelink.table.core.windows.net` |
| **Storage — Queue** | queue | `privatelink.queue.core.windows.net` |
| **Storage — Queue (secondary)** | queue_secondary | `privatelink.queue.core.windows.net` |
| **Storage — File** | file | `privatelink.file.core.windows.net` |
| **Storage — Web** | web | `privatelink.web.core.windows.net` |
| **Storage — Web (secondary)** | web_secondary | `privatelink.web.core.windows.net` |
| **Storage — DFS** | dfs | `privatelink.dfs.core.windows.net` |
| **Storage — DFS (secondary)** | dfs_secondary | `privatelink.dfs.core.windows.net` |
| **SQL Database** | sqlServer | `privatelink.database.windows.net` |
| **SQL Managed Instance** | managedInstance | `privatelink.{dnsPrefix}.database.windows.net` |
| **Cosmos DB — SQL** | Sql | `privatelink.documents.azure.com` |
| **Cosmos DB — MongoDB** | MongoDB | `privatelink.mongo.cosmos.azure.com` |
| **Cosmos DB — Cassandra** | Cassandra | `privatelink.cassandra.cosmos.azure.com` |
| **Cosmos DB — Gremlin** | Gremlin | `privatelink.gremlin.cosmos.azure.com` |
| **Cosmos DB — Table** | Table | `privatelink.table.cosmos.azure.com` |
| **Key Vault** | vault | `privatelink.vaultcore.azure.net` |
| **Key Vault — HSM** | managedhsm | `privatelink.managedhsm.azure.net` |
| **Azure Container Registry** | registry | `privatelink.azurecr.io` |
| **App Service / Functions** | sites | `privatelink.azurewebsites.net` |
| **Event Hubs** | namespace | `privatelink.servicebus.windows.net` |
| **Service Bus** | namespace | `privatelink.servicebus.windows.net` |
| **Azure Monitor** | azuremonitor | `privatelink.monitor.azure.com` |
| **Azure Cognitive Services** | account | `privatelink.cognitiveservices.azure.com` |
| **Azure OpenAI** | account | `privatelink.openai.azure.com` |
| **Azure Cache for Redis** | redisCache | `privatelink.redis.cache.windows.net` |
| **Azure Kubernetes Service** | management | `privatelink.{region}.azmk8s.io` |
| **Azure Data Factory** | dataFactory | `privatelink.datafactory.azure.net` |
| **Azure Synapse — SQL** | Sql | `privatelink.sql.azuresynapse.net` |
| **Azure Synapse — SqlOnDemand** | SqlOnDemand | `privatelink.sql.azuresynapse.net` |
| **Azure Synapse — Dev** | Dev | `privatelink.dev.azuresynapse.net` |
| **Azure Machine Learning** | amlworkspace | `privatelink.api.azureml.ms` |
| **Azure Batch** | batchAccount | `privatelink.{region}.batch.azure.com` |
| **Azure SignalR** | signalr | `privatelink.service.signalr.net` |
| **Azure IoT Hub** | iotHub | `privatelink.azure-devices.net` |
| **Azure Event Grid — Topic** | topic | `privatelink.eventgrid.azure.net` |
| **Azure Event Grid — Domain** | domain | `privatelink.eventgrid.azure.net` |

> **Note:** Some services like AKS and Batch include the region in the zone name. Always verify the zone name in the Azure documentation for your specific service.

## Custom DNS Server Configuration

If your VNet uses a custom DNS server (not Azure-provided DNS), you must configure it to forward `privatelink.*` queries to Azure DNS:

**Option A — Forward to Azure DNS directly (168.63.129.16):**

On your DNS server, create conditional forwarders for each `privatelink.*` zone that point to `168.63.129.16`. This IP is the Azure platform DNS and is reachable from any Azure VM.

**Option B — Forward to Azure DNS Private Resolver:**

Deploy an Azure DNS Private Resolver in a VNet linked to your Private DNS zones. Forward queries from your custom DNS server to the resolver's inbound endpoint IP.

```bash
# Create DNS Private Resolver
az dns-resolver create -g MyRG -n MyResolver \
  --id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/HubVNet

# Create inbound endpoint (receives queries from your DNS server)
az dns-resolver inbound-endpoint create -g MyRG \
  --dns-resolver-name MyResolver -n InboundEndpoint \
  --ip-configurations '[{"private-ip-allocation-method":"Dynamic","id":"/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/HubVNet/subnets/InboundSubnet"}]'
```

## On-Premises DNS Forwarding Patterns

For hybrid environments where on-premises clients must resolve private endpoint FQDNs to private IPs:

### Pattern 1: Conditional Forwarding to Azure DNS Private Resolver

```
On-Prem Client → On-Prem DNS Server
  → Conditional Forwarder (privatelink.blob.core.windows.net → Resolver inbound IP)
    → Azure DNS Private Resolver → Private DNS Zone → 10.0.1.5
```

This is the recommended pattern. The DNS Private Resolver is a managed service that requires no VM maintenance. Configure your on-premises DNS to forward all `privatelink.*` zones to the resolver's inbound endpoint IP.

### Pattern 2: Conditional Forwarding to DNS Forwarder VMs

```
On-Prem Client → On-Prem DNS Server
  → Conditional Forwarder (privatelink.blob.core.windows.net → Forwarder VM IP)
    → DNS Forwarder VM (forwards to 168.63.129.16) → Private DNS Zone → 10.0.1.5
```

This older pattern uses Windows DNS or BIND VMs in Azure that forward to 168.63.129.16. The Azure platform DNS (168.63.129.16) is only reachable from within Azure, so on-premises DNS cannot query it directly — hence the forwarder VM requirement.

### On-Premises Conditional Forwarder Example (Windows DNS)

Create conditional forwarders on your on-premises DNS for every `privatelink.*` zone you use:

```powershell
# Point each privatelink zone to the Azure DNS Private Resolver inbound endpoint
Add-DnsServerConditionalForwarderZone -Name "privatelink.blob.core.windows.net" -MasterServers 10.0.0.4
Add-DnsServerConditionalForwarderZone -Name "privatelink.database.windows.net" -MasterServers 10.0.0.4
Add-DnsServerConditionalForwarderZone -Name "privatelink.vaultcore.azure.net" -MasterServers 10.0.0.4
```

## Hub-Spoke DNS Architecture for Private Endpoints

In a hub-spoke topology, centralize Private DNS zones in the hub:

```
Spoke VNet A (workload) ─── peered ──→ Hub VNet
Spoke VNet B (workload) ─── peered ──→ Hub VNet
                                         │
                                   Private DNS Zones
                                   (privatelink.*.*)
                                         │
                                   Linked to Hub VNet
                                   Linked to Spoke A VNet
                                   Linked to Spoke B VNet
```

**Key design points:**

1. Create all `privatelink.*` Private DNS zones in a central resource group (e.g., in the hub subscription).
2. Link each Private DNS zone to **every VNet** that needs to resolve private endpoint FQDNs — the hub and all spokes.
3. Private endpoints can live in spoke VNets. The DNS zone group on those endpoints creates A records in the centralized Private DNS zones.
4. If using custom DNS (e.g., Active Directory DNS in the hub), configure conditional forwarding from the custom DNS to Azure DNS (168.63.129.16) or to an Azure DNS Private Resolver.
5. Use Azure Policy to enforce that private endpoints always create DNS zone groups in the centralized zones.

## Split-Horizon DNS Behavior

When a private endpoint exists, Azure modifies public DNS to include a CNAME to `privatelink.*`:

- **From inside a VNet with a linked Private DNS zone:** the query resolves to the private IP (10.x.x.x).
- **From the public internet (or a VNet without the linked zone):** the query falls through to public DNS and resolves to the public IP.

This split-horizon behavior means:

- The same FQDN (`mystorageaccount.blob.core.windows.net`) resolves differently depending on where the query originates.
- You don't need to change application connection strings. The FQDN stays the same — only DNS resolution changes.
- If you disable public access on the PaaS resource, external clients get a private IP resolution (if they use a linked zone) or a public IP that is blocked (if they don't have the zone).

## Troubleshooting DNS for Private Endpoints

### 1. Verify DNS Resolution with nslookup

Run from a VM inside the VNet:

```bash
nslookup mystorageaccount.blob.core.windows.net
```

**Expected output (working):**

```
Name:    mystorageaccount.privatelink.blob.core.windows.net
Address: 10.0.1.5
Aliases: mystorageaccount.blob.core.windows.net
```

**Broken output (resolves to public IP):**

```
Name:    blob.bl4prdstr05a.store.core.windows.net
Address: 52.239.xxx.xxx
Aliases: mystorageaccount.blob.core.windows.net
         mystorageaccount.privatelink.blob.core.windows.net
```

### 2. Common Issues and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Resolves to public IP from VNet | Private DNS zone not linked to VNet | Link the zone to the VNet |
| Resolves to public IP from VNet | No A record in Private DNS zone | Create a DNS zone group on the private endpoint |
| Resolves to public IP from VNet | VNet using custom DNS that doesn't forward to Azure | Configure conditional forwarding on custom DNS |
| On-prem resolves to public IP | No conditional forwarder for privatelink zone | Add conditional forwarder to DNS Private Resolver or forwarder VM |
| `NXDOMAIN` for privatelink FQDN | Private DNS zone doesn't exist | Create the Private DNS zone |
| Old cached public IP | DNS cache on client or intermediary DNS | Flush DNS cache: `ipconfig /flushdns` (Windows) or `sudo systemd-resolve --flush-caches` (Linux) |
| Works from one VNet but not another | DNS zone linked to only one VNet | Link the Private DNS zone to all VNets that need resolution |
| Private endpoint shows Approved but no connectivity | DNS resolves correctly but NSG blocks traffic | Check NSG rules on the private endpoint subnet (if NSG enforcement is enabled) |

### 3. Verify the A Record Exists in the Private DNS Zone

```bash
az network private-dns record-set a list \
  -g MyDnsRG \
  --zone-name privatelink.blob.core.windows.net \
  -o table
```

### 4. Verify the DNS Zone Is Linked to the VNet

```bash
az network private-dns link vnet list \
  -g MyDnsRG \
  --zone-name privatelink.blob.core.windows.net \
  -o table
```

### 5. Verify DNS Zone Group Exists on the Private Endpoint

```bash
az network private-endpoint dns-zone-group list \
  -g MyRG \
  --endpoint-name MyStoragePE \
  -o table
```

### 6. Test from Inside the VNet (Azure Bastion or SSH)

Always test DNS resolution from a VM inside the VNet — not from Cloud Shell or your local machine, which are outside the VNet and won't see the Private DNS zone.

```bash
# From a VM in the VNet:
dig mystorageaccount.blob.core.windows.net
curl -I https://mystorageaccount.blob.core.windows.net
```

If `dig` returns the private IP but `curl` fails with a connection timeout, the issue is likely NSG or routing — not DNS.
