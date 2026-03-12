## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **NSG** | Cannot attach NSG to `GatewaySubnet` — NSGs are not supported for either VPN or ExpressRoute gateways. NSG on `AzureBastionSubnet` requires specific required rules. |
| **Delegations** | A subnet can only be delegated to one service. Delegated subnets cannot host other resource types. |
| **Service Endpoints** | Must match the service being accessed (e.g., `Microsoft.Sql` for SQL Server VNet rules). |
| **Private Endpoints** | Set `privateEndpointNetworkPolicies: 'Enabled'` to apply NSG/route table to private endpoints (default is `Disabled`). |
| **AKS** | AKS subnet needs enough IPs for all nodes + pods. Cannot be delegated or have conflicting service endpoints. |
| **Application Gateway** | Dedicated subnet required — cannot coexist with other resources except other App Gateways. Cannot mix v1 and v2 App Gateway SKUs on the same subnet. |
| **Azure Firewall** | Subnet must be named `AzureFirewallSubnet`, minimum /26. Cannot have other resources. |
| **App Service VNet Integration** | Subnet must be delegated to `Microsoft.Web/serverFarms`. Minimum size /28 (or /26 for multi-plan subnet join). This subnet must be different from any subnet used for App Service Private Endpoints. |
| **GatewaySubnet UDR** | Do not apply UDR with `0.0.0.0/0` next hop on `GatewaySubnet`. ExpressRoute gateways require management controller access. BGP route propagation must remain enabled on `GatewaySubnet`. |
