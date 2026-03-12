## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **GatewaySubnet** | NSGs are not supported on `GatewaySubnet`. Associating an NSG may cause VPN and ExpressRoute gateways to stop functioning. |
| **AzureBastionSubnet** | NSG on Bastion subnet requires specific inbound/outbound rules (see [Azure Bastion NSG](https://learn.microsoft.com/azure/bastion/bastion-nsg)). |
| **Application Gateway** | NSG on App Gateway subnet must allow `GatewayManager` service tag on ports `65200–65535` (v2) and health probe traffic. |
| **Load Balancer** | Must allow `AzureLoadBalancer` service tag for health probes. Standard LB requires NSG — it is secure by default and blocks inbound traffic without an NSG. |
| **Virtual Network** | NSG is associated to subnets, not directly to VNets. Each subnet can have at most one NSG. |
