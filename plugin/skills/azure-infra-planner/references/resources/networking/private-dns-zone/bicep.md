## Required Properties (Bicep)

```bicep
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'string'         // required — the DNS zone name (e.g., 'privatelink.blob.core.windows.net')
  location: 'global'     // required — must always be 'global'
}
```
