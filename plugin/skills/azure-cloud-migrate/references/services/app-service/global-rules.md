# Global Rules

These rules apply to ALL phases of App Service migration.

## Destructive Action Policy

⛔ **NEVER** perform destructive actions without explicit user confirmation via `ask_user`:
- Deleting files or directories
- Overwriting existing code
- Deploying to production environments
- Modifying existing Azure resources
- Removing source-platform resources

## User Confirmation Required

Always use `ask_user` before:
- Selecting Azure subscription
- Selecting Azure region/location
- Deploying infrastructure
- Making breaking changes to existing code
- Choosing App Service Plan tier (Free, Basic, Standard, Premium)

## Best Practices

- Always use `mcp_azure_mcp_get_bestpractices` tool before generating Azure code
- Prefer managed identity over connection strings or API keys
- **Always use the latest supported runtime stack** — check [App Service supported runtimes](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs) for the newest GA version
- Follow Azure naming conventions
- Use Premium v3 or Standard plans for production workloads
- Enable health checks and diagnostic logging from day one

## Identity-First Authentication (Zero Secrets)

> Enterprise subscriptions commonly enforce policies that block local auth. Always design for identity-based access from the start.

- **Storage accounts**: Use identity-based connections with `DefaultAzureCredential`
- **Databases**: Use Microsoft Entra authentication for Azure SQL and PostgreSQL Flexible Server
- **Key Vault**: Use Key Vault references in App Settings (`@Microsoft.KeyVault(SecretUri=...)`)
- **Application Insights**: Set `disableLocalAuth: true`. Use managed identity for telemetry ingestion
- **DefaultAzureCredential with UAMI**: Always pass `managedIdentityClientId` explicitly:
  ```javascript
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  ```

## App Service Specifics

- **Always enable HTTPS Only** — set `httpsOnly: true` in Bicep
- **Use 64-bit worker** for production — set `use32BitWorkerProcess: false`
- **Enable Always On** for Standard tier and above to prevent idle unload
- **Configure health check path** — `/healthz` or equivalent endpoint
- **Use deployment slots** for zero-downtime deployments in Standard tier+
- **Set minimum TLS to 1.2** — `minTlsVersion: '1.2'`
- **Enable managed identity** — prefer User Assigned for multi-resource scenarios
- **Use App Configuration** for shared settings across environments
- **Use Key Vault** for secrets — never store secrets in App Settings directly

## Output Directory

All migration output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.
