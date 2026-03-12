## Required Properties (Bicep)

```bicep
resource serviceBus 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Basic', 'Standard', or 'Premium'
    tier: 'string'     // optional — matches sku.name
  }
}
```
