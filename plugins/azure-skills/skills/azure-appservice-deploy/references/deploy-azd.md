# Deploy via `azd`

Use this path when the workspace already has an `azure.yaml` whose service host is `appservice`.

## When to use

| Condition | Use azd? |
|---|---|
| `azure.yaml` exists AND `services.<name>.host: appservice` | ✅ Yes |
| `azure.yaml` exists but targets Container Apps / Functions / etc. | ❌ Hand off to `azure-prepare` |
| No `azure.yaml` | ❌ Use [deploy-azcli.md](deploy-azcli.md) |

## Confirm host target

Inspect the selected entry under `services` in `azure.yaml`. Require `host: appservice` for that entry, not a match elsewhere in the file. If the selected host differs, hand off; do not fall back to CLI.

Verify the latest stable Azure CLI before deployment. Follow the selected language guide's `azd` requirements and build preflight.

For Oryx source deployment only, require `SCM_DO_BUILD_DURING_DEPLOYMENT=true`.

Before every `azd deploy`, run the shared [LF normalization and validation procedure](normalize-scripts.md) on the service's actual package inputs, including generated startup scripts. Use its shell-specific exit guard. Package only after normalization/validation succeeds; any normalization, validation or packaging failure stops deployment. Require a fresh package, never a cached artifact from a failed attempt.

## Authenticate

```bash
azd auth login --check-status || azd auth login
```
```powershell
azd auth login --check-status
if ($LASTEXITCODE -ne 0) { azd auth login }
```

## Provision (first time only)

Reuse the selected environment; run these commands only if it does not exist. Set overrides only when requested and consumed by the template; check each command's exit status.

Before creating a plan, run the [quota and region checks](create-app.md#1d-region).

```bash
azd env new <env-name>
# Only for a requested override, if the template consumes this parameter:
azd env set AZURE_LOCATION <region>
# Only for a requested override, if the template consumes this parameter:
azd env set APP_SERVICE_SKU "<selected-sku>"
```

Before provisioning or deploying, resolve the selected app/RG and the effective subscription, region, SKU, and Linux runtime without dumping environment values. Stop if they conflict with the active subscription or selected target. If target resources are missing, provision only after the quota check and only if the full template is in scope. Never run project-wide `azd up`.

```bash
azd provision || exit 1
```
```powershell
azd provision
if (-not $? -or $LASTEXITCODE -ne 0) { throw "azd provisioning failed" }
```

## Deploy code only

```bash
azd deploy <service-name> || exit 1
```
```powershell
azd deploy <service-name>
if (-not $? -or $LASTEXITCODE -ne 0) { throw "azd packaging/deployment failed" }
```

After `azd deploy` returns, **stop**. Do not run `azd monitor`, `az webapp log tail`, or any HTTP probe.

## Report endpoint to the user

> ⛔ **Do NOT probe the endpoint** (no `curl`, no `Invoke-WebRequest`) and **do NOT tail logs** as a verification step. App Service can take 2–3 minutes after deploy before the site responds.

Read the selected app's hostname without hitting the site:

```bash
# bash
HOST=$(az webapp show -n <selected-app> -g <selected-rg> --query defaultHostName -o tsv) || exit 1
[ -n "$HOST" ] || exit 1
printf 'https://%s\n' "$HOST"
```

```powershell
# PowerShell
$hostName = az webapp show -n <selected-app> -g <selected-rg> --query defaultHostName -o tsv
if ($LASTEXITCODE -ne 0 -or -not $hostName) { throw "Could not resolve app hostname" }
"https://$hostName"
```

Present the URL with the `https://` prefix and the post-deploy message from [post-deploy-message.md](post-deploy-message.md), then end the turn.

## Notes

- ⛔ Do **not** run `azd init -t <template>` in an existing workspace — it can destroy user code. Only `azd init` (no template) is safe inside an existing project.
- Preserve compatible template defaults; stop before changing the template or switching targets.
