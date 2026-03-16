## Required Properties (Bicep)

```bicep
resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  properties: {
    administratorLogin: 'string'          // required (immutable after creation)
    administratorLoginPassword: 'string'  // required (write-only)
  }
}
```
