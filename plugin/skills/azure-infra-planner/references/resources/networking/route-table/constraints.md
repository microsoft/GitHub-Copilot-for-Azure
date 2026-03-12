## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Route table is associated on the subnet side: set `subnet.properties.routeTable.id` to the route table resource ID. Each subnet can have at most one route table. |
| **Azure Firewall** | For forced tunneling, create a default route (`0.0.0.0/0`) with `nextHopType: 'VirtualAppliance'` pointing to the firewall private IP. |
| **VPN Gateway** | Set `disableBgpRoutePropagation: true` to prevent BGP routes from overriding UDRs on the subnet. |
| **GatewaySubnet** | UDRs on `GatewaySubnet` have restrictions — cannot use `0.0.0.0/0` route pointing to a virtual appliance. |
| **AKS** | AKS subnets with UDRs require careful route design. Must allow traffic to Azure management APIs. `kubenet` and `Azure CNI` have different routing requirements. |
| **Virtual Appliance** | `nextHopIpAddress` must be a reachable private IP in the same VNet or a peered VNet. The appliance NIC must have `enableIPForwarding: true`. |
