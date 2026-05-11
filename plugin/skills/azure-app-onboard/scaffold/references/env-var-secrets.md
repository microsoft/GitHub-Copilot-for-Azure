# Environment Variables & Secrets — Cross-Cutting Rules

Applies to ALL compute targets (App Service, Container Apps, Functions). For Container Apps-specific Bicep patterns (secretRef, identity), see [bicep-container-apps.md](bicep-container-apps.md).

## Environment Variable Value Derivation

> ⛔ **Never invent env var values — derive them from the app's config class.** Before setting any environment variable in Bicep, cross-reference ALL of: `.env.example`, `.env.sample`, `docker-compose.yml` env sections, and the app's settings/config module. Missing required env vars cause container crashes that cost 10+ minutes to diagnose. Then verify each value:
>
> 1. **Type validation:** If a field is typed as `list[AnyUrl]`, `HttpUrl`, or similar, the value MUST be a valid URL — not a wildcard (`*`) or placeholder.
> 2. **Default values:** If the config has defaults (e.g., `FRONTEND_HOST = "http://localhost:5173"`), use them unless overriding with the actual deployed URL.
> 3. **Required vs optional:** Fields without defaults are required — ensure they're provided.
>
> **Common pitfalls:**
> - `BACKEND_CORS_ORIGINS=["*"]` → crashes Pydantic `list[AnyUrl]` validation. Use actual URL(s) or `["http://localhost"]`.
> - `DATABASE_URL=changethis` → crashes production validators. Use Key Vault secret reference.
> - ⛔ **JSON array env vars (e.g., `CORS_ORIGINS`) require escaping through Bicep → ARM → Container Apps.** Use a Bicep variable:
>   ```bicep
>   var corsOrigins = '["https://${containerApp.properties.configuration.ingress.fqdn}"]'
>   { name: 'CORS_ORIGINS', value: corsOrigins }
>   ```

## Key Vault Secret Dependency Chain

> ⛔ **Chicken-and-egg: CA references KV secrets that don't exist yet at deploy time.** The KV secret values (DB connection strings, passwords) are only known AFTER IaC creates the database. Bicep cannot populate them. The deploy phase seeds them via CLI AFTER infrastructure provisioning completes.

**Correct ordering:**
1. **IaC creates:** Key Vault → RBAC (KV Secrets User for CA identity) → Database → Container App (with `secretRef` pointing to KV secret names that will be seeded)
2. **Deploy phase seeds secrets:** `az keyvault secret set --vault-name {kv} --name db-connection-string --value {connection-string-from-db-output}`
3. **New revision picks up secrets:** Bicep redeploy or `az containerapp update --revision-suffix` — CA reads the seeded secrets via managed identity

> ⛔ **Password consistency: generate ONCE, use in the SAME command block.** When IaC creates a database with a `@secure()` password AND the deploy phase seeds that password into Key Vault, both MUST use the SAME value. Shell variables do NOT persist between tool calls — generate the password inline and pass it to BOTH `az deployment sub create --parameters pgAdminPassword={value}` AND `az keyvault secret set --value {value}` in a single command block. NEVER generate a password in one shell and re-generate in another.

> ⛔ **Container Apps resolves ALL secrets (KV refs, connection strings) at revision CREATION time — not restart time.** `az containerapp revision restart` does NOT pick up updated KV secrets. To apply updated secrets, create a NEW revision via Bicep redeploy (`az deployment sub create`) or `az containerapp update --revision-suffix fix-{n}`.

**IaC pattern — reference secrets by name, not value:**
```bicep
// The KV secret NAME is defined in IaC — the VALUE is seeded by deploy phase
secrets: [
  {
    name: 'db-connection-string'
    keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/db-connection-string'
    identity: 'system'
  }
]
```

> ⛔ **Do NOT use `@secure()` parameters to pass secrets inline.** Do NOT hardcode passwords in `main.parameters.json`, `terraform.tfvars`, env vars, or any generated file. The deploy phase seeds secrets into Key Vault via `az keyvault secret set` after database provisioning — see [code-deployment-appservice.md](../../deploy/references/code-deployment-appservice.md) or [code-deployment-container-apps.md](../../deploy/references/code-deployment-container-apps.md) § Database Post-Deploy.
