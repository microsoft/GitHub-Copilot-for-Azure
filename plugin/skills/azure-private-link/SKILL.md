---
name: azure-private-link
description: "Configure Azure Private Link and private endpoints to securely access PaaS services and custom services over a private network connection. WHEN: private endpoint, private link, private access, disable public access, PaaS private connectivity. DO NOT USE FOR: VNet peering or VNet configuration (use azure-virtual-network), VPN tunnels (use azure-vpn-gateway), DNS zone management only (use azure-dns)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Private Link Skill

## When to Use This Skill

- User wants to connect to Azure PaaS services (Storage, SQL, Key Vault, etc.) over a private IP
- User needs to disable public access to a PaaS service and use private connectivity only
- User wants to create a Private Link Service to expose their own application privately
- User asks about private endpoint DNS configuration
- User needs to troubleshoot private endpoint connectivity or DNS resolution
- User wants to understand auto-approval vs manual approval for private endpoints
- User is designing a zero-trust network with no public PaaS endpoints

## Rules

1. Always configure DNS correctly — private endpoints are useless without proper DNS resolution to the private IP.
2. Recommend Azure Private DNS zones for automatic DNS registration of private endpoints.
3. When disabling public access on a PaaS service, verify that ALL consumers have private endpoint access first.
4. Private endpoints consume an IP address in the subnet — plan subnet sizing accordingly.
5. Private endpoint and the target resource can be in different subscriptions, regions, or even tenants.
6. For hybrid scenarios (on-premises access), configure DNS conditional forwarding to Azure Private DNS Resolver or Azure DNS (168.63.129.16).
7. A single PaaS resource can have multiple private endpoints in different VNets.
8. Private endpoints support NSG enforcement — recommend enabling it for zero-trust architectures.
9. Always remind users that creating a private endpoint does NOT automatically disable public access — that must be done separately.
10. Use sub-resources (groupId) to target specific features (e.g., "blob" vs "file" for Storage accounts).

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__network` | `private_endpoint_list` | List all private endpoints in a subscription or resource group |
| `azure__network` | `private_endpoint_get` | Get details of a specific private endpoint including connection status |

## CLI Fallback

```bash
# Create a private endpoint for Azure Storage (blob)
az network private-endpoint create -g MyRG -n MyStoragePE \
  --vnet-name MyVNet --subnet PrivateEndpointSubnet \
  --private-connection-resource-id /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{sa} \
  --group-id blob \
  --connection-name MyStorageConnection

# List private endpoints
az network private-endpoint list -g MyRG -o table

# Show private endpoint details
az network private-endpoint show -g MyRG -n MyStoragePE

# Check private endpoint connection status
az network private-endpoint show -g MyRG -n MyStoragePE --query 'privateLinkServiceConnections[0].privateLinkServiceConnectionState'

# Create a Private DNS zone for blob storage
az network private-dns zone create -g MyRG -n privatelink.blob.core.windows.net

# Link Private DNS zone to VNet
az network private-dns link vnet create -g MyRG --zone-name privatelink.blob.core.windows.net \
  -n MyVNetLink --virtual-network MyVNet --registration-enabled false

# Create DNS zone group for automatic DNS registration
az network private-endpoint dns-zone-group create -g MyRG --endpoint-name MyStoragePE \
  -n default --private-dns-zone /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net \
  --zone-name blob

# Create a Private Link Service
az network private-link-service create -g MyRG -n MyPLS \
  --vnet-name MyVNet --subnet PLSSubnet \
  --lb-name MyInternalLB --lb-frontend-ip-configs MyFrontend \
  --private-ip-address 10.0.3.5

# Manage private endpoint connections on a resource
az network private-endpoint-connection approve --resource-name MyStorage -g MyRG \
  --type Microsoft.Storage/storageAccounts -n MyConnectionName
az network private-endpoint-connection reject --resource-name MyStorage -g MyRG \
  --type Microsoft.Storage/storageAccounts -n MyConnectionName
```

## Key Concepts

### Private Endpoint DNS Zone Names (Common Services)

| Azure Service | Sub-Resource | Private DNS Zone Name |
|--------------|-------------|----------------------|
| Storage — Blob | blob | `privatelink.blob.core.windows.net` |
| Storage — File | file | `privatelink.file.core.windows.net` |
| Storage — Table | table | `privatelink.table.core.windows.net` |
| Storage — Queue | queue | `privatelink.queue.core.windows.net` |
| SQL Database | sqlServer | `privatelink.database.windows.net` |
| Cosmos DB — SQL | Sql | `privatelink.documents.azure.com` |
| Key Vault | vault | `privatelink.vaultcore.azure.net` |
| Azure Monitor | azuremonitor | `privatelink.monitor.azure.com` |
| App Service | sites | `privatelink.azurewebsites.net` |
| ACR | registry | `privatelink.azurecr.io` |
| Event Hub | namespace | `privatelink.servicebus.windows.net` |
| Service Bus | namespace | `privatelink.servicebus.windows.net` |

### Connection States

| State | Meaning | Action Needed |
|-------|---------|---------------|
| Pending | Connection awaits approval | Approve or reject on the resource side |
| Approved | Connection is active | None — traffic flows |
| Rejected | Connection was rejected | Delete PE and recreate if needed |
| Disconnected | Connection was removed by resource owner | Delete PE |

## References

- [Private Endpoint DNS Configuration](references/private-endpoint-dns.md)
- [Private Link Service Guide](references/private-link-service.md)
- [Approval Workflow](references/approval-workflow.md)
