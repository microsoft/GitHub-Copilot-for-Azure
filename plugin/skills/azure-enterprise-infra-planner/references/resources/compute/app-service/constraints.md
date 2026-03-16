## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **App Service Plan** | Must be in the same region. Linux apps need Linux plan (`reserved: true`). Windows apps need Windows plan. |
| **Deployment Slots** | Only available on Standard or higher plan tiers. Free and Basic do not support slots. |
| **VNet Integration** | Requires Basic or higher plan tier. Subnet must be delegated to `Microsoft.Web/serverFarms`. VNet integration subnet must be a different subnet than any Private Endpoint subnet. |
| **Private Endpoints** | Requires Basic or higher plan tier. Not available on Free or Shared tiers. |
| **Custom Domain** | Requires Shared (D1) or higher tier for custom domains. Free tier only supports `*.azurewebsites.net`. Managed certificates require Basic or higher. |
| **Application Insights** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. |
| **Key Vault References** | Use `@Microsoft.KeyVault(SecretUri=...)` in app settings. Requires managed identity with Key Vault access. |
| **Managed Identity** | Enable `identity.type: 'SystemAssigned'` or `'UserAssigned'` for passwordless auth to other Azure resources. |
