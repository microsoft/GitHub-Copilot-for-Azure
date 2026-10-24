# Generated `host.json` / `local.settings.json` — Go

Verified output of `func init --worker-runtime go` (Core Tools 4.12.0). The `host.json` matches the shared extension bundle range in [code-migration.md](../../code-migration.md).

## `host.json`

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

## `local.settings.json`

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "native",
    "FUNCTIONS_CLI_NATIVE_LANGUAGE": "go",
    "AzureWebJobsStorage": ""
  }
}
```

> **`local.settings.json` is local-only** — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-go) is explicit: "this file isn't published to Azure." The values above are for `func start`, not for the deployed app:
> - `FUNCTIONS_WORKER_RUNTIME=native` — tells Core Tools to load the "native" worker; Core Tools infers Go by finding `go.mod`. **On the deployed Flex Consumption app, do NOT set this app setting** — the runtime is controlled by `functionAppConfig.runtime = { name: 'go', version: '1.0' }` on the ARM/Bicep resource. Adding `FUNCTIONS_WORKER_RUNTIME` in Azure will conflict with the Flex `runtime` block.
> - `FUNCTIONS_CLI_NATIVE_LANGUAGE=go` — written by `func init --worker-runtime go` but redundant in practice (Core Tools infers Go from `go.mod`). Not consumed by the deployed Functions host.
> - `AzureWebJobsStorage` — leave empty locally when no trigger needs host storage; set to `UseDevelopmentStorage=true` for Azurite. In Azure, use the identity-based form: `AzureWebJobsStorage__blobServiceUri` + `AzureWebJobsStorage__credential=managedidentity` + `AzureWebJobsStorage__clientId=<uami-client-id>`.

## Deployed app requirements (Flex Consumption)

For the Bicep/Terraform to provision the function app correctly:

- `functionAppConfig.runtime = { name: 'go', version: '1.0' }` (Bicep) / `runtime = { name = "go", version = "1.0" }` (Terraform).
- `siteConfig.http20Enabled: false` — **required during Go public preview**; deployments without this fail at runtime.
- Flex Consumption plan (SKU `FC1`) — Consumption / Premium / Dedicated are not supported.
- Linux only. No Durable Functions. No deployment slots.
- Do NOT set `FUNCTIONS_WORKER_RUNTIME` as an app setting.

For complete packaging and infrastructure guidance, see [deployment.md](./deployment.md).
