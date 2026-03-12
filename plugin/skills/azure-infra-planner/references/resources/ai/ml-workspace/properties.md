## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `identity.type` | Managed identity type | `None`, `SystemAssigned`, `UserAssigned`, `SystemAssigned,UserAssigned` |
| `properties.storageAccount` | Linked Storage Account resource ID | ARM resource ID (cannot change after creation) |
| `properties.keyVault` | Linked Key Vault resource ID | ARM resource ID (cannot change after creation) |
| `properties.applicationInsights` | Linked App Insights resource ID | ARM resource ID |
| `properties.containerRegistry` | Linked ACR resource ID | ARM resource ID |
| `properties.hubResourceId` | Parent Hub resource ID (kind=Project only) | ARM resource ID |
| `properties.workspaceHubConfig` | Hub-specific configuration (kind=Hub only) | Object |
| `properties.publicNetworkAccess` | Public network access | `Enabled`, `Disabled` |
| `properties.managedNetwork.isolationMode` | Network isolation mode | `AllowInternetOutbound`, `AllowOnlyApprovedOutbound`, `Disabled` |
| `properties.hbiWorkspace` | High business impact flag | `true`, `false` |
| `properties.systemDatastoresAuthMode` | Datastore auth mode | `AccessKey`, `Identity`, `UserDelegationSAS` |
| `properties.featureStoreSettings` | Feature store config (kind=FeatureStore) | Object |
