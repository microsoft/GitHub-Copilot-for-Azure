## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Must use `StorageV2` or `Storage` kind. `BlobStorage`, `BlockBlobStorage`, `FileStorage` not supported (need Queue + Table). |
| **Storage (Consumption)** | Consumption plan cannot use VNet-secured storage. Only Premium/Dedicated support VNet-restricted storage. |
| **Storage (ZRS)** | Zone-redundant functions require `Standard_ZRS` storage SKU. |
| **App Service Plan** | Plan must be in the same region. Linux functions need Linux plan (`reserved: true`). |
| **VNet Integration** | Requires Premium (EP) or Dedicated plan. Consumption does not support VNet integration (use Flex Consumption). |
| **Application Insights** | Set `APPINSIGHTS_INSTRUMENTATIONKEY` or `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. |
| **Key Vault References** | App settings can use `@Microsoft.KeyVault(SecretUri=...)` syntax. Requires managed identity with Key Vault access. |
