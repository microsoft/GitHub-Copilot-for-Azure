## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `GatewaySubnet` with minimum /27 prefix. Use /26+ for 16 ExpressRoute circuits or for ExpressRoute/VPN coexistence. |
| **Public IP** | Basic VPN SKU requires Basic public IP. VpnGw1+ requires Standard public IP. |
| **Active-Active** | Requires 2 public IPs and 2 IP configurations. Only supported with VpnGw1+. |
| **Zone-Redundant** | Must use `AZ` SKU variant (e.g., `VpnGw1AZ`). Requires Standard SKU public IPs. AZ SKU cannot be downgraded to non-AZ (one-way migration only). |
| **ExpressRoute** | Can coexist with VPN gateway on the same `GatewaySubnet` (requires /27 or larger). Not supported with Basic SKU. Route-based VPN required. |
| **PolicyBased** | Limited to 1 S2S tunnel, no P2S, no VNet-to-VNet. Use `RouteBased` for most scenarios. |
| **Basic SKU** | Basic VPN Gateway does not support BGP, IPv6, RADIUS authentication, IKEv2 P2S, or ExpressRoute coexistence. Max 10 S2S tunnels. |
| **GatewaySubnet UDR** | Do not apply UDR with `0.0.0.0/0` next hop on GatewaySubnet. ExpressRoute gateways require management controller access — this route breaks it. |
| **GatewaySubnet BGP** | BGP route propagation must remain enabled on GatewaySubnet. Disabling causes the gateway to become non-functional. |
| **DNS Private Resolver** | DNS Private Resolver in a VNet with an ExpressRoute gateway and wildcard forwarding rules can cause management connectivity problems. |
