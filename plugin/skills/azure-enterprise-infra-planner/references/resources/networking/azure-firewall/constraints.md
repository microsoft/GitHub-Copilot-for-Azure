## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureFirewallSubnet` with minimum /26 prefix. |
| **Basic Tier** | Additionally requires `AzureFirewallManagementSubnet` with /26 minimum and its own public IP. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **Firewall Policy** | Cannot use both `firewallPolicy.id` and classic rule collections simultaneously. Policy tier must match or exceed firewall tier. |
| **Zones** | In zone-redundant mode, all associated public IPs must also be zone-redundant (Standard SKU). |
| **Virtual WAN** | `AZFW_Hub` SKU name must reference `virtualHub.id` instead of `ipConfigurations`. |
