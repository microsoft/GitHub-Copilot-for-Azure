## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `kind` | Cognitive service type (set at creation) | See Subtypes table |
| `properties.customSubDomainName` | Custom subdomain for endpoint | Globally unique, lowercase alphanumeric + hyphens |
| `properties.publicNetworkAccess` | Public network access | `Enabled`, `Disabled` |
| `properties.disableLocalAuth` | Disable API key authentication | `true`, `false` |
| `properties.networkAcls.defaultAction` | Default network action | `Allow`, `Deny` |
| `properties.networkAcls.bypass` | Bypass trusted services | `AzureServices`, `None` |
| `properties.encryption.keySource` | Encryption key source | `Microsoft.CognitiveServices`, `Microsoft.KeyVault` |
| `properties.userOwnedStorage` | Customer-managed storage | Array of storage resource references |
| `properties.allowProjectManagement` | AI Foundry project management | `true`, `false` |
| `properties.networkInjections.scenario` | Network injection scenario | `agent`, `none` |
