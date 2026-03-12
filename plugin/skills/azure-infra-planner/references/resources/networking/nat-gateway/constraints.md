## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | NAT Gateway is associated on the subnet side: set `subnet.properties.natGateway.id` to the NAT Gateway resource ID. A subnet can have at most one NAT Gateway. |
| **Public IP** | Public IP must use `Standard` SKU and `Static` allocation. Public IP and NAT Gateway must be in the same region. |
| **Public IP Prefix** | Public IP prefix must use `Standard` SKU. Provides contiguous outbound IPs. |
| **Availability Zones** | NAT Gateway can be zonal (pinned to one zone) or non-zonal. Public IPs must match the same zone or be zone-redundant. |
| **Load Balancer** | NAT Gateway takes precedence over outbound rules of a Standard Load Balancer when both are on the same subnet. |
| **VPN Gateway / ExpressRoute** | `GatewaySubnet` does not support NAT Gateway association. |
| **Azure Firewall** | NAT Gateway can be associated with the `AzureFirewallSubnet` for deterministic outbound IPs in SNAT scenarios. |
