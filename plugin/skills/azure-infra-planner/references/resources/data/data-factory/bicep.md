## Required Properties (Bicep)

```bicep
resource dataFactory 'Microsoft.DataFactory/factories@2018-06-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  properties: {}        // required (can be empty object)
}
```
