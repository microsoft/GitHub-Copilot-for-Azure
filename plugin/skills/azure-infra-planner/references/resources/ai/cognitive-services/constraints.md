## Pairing Constraints

| Paired With | Constraint |
|-------------|------------|
| **Azure OpenAI Deployments** | When `kind: 'OpenAI'` or `kind: 'AIServices'`, create model deployments as child resource `accounts/deployments`. |
| **Microsoft Entra ID Auth** | Requires `customSubDomainName` to be set. Without it, only API key auth works. |
| **Private Endpoint** | Requires `customSubDomainName`. Set `publicNetworkAccess: 'Disabled'` and configure private DNS zone. |
| **Key Vault (CMK)** | When using customer-managed keys, Key Vault must have soft-delete and purge protection enabled. Set `encryption.keySource: 'Microsoft.KeyVault'`. |
| **Storage Account** | When using `userOwnedStorage`, the storage account must be in the same region. Required for certain features (e.g., batch translation). |
| **AI Foundry Hub** | When `kind: 'AIServices'` with `allowProjectManagement: true`, can manage Foundry projects as child resources (`accounts/projects`). |
| **VNet Integration** | Configure `networkAcls` with `defaultAction: 'Deny'` and add virtual network rules. Set `bypass: 'AzureServices'` to allow trusted Azure services. |
