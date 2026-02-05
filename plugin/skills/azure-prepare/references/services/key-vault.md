# Azure Key Vault

Secrets management patterns and best practices for Azure Key Vault.

## When to Use

- Storing application secrets
- Managing certificates
- Storing encryption keys
- Centralizing secret management
- Enabling secret rotation

## Bicep Resource Pattern

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${resourcePrefix}-kv-${uniqueHash}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-connection-string'
  properties: {
    value: databaseConnectionString
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Key Vault is self-contained |
| Private Endpoint | Secure access (optional) |

## SKU Selection

| SKU | Features |
|-----|----------|
| Standard | Software-protected keys |
| Premium | HSM-protected keys |

## RBAC Roles

| Role | Permissions |
|------|-------------|
| Key Vault Administrator | Full access |
| Key Vault Secrets Officer | Manage secrets |
| Key Vault Secrets User | Read secrets |
| Key Vault Certificates Officer | Manage certificates |
| Key Vault Crypto Officer | Manage keys |

## Granting Access

### To Managed Identity

```bicep
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

### To Container App

```bicep
resource keyVaultSecretUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, containerApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Referencing Secrets

### In App Service / Functions

```bicep
appSettings: [
  {
    name: 'DATABASE_URL'
    value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=database-connection-string)'
  }
]
```

### In Container Apps

```bicep
secrets: [
  {
    name: 'db-connection'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/database-connection-string'
    identity: containerApp.identity.principalId
  }
]
```

## SDK Access

### Node.js

```javascript
const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

const client = new SecretClient(
  process.env.KEY_VAULT_URL,
  new DefaultAzureCredential()
);

const secret = await client.getSecret("database-connection-string");
console.log(secret.value);
```

### Python

```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

client = SecretClient(
    vault_url=os.environ["KEY_VAULT_URL"],
    credential=DefaultAzureCredential()
)

secret = client.get_secret("database-connection-string")
print(secret.value)
```

### .NET

```csharp
var client = new SecretClient(
    new Uri(Environment.GetEnvironmentVariable("KEY_VAULT_URL")),
    new DefaultAzureCredential()
);

KeyVaultSecret secret = await client.GetSecretAsync("database-connection-string");
Console.WriteLine(secret.Value);
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `KEY_VAULT_URL` | `https://{vault-name}.vault.azure.net/` |
| `KEY_VAULT_NAME` | Vault name |

## Secret Rotation

### Expiration Notification

```bicep
resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'api-key'
  properties: {
    value: apiKey
    attributes: {
      exp: dateTimeToEpoch(dateTimeAdd(utcNow(), 'P90D'))
    }
  }
}
```

### Event Grid Integration

```bicep
resource kvEventSubscription 'Microsoft.EventGrid/eventSubscriptions@2023-12-15-preview' = {
  name: 'secret-expiry-notification'
  scope: keyVault
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://my-api.example.com/secret-rotation'
      }
    }
    filter: {
      includedEventTypes: [
        'Microsoft.KeyVault.SecretNearExpiry'
        'Microsoft.KeyVault.SecretExpired'
      ]
    }
  }
}
```

## Security Features

| Feature | Description |
|---------|-------------|
| RBAC | Role-based access control for fine-grained permissions |
| Soft Delete | Recover deleted vaults and secrets |
| Purge Protection | Prevent permanent deletion during retention period |

For comprehensive security guidance, see: [security.md](../security.md)

## Best Practices

1. **Always use RBAC** over access policies
2. **Enable soft delete and purge protection** for production
3. **Use managed identities** instead of storing keys in apps
4. **Set expiration dates** on secrets
5. **Monitor with Event Grid** for expiry notifications
6. **Use separate vaults** for different environments
