## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Virtual Network** | Must create a `virtualNetworkLinks` child resource to link the DNS zone to each VNet that needs resolution. |
| **Private Endpoint** | Use a `privateDnsZoneGroups` child on the Private Endpoint to auto-register A records, or manually create A record sets. One DNS record per DNS name — multiple private endpoints in different regions need separate Private DNS Zones. |
| **VNet Link (auto-registration)** | Only one Private DNS Zone with `registrationEnabled: true` can be linked per VNet. Auto-registration creates DNS records for VMs in the VNet. |
| **Hub-Spoke VNet** | Link the Private DNS Zone to the hub VNet. Spoke VNets resolve via hub DNS forwarder or VNet link. |
| **PostgreSQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.postgres.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.postgres.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneArmResourceId`. |
| **MySQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.mysql.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.mysql.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneResourceId`. |
