## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Standard SKU** | Must use `Static` allocation method. `Dynamic` only works with Basic SKU. |
| **Load Balancer** | Public IP SKU must match Load Balancer SKU (Standard ↔ Standard, Basic ↔ Basic). |
| **Application Gateway** | Standard_v2 App Gateway requires Standard SKU public IP with Static allocation. |
| **Azure Bastion** | Requires Standard SKU with Static allocation. |
| **VPN Gateway** | Basic VPN Gateway SKU requires Basic public IP. Standard+ gateway SKUs require Standard public IP. |
| **Azure Firewall** | Requires Standard SKU with Static allocation. |
| **Zones** | Standard SKU is zone-redundant by default. Specify `zones` only to pin to specific zone(s). |
