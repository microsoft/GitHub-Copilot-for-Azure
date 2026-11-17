# Deploy via `azd`

Use this path when the workspace already has an `azure.yaml` whose service host is `appservice`.

## When to use

| Condition | Use azd? |
|---|---|
| `azure.yaml` exists AND `services.<name>.host: appservice` | ✅ Yes |
| `azure.yaml` exists but targets Container Apps / Functions / etc. | ❌ Hand off to `azure-prepare` |
| No `azure.yaml` | ❌ Use [deploy-azcli.md](deploy-azcli.md) |

## Confirm host target

Inspect the selected service in `azure.yaml`; do not assume a `host` line belongs to that service. It must use `host: appservice` and `language: dotnet` (or `csharp`/`fsharp`).

azd runs `dotnet publish` locally and uploads the **published output**. Do not ZIP source manually or enable Oryx to rebuild binaries. Verify a local SDK matching the project's `TargetFramework` and `global.json` is installed. Surface SDK errors; do not silently retarget.

Check that `services.<name>.project` selects the web project folder, and that project references resolve. For example:

```yaml
services:
  web:
    project: ./src/Web
    language: dotnet
    host: appservice
```

For existing source-built apps, set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` before deploying published output. Preserve other settings. Verify the latest stable Azure CLI.

Before every `azd up`/`azd deploy`, run the shared [LF normalization and validation example](deploy-azcli.md#normalize-linux-scripts) on the service's actual package inputs, including startup scripts. Use its shell-specific exit guard. Package only after normalization/validation succeeds; any normalization, validation or packaging failure stops deployment. Require a fresh package, never a cached artifact from a failed attempt.

## Authenticate

```bash
azd auth login --check-status || azd auth login
```

```powershell
azd auth login --check-status
if ($LASTEXITCODE -ne 0) { azd auth login }
```

## Provision (first time only)

If no `azd` environment exists in this folder:

Before creating a plan, run the [quota and region checks](create-app.md#1d-region) for the template's effective subscription, region and SKU. Preserve defaults unless the user requests changes; reuse results and recheck after these values change.

```bash
azd env new <env-name> || exit 1
azd env set AZURE_LOCATION <region> || exit 1
# Optional: override default SKU via the template's parameters
azd env set APP_SERVICE_SKU P0v3 || exit 1
azd up || exit 1
```

```powershell
azd env new <env-name>
if ($LASTEXITCODE -ne 0) { throw "azd environment creation failed" }
azd env set AZURE_LOCATION <region>
if ($LASTEXITCODE -ne 0) { throw "azd location configuration failed" }
azd env set APP_SERVICE_SKU P0v3
if ($LASTEXITCODE -ne 0) { throw "azd SKU configuration failed" }
azd up
if ($LASTEXITCODE -ne 0) { throw "azd provisioning/packaging/deployment failed" }
```

SKU parameters are template-specific: only set a parameter the existing template consumes. The template owns infrastructure; note any deviation from Linux P0v3. Do not introduce a template in an existing workspace. Ask before changing user-specified regions.

## Deploy code only (subsequent deploys)

```bash
azd deploy || exit 1
```

```powershell
azd deploy
if ($LASTEXITCODE -ne 0) { throw "azd packaging/deployment failed" }
```

After `azd deploy` returns, **stop**. Do not run `azd monitor`, `az webapp log tail`, or any HTTP probe.

## Report endpoint to the user

> ⛔ **Do NOT probe the endpoint** (no `curl`, no `Invoke-WebRequest`) and **do NOT tail logs** as a verification step. App Service can take 2–3 minutes after deploy before the site responds.

Read the endpoint from azd without hitting the site:

```bash
# bash
azd env get-values | grep -E '^SERVICE_.*_URI='
```

```powershell
# PowerShell
azd env get-values | Select-String "SERVICE_.*_URI"
```

Present the URL with the `https://` prefix and the post-deploy message from [post-deploy-message.md](post-deploy-message.md), then end the turn. Note that azd already published locally; do not report a failed publish/deployment as success.

## Notes

- ⛔ Do **not** run `azd init -t <template>` in an existing workspace — it can destroy user code. Only `azd init` (no template) is safe inside an existing project.
- If `azd up` provisions infra that doesn't match P0v3 Linux, the underlying template owns that decision — don't fight it. Note this to the user.
- If `azd deploy` fails because no environment exists, fall back to `azd env new` then re-run.
