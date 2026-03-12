## Required Properties (Bicep)

```bicep
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' = {
  name: 'string'         // required — the DNS zone name (e.g., 'contoso.com')
  location: 'global'     // required — must always be 'global'
}
```
