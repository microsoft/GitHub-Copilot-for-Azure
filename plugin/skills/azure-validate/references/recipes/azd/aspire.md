# Aspire Validation

> ⚠️ **Only load this file when the project is a .NET Aspire application.**

Validation steps specific to .NET Aspire projects deployed via AZD.

## Detection

A project is Aspire-based if any of these are true:

| Indicator | Check |
|-----------|-------|
| AppHost project | `find . -name "*.AppHost.csproj"` |
| Aspire.Hosting package | `grep -r "Aspire.Hosting" . --include="*.csproj"` |

**If none found → skip this file entirely.**

---

## Pre-Provisioning: Functions Secret Storage

> ⚠️ **CRITICAL — Must run BEFORE `azd provision`.**

Check if the project uses Azure Functions within Aspire and ensure `AzureWebJobsSecretStorageType` is configured.
See [Aspire Functions Secrets Reference](../../aspire-functions-secrets.md) for detection commands, fix examples, and full details.

**If `AddAzureFunctionsProject` is NOT found**, skip this section.

---

## Post-Provisioning: Container Apps Environment Variables

> ⚠️ **CRITICAL — Run AFTER `azd provision` but BEFORE `azd deploy`.**

When using Aspire with Container Apps in "limited mode" (in-memory infrastructure generation), `azd provision` creates Azure resources but doesn't automatically populate environment variables that `azd deploy` needs.

**Run the helper script to set the three required variables.** It reads the azd
environment, derives the resource group, and sets `AZURE_CONTAINER_REGISTRY_ENDPOINT`,
`AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID`, and `MANAGED_IDENTITY_CLIENT_ID` **only if
they are missing**, then prints what it set (or "already present") so you don't have to
re-parse `azd env get-values`.

**bash:**
```bash
./scripts/set-aspire-aca-env.sh          # or: -e <azd-env-name>
```

**PowerShell:**
```powershell
./scripts/set-aspire-aca-env.ps1         # or: -Environment <azd-env-name>
```

The scripts — [scripts/set-aspire-aca-env.sh](scripts/set-aspire-aca-env.sh) and
[scripts/set-aspire-aca-env.ps1](scripts/set-aspire-aca-env.ps1) — are cross-platform
equivalents that:

- Load `azd env get-values` safely (no `eval`) and read `AZURE_RESOURCE_GROUP`.
- Skip any variable already present; set missing ones from live Azure
  (`az acr list` / `az identity list`).
- Print a compact summary of each variable and fail with a clear message if the resource
  group or a resource can't be resolved.

**Why this is needed:** Aspire's "limited mode" generates infrastructure in-memory. While `azd provision` creates all necessary Azure resources (Container Registry, Managed Identity, Container Apps Environment), it doesn't populate the environment variables that reference those resources. The `azd deploy` phase requires these variables to authenticate with the container registry and configure managed identity bindings.
