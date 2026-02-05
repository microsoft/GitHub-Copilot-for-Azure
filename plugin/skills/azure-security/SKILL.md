---
name: azure-security
description: Azure Security Services including Key Vault, Managed Identity, RBAC, Entra ID, and Defender. Provides secrets management, credential-free authentication, role-based access control, and threat protection.
---

# Azure Security Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Key Vault | Secrets, keys, certificates | `azure__keyvault` | `az keyvault` |
| Managed Identity | Credential-free authentication | - | `az identity` |
| RBAC | Role-based access control | `azure__role` | `az role` |
| Entra ID | Identity and access management | - | `az ad` |
| Defender | Threat protection, security posture | - | `az security` |

## MCP Server (Preferred)

When Azure MCP is enabled:

### Key Vault
- `azure__keyvault` with command `keyvault_list` - List Key Vaults
- `azure__keyvault` with command `keyvault_secret_list` - List secrets in vault
- `azure__keyvault` with command `keyvault_secret_get` - Get secret value
- `azure__keyvault` with command `keyvault_key_list` - List keys
- `azure__keyvault` with command `keyvault_certificate_list` - List certificates

### RBAC
- `azure__role` with command `role_assignment_list` - List role assignments
- `azure__role` with command `role_definition_list` - List role definitions

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.
## CLI Fallback

```bash
# Key Vault
az keyvault list --output table
az keyvault secret list --vault-name VAULT --output table
az keyvault secret show --vault-name VAULT --name SECRET

# RBAC
az role assignment list --output table
az role definition list --output table

# Managed Identity
az identity list --output table
```

## Key Security Principles

1. **Use managed identities** - No credentials to manage
2. **Apply least privilege** - Minimum required permissions
3. **Enable Key Vault** - Never hardcode secrets
4. **Use private endpoints** - No public internet access
5. **Enable auditing** - Log all access

## Common RBAC Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access + assign roles |
| Contributor | Full access, no role assignment |
| Reader | Read-only |
| Key Vault Secrets User | Read secrets only |
| Storage Blob Data Reader | Read blobs only |

## Service Details

For deep documentation on specific services:

- Key Vault best practices -> [Key Vault documentation](https://learn.microsoft.com/azure/key-vault/general/overview)
- Managed identity patterns -> [Managed identities documentation](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
- RBAC configuration -> `azure-role-selector` skill or [Azure RBAC documentation](https://learn.microsoft.com/azure/role-based-access-control/overview)

## Azure SDKs

### Identity (Authentication)

All Azure SDKs use their language's Identity library for credential-free authentication via `DefaultAzureCredential` or managed identity.

| Language | Package | Install |
|----------|---------|---------|
| .NET | `Azure.Identity` | `dotnet add package Azure.Identity` |
| Java | `azure-identity` | Maven: `com.azure:azure-identity` |
| JavaScript | `@azure/identity` | `npm install @azure/identity` |
| Python | `azure-identity` | `pip install azure-identity` |
| Go | `azidentity` | `go get github.com/Azure/azure-sdk-for-go/sdk/azidentity` |
| Rust | `azure_identity` | `cargo add azure_identity` |

### Key Vault SDKs

| Language | Secrets | Keys | Certificates |
|----------|---------|------|--------------|
| .NET | `Azure.Security.KeyVault.Secrets` | `Azure.Security.KeyVault.Keys` | `Azure.Security.KeyVault.Certificates` |
| Java | `azure-security-keyvault-secrets` | `azure-security-keyvault-keys` | `azure-security-keyvault-certificates` |
| JavaScript | `@azure/keyvault-secrets` | `@azure/keyvault-keys` | `@azure/keyvault-certificates` |
| Python | `azure-keyvault-secrets` | `azure-keyvault-keys` | `azure-keyvault-certificates` |
| Go | `azsecrets` | `azkeys` | `azcertificates` |
| Rust | `azure_security_keyvault_secrets` | `azure_security_keyvault_keys` | `azure_security_keyvault_certificates` |

### Quick Start Examples

**Python** - Key Vault Secrets:
```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

client = SecretClient(vault_url="https://VAULT.vault.azure.net/", credential=DefaultAzureCredential())
secret = client.get_secret("secret-name")
print(secret.value)
```

**JavaScript** - Key Vault Secrets:
```javascript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const client = new SecretClient("https://VAULT.vault.azure.net/", new DefaultAzureCredential());
const secret = await client.getSecret("secret-name");
console.log(secret.value);
```

**C#** - Key Vault Secrets:
```csharp
var client = new SecretClient(new Uri("https://VAULT.vault.azure.net/"), new DefaultAzureCredential());
KeyVaultSecret secret = await client.GetSecretAsync("secret-name");
Console.WriteLine(secret.Value);
```

**Java** - Key Vault Secrets:
```java
SecretClient client = new SecretClientBuilder()
    .vaultUrl("https://VAULT.vault.azure.net/")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
KeyVaultSecret secret = client.getSecret("secret-name");
System.out.println(secret.getValue());
```

**Go** - Key Vault Secrets:
```go
package main

import (
    "context"
    "fmt"

    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
    "github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/azsecrets"
)

func main() {
    cred, _ := azidentity.NewDefaultAzureCredential(nil)
    client, _ := azsecrets.NewClient("https://VAULT.vault.azure.net/", cred, nil)

    resp, _ := client.GetSecret(context.Background(), "secret-name", "", nil)
    fmt.Println(*resp.Value)
}
```

**Rust** - Key Vault Secrets:
```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_secrets::SecretClient;

let credential = DeveloperToolsCredential::new(None)?;
let client = SecretClient::new("https://VAULT.vault.azure.net/", credential.clone(), None)?;
let secret = client.get_secret("secret-name", None).await?.into_model()?;
println!("{:?}", secret.value);
```
