## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.publicNetworkAccess` | Allow public network access | `'Enabled'`, `'Disabled'` |
| `properties.repoConfiguration.type` | Git repo type | `'FactoryGitHubConfiguration'`, `'FactoryVSTSConfiguration'` |
| `properties.repoConfiguration.accountName` | Git account name | string (required when repo configured) |
| `properties.repoConfiguration.repositoryName` | Git repo name | string (required when repo configured) |
| `properties.repoConfiguration.collaborationBranch` | Collaboration branch | string (required when repo configured) |
| `properties.repoConfiguration.rootFolder` | Root folder in repo | string (required when repo configured) |
| `properties.encryption.keyName` | CMK key name | string (required for CMK) |
| `properties.encryption.vaultBaseUrl` | Key Vault URL for CMK | string (required for CMK) |
| `properties.globalParameters.{name}.type` | Global parameter type | `'Array'`, `'Bool'`, `'Float'`, `'Int'`, `'Object'`, `'String'` |
| `properties.purviewConfiguration.purviewResourceId` | Purview resource ID | string |
| `identity.type` | Managed identity type | `'SystemAssigned'`, `'SystemAssigned,UserAssigned'`, `'UserAssigned'` |
