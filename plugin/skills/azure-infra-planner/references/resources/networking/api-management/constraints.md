## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet (External)** | Only available with `Developer`, `Premium`, or `Isolated` SKU. Subnet must be dedicated with an NSG allowing APIM management traffic. |
| **VNet (Internal)** | Same as External but no public gateway endpoint. Requires Private DNS or custom DNS for resolution. |
| **Application Gateway** | Common pattern: App Gateway in front of Internal-mode APIM. App Gateway uses the APIM private IP as backend. |
| **Key Vault** | Named values and certificates can reference Key Vault secrets. Requires managed identity with `Key Vault Secrets User` role. |
| **Application Insights** | Set `properties.customProperties` with `Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2` and logger resource for diagnostics. |
| **NSG (VNet mode)** | Subnet NSG must allow: inbound on ports 3443 (management), 80/443 (client); outbound to Azure Storage, SQL, Event Hub, and other dependencies. |
