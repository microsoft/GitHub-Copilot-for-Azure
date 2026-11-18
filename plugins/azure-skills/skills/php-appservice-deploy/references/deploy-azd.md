# Deploy via `azd`

Use this path when the workspace already has an `azure.yaml` whose service host is `appservice`.

## When to use

| Condition | Use azd? |
|---|---|
| `azure.yaml` exists AND `services.<name>.host: appservice` | ✅ Yes |
| `azure.yaml` exists but targets Container Apps / Functions / Static Web Apps / etc. | ❌ Hand off to `azure-prepare` |
| No `azure.yaml` | ❌ Use [deploy-azcli.md](deploy-azcli.md) |

## Confirm host target

Select the actual service and require its `host: appservice`; a different host is a handoff to `azure-prepare`, not permission to use CLI. Do not select a service by matching an unrelated `host` line.

Verify the latest stable Azure CLI before deployment. azd has no PHP language; like the [Azure Laravel sample](https://github.com/Azure-Samples/laravel-tasks/blob/main/azure.yaml), PHP services use `language: js` just to upload files (azd also runs `npm` steps if `package.json` exists). Exclude `vendor` and `.env` from the package, and keep Laravel's `storage/` and `bootstrap/cache/` folders.

If `package.json` exists, inspect its npm scripts and lockfile before deploying: azd may run npm installation and build steps. Respect the existing frontend build, surface failures, and do not silently change scripts or dependencies. Ensure required generated assets are included.

Before source deployment, run the [app-setting conflict check](deploy-azcli.md#1-enable-server-side-build) for existing apps; inspect template settings for new apps. Require `SCM_DO_BUILD_DURING_DEPLOYMENT=true` and no `WEBSITE_RUN_FROM_PACKAGE`. Apply the [recursive packaging exclusions](deploy-azcli.md#create-a-fresh-zip) to the actual azd package too; preserve Laravel placeholders and stop if package safety cannot be verified.

Before every `azd deploy <service-name>`, run the shared [LF normalization and validation example](deploy-azcli.md#normalize-linux-scripts) on the service's actual package inputs, including generated startup scripts. Use its shell-specific exit guard. Package only after normalization/validation succeeds; any normalization, validation or packaging failure stops deployment. Require a fresh package, never a cached artifact from a failed attempt.

## Authenticate

```bash
azd auth login --check-status || azd auth login
```
```powershell
azd auth login --check-status
if ($LASTEXITCODE -ne 0) { azd auth login }
```

## Resolve environment

Reuse the selected environment, even if it is not provisioned. Run this block only if no environment exists:

Before creating a plan, run the [quota and region checks](create-app.md#1d-region) for the template's effective subscription, region and SKU. Preserve defaults unless the user requests changes; reuse results and recheck after these values change.

```bash
azd env new <env-name> || exit 1
# Only for requested overrides consumed by the template:
azd env set AZURE_LOCATION <checked-region> || exit 1
azd env set APP_SERVICE_SKU "<checked-sku>" || exit 1
```

Only execute the override lines when explicitly requested; otherwise preserve template defaults. In PowerShell, check `$LASTEXITCODE` after each command and stop on failure.

## Provision missing resources

Before provisioning **or deploying**, resolve the selected service's actual app/RG and the environment's effective `AZURE_SUBSCRIPTION_ID`, `AZURE_LOCATION`, SKU and Linux runtime. Read only needed values, not the full environment (which can contain secrets). Confirm the active Azure CLI subscription matches; stop for clarification on context conflicts or incompatible targets. Recheck quota if effective values change.

Check target-resource existence, not merely environment existence. If resources are missing, run the quota gate above and provision only when the full template is within this code-only App Service scope; otherwise hand off to `azure-prepare`. Do not run project-wide `azd up` or deploy unrelated services.

```bash
azd provision || exit 1
```
```powershell
azd provision
if ($LASTEXITCODE -ne 0) { throw "azd provisioning failed" }
```

## Deploy code only (subsequent deploys)

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

Resolve the selected app's endpoint without hitting the site:

```bash
# bash
HOST=$(az webapp show -n <selected-app> -g <selected-rg> --query defaultHostName -o tsv) || exit 1
printf 'https://%s\n' "$HOST"
```

```powershell
# PowerShell
$hostName = az webapp show -n <selected-app> -g <selected-rg> --query defaultHostName -o tsv
if ($LASTEXITCODE -ne 0) { throw "Could not resolve selected app endpoint" }
"https://$hostName"
```

Present the URL with the `https://` prefix and the post-deploy message from [post-deploy-message.md](post-deploy-message.md), then end the turn.

## Notes

- ⛔ Do **not** run `azd init -t <template>` in an existing workspace — it can destroy user code. Only `azd init` (no template) is safe inside an existing project.
- Preserve compatible template defaults; stop before changing the template or switching targets.
