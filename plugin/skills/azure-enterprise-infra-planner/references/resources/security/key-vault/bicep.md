## Required Properties (Bicep)

```bicep
resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  properties: {
    tenantId: 'string'  // required — Azure AD tenant ID
    sku: {
      family: 'A'       // required — only valid value
      name: 'string'    // required — 'standard' or 'premium'
    }
  }
}
```
