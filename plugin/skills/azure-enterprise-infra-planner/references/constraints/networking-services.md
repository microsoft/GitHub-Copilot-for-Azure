# Networking (Services) Pairing Constraints

### Application Gateway

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Requires a dedicated subnet — no other resources allowed in the subnet (except other App Gateways). Cannot mix v1 and v2 SKUs on the same subnet — separate subnets required for each. |
| **Public IP** | v2 SKU requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on App Gateway subnet must allow `GatewayManager` service tag on ports `65200–65535` (v2) or `65503–65534` (v1). |
| **WAF** | WAF configuration only available with `WAF_v2` or `WAF_Large`/`WAF_Medium` SKUs. WAF v2 cannot disable request buffering — chunked file transfer requires path-rule workaround. |
| **Zones** | v2 supports availability zones. Specify `zones: ['1','2','3']` for zone-redundant deployment. |
| **Key Vault** | For SSL certificates, use `sslCertificates[].properties.keyVaultSecretId` to reference Key Vault certificates. User-assigned managed identity required. |
| **v1 Limitations** | v1 does not support: autoscaling, zone redundancy, Key Vault integration, mTLS, Private Link, WAF custom rules, or header rewrite. Must use v2 for these features. v1 SKUs are being retired April 2026. |
| **Private-only (no public IP)** | Requires `EnableApplicationGatewayNetworkIsolation` feature registration. Only available with `Standard_v2` or `WAF_v2`. |
| **Global VNet Peering** | Backend via private endpoint across global VNet peering causes traffic to be dropped — results in unhealthy backend status. |
| **kubenet (AKS)** | Kubenet is not supported by Application Gateway for Containers. Must use CNI or CNI Overlay. |

### Azure Bastion

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureBastionSubnet` with minimum /26 prefix. |
| **Developer SKU** | Does NOT require `AzureBastionSubnet` or public IP. Deploys as shared infrastructure. Only connects to VMs in the same VNet. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on `AzureBastionSubnet` requires mandatory inbound (HTTPS 443 from Internet, GatewayManager 443) and outbound rules (see [Bastion NSG docs](https://learn.microsoft.com/azure/bastion/bastion-nsg)). |
| **VMs** | Target VMs must be in the same VNet as Bastion (or peered VNets with Standard/Premium SKU). |

### Azure Firewall

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureFirewallSubnet` with minimum /26 prefix. |
| **Basic Tier** | Additionally requires `AzureFirewallManagementSubnet` with /26 minimum and its own public IP. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **Firewall Policy** | Cannot use both `firewallPolicy.id` and classic rule collections simultaneously. Policy tier must match or exceed firewall tier. |
| **Zones** | In zone-redundant mode, all associated public IPs must also be zone-redundant (Standard SKU). |
| **Virtual WAN** | `AZFW_Hub` SKU name must reference `virtualHub.id` instead of `ipConfigurations`. |

### Front Door

| Paired With | Constraint |
|-------------|------------|
| **Origins (backends)** | Origins are defined in child `originGroups/origins`. Supported origin types: App Service, Storage, Application Gateway, Public IP, custom hostname. |
| **Private Link Origins** | Only available with `Premium_AzureFrontDoor` SKU. Enable private origin connections to App Service, Storage, Internal Load Balancer, etc. |
| **WAF Policy** | WAF policies are separate `Microsoft.Network/FrontDoorWebApplicationFirewallPolicies` resources. Linked via security policy child resource on the profile. |
| **Custom Domains** | Custom domains are child resources of the profile. Require DNS CNAME/TXT validation and certificate (managed or custom). |
| **Application Gateway** | Front Door in front of App Gateway: use App Gateway public IP as origin. Set `X-Azure-FDID` header restriction on App Gateway to accept only Front Door traffic. |
| **App Service** | Restrict App Service to Front Door traffic using access restrictions with `AzureFrontDoor.Backend` service tag and `X-Azure-FDID` header check. |

### Load Balancer

| Paired With | Constraint |
|-------------|------------|
| **Public IP** | Public IP SKU must match LB SKU. Basic LB requires Basic public IP; Standard LB requires Standard public IP. No cross-SKU mixing. |
| **Standard SKU** | Backend pool VMs must be in the same VNet. No VMs from different VNets. Standard LB blocks outbound traffic by default — requires explicit outbound rules, NAT gateway, or instance-level public IPs. Standard LB requires an NSG (secure by default; inbound traffic blocked without NSG). |
| **Basic SKU** | Backend pool VMs must be in the same availability set or VMSS. |
| **Availability Zones** | Standard SKU is zone-redundant by default. Frontend IPs inherit zone from public IP. |
| **VMs / VMSS** | VMs in backend pool cannot have both Basic and Standard LBs simultaneously. |
| **Outbound Rules** | Only Standard SKU supports outbound rules. Basic SKU has implicit outbound. |

### VPN Gateway

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

### API Management

| Paired With | Constraint |
|-------------|------------|
| **VNet (External)** | Only available with `Developer`, `Premium`, or `Isolated` SKU. Subnet must be dedicated with an NSG allowing APIM management traffic. |
| **VNet (Internal)** | Same as External but no public gateway endpoint. Requires Private DNS or custom DNS for resolution. |
| **Application Gateway** | Common pattern: App Gateway in front of Internal-mode APIM. App Gateway uses the APIM private IP as backend. |
| **Key Vault** | Named values and certificates can reference Key Vault secrets. Requires managed identity with `Key Vault Secrets User` role. |
| **Application Insights** | Set `properties.customProperties` with `Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2` and logger resource for diagnostics. |
| **NSG (VNet mode)** | Subnet NSG must allow: inbound on ports 3443 (management), 80/443 (client); outbound to Azure Storage, SQL, Event Hub, and other dependencies. |

### DNS Zone

| Paired With | Constraint |
|-------------|------------|
| **Domain Registrar** | NS records from `properties.nameServers` must be configured at your domain registrar to delegate the domain to Azure DNS. |
| **App Service** | Create a CNAME record pointing to `{app-name}.azurewebsites.net` for custom domains. Add a TXT verification record. |
| **Front Door** | Create a CNAME record pointing to the Front Door endpoint. Add a `_dnsauth` TXT record for domain validation. |
| **Application Gateway** | Create an A record pointing to the Application Gateway public IP, or a CNAME to the public IP DNS name. |
| **Traffic Manager** | Create a CNAME record pointing to the Traffic Manager profile `{name}.trafficmanager.net`. |
| **Child Zones** | Delegate subdomains by creating NS records in the parent zone pointing to the child zone's Azure name servers. |

### Private DNS Zone

| Paired With | Constraint |
|-------------|------------|
| **Virtual Network** | Must create a `virtualNetworkLinks` child resource to link the DNS zone to each VNet that needs resolution. |
| **Private Endpoint** | Use a `privateDnsZoneGroups` child on the Private Endpoint to auto-register A records, or manually create A record sets. One DNS record per DNS name — multiple private endpoints in different regions need separate Private DNS Zones. |
| **VNet Link (auto-registration)** | Only one Private DNS Zone with `registrationEnabled: true` can be linked per VNet. Auto-registration creates DNS records for VMs in the VNet. |
| **Hub-Spoke VNet** | Link the Private DNS Zone to the hub VNet. Spoke VNets resolve via hub DNS forwarder or VNet link. |
| **PostgreSQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.postgres.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.postgres.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneArmResourceId`. |
| **MySQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.mysql.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.mysql.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneResourceId`. |

### Private Endpoint

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | The subnet must not have NSG rules that block private endpoint traffic. Subnet must have `privateEndpointNetworkPolicies` set to `Disabled` (default) for network policies to be bypassed. |
| **Private DNS Zone** | Create a `Microsoft.Network/privateDnsZones/virtualNetworkLinks` to link the DNS zone to the VNet. Create an A record or use a private DNS zone group to auto-register DNS. |
| **Private DNS Zone Group** | Use `privateEndpoint/privateDnsZoneGroups` child resource to auto-register DNS records in the Private DNS Zone. |
| **Key Vault** | Group ID: `vault`. DNS zone: `privatelink.vaultcore.azure.net`. |
| **Storage Account** | Group IDs: `blob`, `file`, `queue`, `table`, `web`, `dfs`. Each requires its own PE and DNS zone. |
| **SQL Server** | Group ID: `sqlServer`. DNS zone: `privatelink.database.windows.net`. |
| **Container Registry** | Group ID: `registry`. DNS zone: `privatelink.azurecr.io`. |
