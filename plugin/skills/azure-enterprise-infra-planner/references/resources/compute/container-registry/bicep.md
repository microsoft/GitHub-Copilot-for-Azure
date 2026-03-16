## Required Properties (Bicep)

```bicep
resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Basic', 'Standard', or 'Premium'
  }
}
```
