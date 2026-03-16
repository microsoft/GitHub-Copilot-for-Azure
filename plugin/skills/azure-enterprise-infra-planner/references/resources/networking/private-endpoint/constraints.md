## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | The subnet must not have NSG rules that block private endpoint traffic. Subnet must have `privateEndpointNetworkPolicies` set to `Disabled` (default) for network policies to be bypassed. |
| **Private DNS Zone** | Create a `Microsoft.Network/privateDnsZones/virtualNetworkLinks` to link the DNS zone to the VNet. Create an A record or use a private DNS zone group to auto-register DNS. |
| **Private DNS Zone Group** | Use `privateEndpoint/privateDnsZoneGroups` child resource to auto-register DNS records in the Private DNS Zone. |
| **Key Vault** | Group ID: `vault`. DNS zone: `privatelink.vaultcore.azure.net`. |
| **Storage Account** | Group IDs: `blob`, `file`, `queue`, `table`, `web`, `dfs`. Each requires its own PE and DNS zone. |
| **SQL Server** | Group ID: `sqlServer`. DNS zone: `privatelink.database.windows.net`. |
| **Container Registry** | Group ID: `registry`. DNS zone: `privatelink.azurecr.io`. |
