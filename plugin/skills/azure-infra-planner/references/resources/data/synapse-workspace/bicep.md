## Required Properties (Bicep)

```bicep
resource synapseWorkspace 'Microsoft.Synapse/workspaces@2021-06-01' = {
  name: 'string'       // required, globally unique
  location: 'string'   // required
  properties: {
    defaultDataLakeStorage: {
      accountUrl: 'string'   // required — ADLS Gen2 DFS endpoint (e.g., https://{account}.dfs.core.windows.net)
      filesystem: 'string'   // required — ADLS Gen2 container/filesystem name
    }
    sqlAdministratorLogin: 'string'            // required
    sqlAdministratorLoginPassword: 'string'    // required
  }
}
```
