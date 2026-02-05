# Azure Security SDK Usage

SDK packages and quick start examples for Azure Identity and Key Vault.

## Identity (Authentication)

All Azure SDKs use their language's Identity library for credential-free authentication via `DefaultAzureCredential` or managed identity. Rust uses `DeveloperToolsCredential` as it doesn't have a `DefaultAzureCredential` equivalent.

| Language | Package | Install |
|----------|---------|---------|
| .NET | `Azure.Identity` | `dotnet add package Azure.Identity` |
| Java | `azure-identity` | Maven: `com.azure:azure-identity` |
| JavaScript | `@azure/identity` | `npm install @azure/identity` |
| Python | `azure-identity` | `pip install azure-identity` |
| Go | `azidentity` | `go get github.com/Azure/azure-sdk-for-go/sdk/azidentity` |
| Rust | `azure_identity` | `cargo add azure_identity` |

## Key Vault SDKs

| Language | Secrets | Keys | Certificates |
|----------|---------|------|--------------|
| .NET | `Azure.Security.KeyVault.Secrets` | `Azure.Security.KeyVault.Keys` | `Azure.Security.KeyVault.Certificates` |
| Java | `azure-security-keyvault-secrets` | `azure-security-keyvault-keys` | `azure-security-keyvault-certificates` |
| JavaScript | `@azure/keyvault-secrets` | `@azure/keyvault-keys` | `@azure/keyvault-certificates` |
| Python | `azure-keyvault-secrets` | `azure-keyvault-keys` | `azure-keyvault-certificates` |
| Go | `azsecrets` | `azkeys` | `azcertificates` |
| Rust | `azure_security_keyvault_secrets` | `azure_security_keyvault_keys` | `azure_security_keyvault_certificates` |

## Quick Start Examples

**Python** - Key Vault Secrets:
```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

client = SecretClient(vault_url="https://VAULT.vault.azure.net/", credential=DefaultAzureCredential())
secret = client.get_secret("secret-name")
# Use secret.value securely - do not log secrets
```

**JavaScript** - Key Vault Secrets:
```javascript
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const client = new SecretClient("https://VAULT.vault.azure.net/", new DefaultAzureCredential());
const secret = await client.getSecret("secret-name");
// Use secret.value securely - do not log secrets
```

**C#** - Key Vault Secrets:
```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var client = new SecretClient(new Uri("https://VAULT.vault.azure.net/"), new DefaultAzureCredential());
KeyVaultSecret secret = await client.GetSecretAsync("secret-name");
// Use secret.Value securely - do not log secrets
```

**Java** - Key Vault Secrets:
```java
import com.azure.identity.*;
import com.azure.security.keyvault.secrets.*;
import com.azure.security.keyvault.secrets.models.*;

SecretClient client = new SecretClientBuilder()
    .vaultUrl("https://VAULT.vault.azure.net/")
    .credential(new DefaultAzureCredentialBuilder().build())
    .buildClient();
KeyVaultSecret secret = client.getSecret("secret-name");
// Use secret.getValue() securely - do not log secrets
```

**Go** - Key Vault Secrets:
```go
package main

import (
    "context"

    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
    "github.com/Azure/azure-sdk-for-go/sdk/security/keyvault/azsecrets"
)

func main() {
    cred, _ := azidentity.NewDefaultAzureCredential(nil)
    client, _ := azsecrets.NewClient("https://VAULT.vault.azure.net/", cred, nil)

    resp, _ := client.GetSecret(context.Background(), "secret-name", "", nil)
    // Use *resp.Value securely - do not log secrets
}
```

**Rust** - Key Vault Secrets:
```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_secrets::SecretClient;

let credential = DeveloperToolsCredential::new(None)?;
let client = SecretClient::new("https://VAULT.vault.azure.net/", credential.clone(), None)?;
let secret = client.get_secret("secret-name", None).await?.into_model()?;
// Use secret.value securely - do not log secrets
```
