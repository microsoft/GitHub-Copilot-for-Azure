## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Origins (backends)** | Origins are defined in child `originGroups/origins`. Supported origin types: App Service, Storage, Application Gateway, Public IP, custom hostname. |
| **Private Link Origins** | Only available with `Premium_AzureFrontDoor` SKU. Enable private origin connections to App Service, Storage, Internal Load Balancer, etc. |
| **WAF Policy** | WAF policies are separate `Microsoft.Network/FrontDoorWebApplicationFirewallPolicies` resources. Linked via security policy child resource on the profile. |
| **Custom Domains** | Custom domains are child resources of the profile. Require DNS CNAME/TXT validation and certificate (managed or custom). |
| **Application Gateway** | Front Door in front of App Gateway: use App Gateway public IP as origin. Set `X-Azure-FDID` header restriction on App Gateway to accept only Front Door traffic. |
| **App Service** | Restrict App Service to Front Door traffic using access restrictions with `AzureFrontDoor.Backend` service tag and `X-Azure-FDID` header check. |
