## Required Properties (Bicep)

```bicep
resource eventHubNs 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  sku: {
    name: 'string'     // required — 'Basic', 'Standard', or 'Premium'
    tier: 'string'     // optional — matches sku.name
    capacity: int      // optional — throughput units (Standard: 1–40) or processing units (Premium: 1–16)
  }
}
```
