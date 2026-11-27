# Service Endpoints Guide

## Overview

Virtual Network service endpoints extend your VNet's private address space and identity to Azure PaaS services over the Azure backbone network. When you enable a service endpoint on a subnet, traffic from that subnet to the target Azure service takes an optimized route over the Microsoft backbone — it never traverses the public internet.

Service endpoints also allow you to lock down PaaS service access to specific VNets, adding a network layer of security on top of identity-based access control.

## How Service Endpoints Work

1. **Before service endpoints**: Traffic from a VM to Azure Storage goes through the VM's public IP (or NAT) over the internet, even though both resources are in Azure.
2. **After enabling service endpoints**: Traffic routes directly over the Azure backbone using the VM's private IP. The PaaS service sees the traffic originating from the VNet's private IP space.
3. **Firewall rules on the PaaS service**: You configure the PaaS service to only accept traffic from the VNet/subnet with the service endpoint — blocking all other public access.

```
Before: VM (10.0.1.4) → NAT → Internet → Storage (public endpoint)
After:  VM (10.0.1.4) → Azure backbone → Storage (sees traffic from VNet)
```

## Supported Services

| Service | Endpoint Name | Notes |
|---------|--------------|-------|
| Azure Storage | Microsoft.Storage | Blobs, Files, Queues, Tables |
| Azure SQL Database | Microsoft.Sql | Includes Azure Synapse Analytics |
| Azure Cosmos DB | Microsoft.AzureCosmosDB | All API types |
| Azure Key Vault | Microsoft.KeyVault | Secrets, keys, certificates |
| Azure Service Bus | Microsoft.ServiceBus | Messaging queues and topics |
| Azure Event Hubs | Microsoft.EventHub | Streaming ingestion |
| Azure App Service | Microsoft.Web | App Service and Functions |
| Azure Container Registry | Microsoft.ContainerRegistry | Container image pulls |
| Azure Cognitive Services | Microsoft.CognitiveServices | AI/ML APIs |
| Azure Data Lake Storage | Microsoft.Storage | Uses the Storage endpoint |

> **Note**: New Azure services are increasingly offering private endpoints instead of (or in addition to) service endpoints. Check the latest documentation for each service.

## Service Endpoints vs Private Endpoints

| Feature | Service Endpoint | Private Endpoint |
|---------|-----------------|-----------------|
| Connectivity | Optimized route over backbone | Private IP in your VNet |
| PaaS service IP | Still uses public IP | Gets a private IP (10.x.x.x) |
| DNS | No DNS changes needed | Requires private DNS zone integration |
| On-premises access | Not accessible from on-prem | Accessible from on-prem via VPN/ExpressRoute |
| Cross-region | Same region only (by default) | Works across regions |
| Data exfiltration | Possible to other accounts of same service type | Locked to a specific resource instance |
| Cost | Free | Per hour + per GB processed |
| Setup complexity | Simple (subnet + PaaS firewall) | More complex (NIC, DNS, NSG) |

### When to Use Which

**Use service endpoints when**:
- Budget is a constraint (service endpoints are free).
- You only need VNet-to-PaaS access (no on-premises requirement).
- The service is in the same region as the VNet.
- You don't need per-resource-instance restriction (accepting any account of the service type is okay, or you use service endpoint policies).
- Simplicity is preferred over granularity.

**Use private endpoints when** (preferred for new designs):
- You need on-premises access to the PaaS service via VPN/ExpressRoute.
- You want a private IP address for the PaaS service in your VNet.
- You need cross-region access.
- You need to restrict access to a specific resource instance (not just the service type).
- Compliance requires no public endpoint exposure.
- Data exfiltration prevention is critical.

## Service Endpoint Policies

Service endpoint policies let you restrict service endpoint access to specific Azure resource instances. Without policies, a service endpoint for Microsoft.Storage allows traffic to ALL Azure Storage accounts — including those in other subscriptions. Policies narrow this to specific accounts.

```bash
# Create a service endpoint policy
az network service-endpoint policy create \
  -g MyRG -n StoragePolicy

# Add a definition to allow only a specific storage account
az network service-endpoint policy-definition create \
  -g MyRG --policy-name StoragePolicy \
  -n AllowMyStorage \
  --service Microsoft.Storage \
  --service-resources "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/mystorageaccount"

# Associate the policy with a subnet (along with the service endpoint)
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --service-endpoints Microsoft.Storage \
  --service-endpoint-policy StoragePolicy
```

### Policy Limitations

- Policies are currently supported only for **Azure Storage**.
- A subnet can have at most one service endpoint policy.
- Policies apply to all storage account access from the subnet — you cannot have different policies for different storage accounts from the same subnet.
- Policies are regional — they apply to storage accounts in the same region as the VNet.

## Configuration Steps

### Step 1: Enable the Service Endpoint on the Subnet

```bash
# Enable service endpoint for Storage and SQL on a subnet
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --service-endpoints Microsoft.Storage Microsoft.Sql
```

### Step 2: Configure PaaS Service Firewall Rules

```bash
# Azure Storage: Add VNet rule
az storage account network-rule add \
  -g MyRG --account-name mystorageaccount \
  --vnet-name MyVNet --subnet AppSubnet

# Azure Storage: Set default action to Deny (only allow configured networks)
az storage account update \
  -g MyRG -n mystorageaccount \
  --default-action Deny

# Azure SQL: Add VNet rule
az sql server vnet-rule create \
  -g MyRG -s myserver -n AllowAppSubnet \
  --vnet-name MyVNet --subnet AppSubnet
```

### Step 3: Verify Connectivity

```bash
# From a VM in AppSubnet, test connectivity to storage
# Should succeed because the service endpoint is active
az storage blob list --account-name mystorageaccount -c mycontainer --auth-mode login

# From a VM NOT in AppSubnet (or from your local machine)
# Should be denied by the storage account firewall
```

## Regional Considerations

- Service endpoints are configured at the **regional level** by default.
- When you enable `Microsoft.Storage` on a subnet, it enables the endpoint for the Storage service **in the same region** as the VNet.
- For **Azure Storage**, you can enable cross-region endpoints by also enabling `Microsoft.Storage.Global` — this extends the endpoint to all storage accounts in all regions.
- Other services (SQL, Key Vault, etc.) typically support cross-region service endpoints by default once the endpoint is enabled.

```bash
# Enable global storage service endpoint (same + paired region)
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --service-endpoints Microsoft.Storage Microsoft.Storage.Global
```

## Monitoring and Diagnostics

### Verify Active Service Endpoints

```bash
# Check which service endpoints are enabled on a subnet
az network vnet subnet show -g MyRG --vnet-name MyVNet -n AppSubnet \
  --query 'serviceEndpoints[].{service:service, status:provisioningState}' -o table
```

### Check PaaS Firewall Configuration

```bash
# Check storage account network rules
az storage account show -g MyRG -n mystorageaccount \
  --query 'networkRuleSet.{defaultAction:defaultAction, vnets:virtualNetworkRules}' -o json

# Check SQL server firewall rules
az sql server vnet-rule list -g MyRG -s myserver -o table
```

## Troubleshooting

### Service Endpoint Not Working — Access Denied

**Symptom**: Resources in the subnet get "access denied" when accessing the PaaS service.
**Causes**:
1. Service endpoint not yet provisioned (takes 15-60 seconds after enabling).
2. The PaaS service firewall does not have a VNet rule for the subnet.
3. The PaaS service default action is not set to Deny (the VNet rule exists but has no effect because "allow all" is still active).
4. Using an older API version that doesn't support service endpoints.

**Fix**: Wait for provisioning. Verify the PaaS firewall has the correct VNet/subnet rule AND the default action is Deny. Recreate the endpoint if stuck.

```bash
# Check endpoint provisioning state
az network vnet subnet show -g MyRG --vnet-name MyVNet -n AppSubnet \
  --query 'serviceEndpoints[].provisioningState'

# Should return "Succeeded" for each endpoint
```

### Traffic Still Going Over Internet After Endpoint Enabled

**Symptom**: Despite enabling the service endpoint, Network Watcher shows traffic going through a public IP.
**Causes**:
1. The application is using a public endpoint URL that resolves to a public IP — this is expected. Service endpoints change the routing path (backbone vs internet) but the DNS name still resolves to a public IP.
2. A UDR is overriding the service endpoint route (e.g., a 0.0.0.0/0 route to an NVA).

**Fix**: Service endpoints are a routing optimization — the DNS resolution still shows a public IP, but the traffic actually traverses the backbone. Use Network Watcher's next-hop tool to verify the route. If a UDR is interfering, use effective routes to diagnose.

### Cannot Remove Service Endpoint

**Symptom**: Error when trying to remove a service endpoint from a subnet.
**Cause**: The PaaS service still has a VNet rule referencing this subnet.
**Fix**: Remove the VNet rule from the PaaS service first, then remove the service endpoint from the subnet.

```bash
# Remove the VNet rule from storage
az storage account network-rule remove \
  -g MyRG --account-name mystorageaccount \
  --vnet-name MyVNet --subnet AppSubnet

# Then remove the service endpoint
az network vnet subnet update \
  -g MyRG --vnet-name MyVNet -n AppSubnet \
  --service-endpoints '[]'
```

### Service Endpoint Policy Blocking Valid Traffic

**Symptom**: Service endpoint policy blocks access to a storage account that should be allowed.
**Cause**: The storage account resource ID is not included in the policy definition.
**Fix**: Add the storage account to the policy definition. Remember that policy definitions use full resource IDs.

```bash
# List current policy definitions
az network service-endpoint policy-definition list \
  -g MyRG --policy-name StoragePolicy -o table

# Add the missing storage account
az network service-endpoint policy-definition create \
  -g MyRG --policy-name StoragePolicy \
  -n AllowAdditionalStorage \
  --service Microsoft.Storage \
  --service-resources "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/additionalstorage"
```
