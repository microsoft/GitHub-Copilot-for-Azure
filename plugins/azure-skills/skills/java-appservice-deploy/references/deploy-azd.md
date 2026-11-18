# Deploy via `azd`

Use this path when the workspace already has an `azure.yaml` whose service host is `appservice`.

## When to use

| Condition | Use azd? |
|---|---|
| `azure.yaml` exists AND `services.<name>.host: appservice` | ✅ Yes |
| `azure.yaml` exists but targets Container Apps / Functions / etc. | ❌ Hand off to `azure-prepare` |
| No `azure.yaml` | ❌ Use [deploy-azcli.md](deploy-azcli.md) |

## Confirm host target

Inspect the selected service in `azure.yaml`; do not assume a `host` line belongs to that service. It must use `host: appservice` and `language: java`.

azd builds the Java service locally (Maven; the wrapper when present) and deploys the produced JAR/WAR/EAR. Verify a local JDK matching the project's Java release. Check that `services.<name>.project` points to the deployable module, and surface build errors; never silently change Java versions or the build system. If azd cannot package the project's build tool, report it rather than converting builds.

```yaml
services:
  web:
    project: ./web
    language: java
    host: appservice
```

For previously source-built apps, remove only existing `SCM_DO_BUILD_DURING_DEPLOYMENT` and `WEBSITE_RUN_FROM_PACKAGE` settings. Verify the latest stable Azure CLI.

Before every `azd deploy <service-name>`, run the shared [LF normalization and validation example](deploy-azcli.md#normalize-linux-scripts) on the service's actual package inputs, including startup scripts. Use its shell-specific exit guard. Package only after normalization/validation succeeds; any normalization, build or deployment failure stops deployment. Require a fresh artifact, never a cached artifact from a failed attempt.

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

```powershell
azd env new <env-name>
if ($LASTEXITCODE -ne 0) { throw "azd environment creation failed" }
# Only for requested overrides consumed by the template:
azd env set AZURE_LOCATION <checked-region>
if ($LASTEXITCODE -ne 0) { throw "azd location configuration failed" }
azd env set APP_SERVICE_SKU "<checked-sku>"
if ($LASTEXITCODE -ne 0) { throw "azd SKU configuration failed" }
```

Only execute the override lines when explicitly requested and consumed by the template; otherwise preserve defaults. Do not introduce or change templates without approval.

## Provision missing resources

Before provisioning **or deploying**, resolve the selected service's actual app/RG and the environment's effective `AZURE_SUBSCRIPTION_ID`, `AZURE_LOCATION`, SKU, OS, Java version and server. Read only needed values, not the full environment (which can contain secrets). Confirm the active Azure CLI subscription and requested context match. Require Linux and a runtime/server compatible with the detected artifact's Java release, packaging and `javax`/`jakarta` APIs. Stop on incompatibility or context conflicts; ask before changing template parameters. Recheck quota if effective values change.

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
if ($LASTEXITCODE -ne 0) { throw "azd packaging/deployment failed" }
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

Present the URL with the `https://` prefix and the post-deploy message from [post-deploy-message.md](post-deploy-message.md), then end the turn. Note that azd built the artifact locally; do not report a failed build/deployment as success.

## Notes

- ⛔ Do **not** run `azd init -t <template>` in an existing workspace — it can destroy user code. Only `azd init` (no template) is safe inside an existing project.
- Preserve compatible template defaults; stop before changing the template or switching targets.
