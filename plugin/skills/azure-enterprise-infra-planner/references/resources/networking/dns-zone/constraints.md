## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Domain Registrar** | NS records from `properties.nameServers` must be configured at your domain registrar to delegate the domain to Azure DNS. |
| **App Service** | Create a CNAME record pointing to `{app-name}.azurewebsites.net` for custom domains. Add a TXT verification record. |
| **Front Door** | Create a CNAME record pointing to the Front Door endpoint. Add a `_dnsauth` TXT record for domain validation. |
| **Application Gateway** | Create an A record pointing to the Application Gateway public IP, or a CNAME to the public IP DNS name. |
| **Traffic Manager** | Create a CNAME record pointing to the Traffic Manager profile `{name}.trafficmanager.net`. |
| **Child Zones** | Delegate subdomains by creating NS records in the parent zone pointing to the child zone's Azure name servers. |
