## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.defaultDataLakeStorage.accountUrl` | ADLS Gen2 account DFS URL | string (required) |
| `properties.defaultDataLakeStorage.filesystem` | ADLS Gen2 filesystem/container | string (required) |
| `properties.defaultDataLakeStorage.resourceId` | ARM resource ID of storage account | string |
| `properties.defaultDataLakeStorage.createManagedPrivateEndpoint` | Auto-create managed PE to storage | `true`, `false` |
| `properties.sqlAdministratorLogin` | SQL admin username | string (required) |
| `properties.sqlAdministratorLoginPassword` | SQL admin password | string (required, secure) |
| `properties.publicNetworkAccess` | Public network access | `'Enabled'`, `'Disabled'` |
| `properties.managedVirtualNetwork` | Enable managed VNet | `'default'` (enabled) or `''` (disabled) |
| `properties.managedVirtualNetworkSettings.preventDataExfiltration` | Block data exfiltration | `true`, `false` |
| `properties.managedVirtualNetworkSettings.allowedAadTenantIdsForLinking` | Allowed tenant IDs for linking | string[] |
| `properties.azureADOnlyAuthentication` | Entra ID-only auth | `true`, `false` |
| `properties.trustedServiceBypassEnabled` | Allow trusted Azure services | `true`, `false` |
| `properties.encryption.cmk.key.name` | CMK key name | string |
| `properties.encryption.cmk.key.keyVaultUrl` | Key Vault key URL | string |
| `properties.purviewConfiguration.purviewResourceId` | Purview resource ID | string |
| `properties.managedResourceGroupName` | Name for managed RG | string (max 90 chars) |
| `properties.virtualNetworkProfile.computeSubnetId` | Subnet for compute | string (ARM resource ID) |
| `identity.type` | Managed identity type | `'None'`, `'SystemAssigned'`, `'SystemAssigned,UserAssigned'` |
