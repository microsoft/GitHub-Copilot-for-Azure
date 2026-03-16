## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet / Subnet** | With Azure CNI, subnet must have enough IPs for nodes + pods (30 pods/node default × node count). Subnet cannot have other delegations. Reserved CIDR ranges cannot be used: `169.254.0.0/16`, `172.30.0.0/16`, `172.31.0.0/16`, `192.0.2.0/24`. |
| **Pod CIDR** | Pod CIDR must not overlap with cluster subnet, peered VNets, ExpressRoute, or VPN address spaces. Overlapping causes SNAT/routing issues. |
| **kubenet** | Kubenet uses NAT — subnet only needs IPs for nodes. Less IP pressure but no direct pod-to-VNet connectivity. Kubenet is retiring March 2028 — migrate to CNI Overlay. Not supported by Application Gateway for Containers. |
| **CNI Overlay** | CNI Overlay does not support VM availability sets (must use VMSS-based node pools), virtual nodes, or DCsv2-series VMs (use DCasv5/DCadsv5 instead). |
| **Dual-stack CNI Overlay** | IPv4+IPv6 dual-stack disables Azure/Calico network policies, NAT gateway, and virtual nodes. |
| **Key Vault** | Enable `azureKeyvaultSecretsProvider` addon. Use `enableRbacAuthorization: true` on Key Vault with managed identity. |
| **Container Registry** | Attach ACR via `acrPull` role assignment on cluster identity, or use `imagePullSecrets`. |
| **Log Analytics** | Enable `omsagent` addon with `config.logAnalyticsWorkspaceResourceID` pointing to workspace. |
| **Load Balancer** | AKS creates a managed Standard LB by default (`loadBalancerSku: 'standard'`). |
| **System Pool** | At least one agent pool must have `mode: 'System'`. System pools run critical pods (CoreDNS, tunnelfront). |
