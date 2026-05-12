# Code Deployment — App Service & Functions

After IaC deployment creates the Azure resources, deploy application code.

> ⛔ **`--subscription {subscriptionId}` on EVERY `az` command** (from `context.json.azure.subscriptionId`). Without it, the CLI uses whatever subscription is currently active — which may have changed since the prepare phase. This applies to ALL commands below.

> ⛔ **Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is active BEFORE deploying code.** When the app needs server-side dependency installation (Python pip, Node.js native modules, TypeScript build), Oryx must run during deploy. The Bicep template sets this app setting, but ARM deployment timing can delay propagation — the setting may not be active when code deploy starts.
>
> ```powershell
> # Verify the build setting is active (not just deployed)
> $val = az webapp config appsettings list -g {rg} -n {app} --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT'].value" -o tsv
> if ($val -ne 'true') {
>   az webapp config appsettings set -g {rg} -n {app} --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true
>   Start-Sleep -Seconds 10  # Wait for setting to propagate
> }
> ```
>
> If `az webapp deploy` reports "Build successful. Time: 0(s)", the app needs Oryx but OneDeploy skipped it. See **Step 6b** for the runtime decision rule — Python, Node.js, Ruby, and PHP apps must use Kudu zipdeploy as the primary method.
>
> ⛔ **Oryx compression causes startup failures on ALL tiers.** Oryx compresses installed dependencies into `output.tar.zst` by default. At container startup, the runtime must extract this tarball before the app can start. Extraction can fail silently (files stuck in staging path), time out (F1 shared CPU), or leave `wwwroot` empty (app crashes with `ModuleNotFoundError`). **Always set `ORYX_DISABLE_COMPRESSION=true`** in Bicep app settings — this writes dependencies directly to `wwwroot` during deploy, eliminating the runtime extraction step. Also set `WEBSITES_CONTAINER_START_TIME_LIMIT=1800` for safety. Both settings should be in `prepare-plan.json.deployStrategy.requiredAppSettings` and encoded in Bicep at scaffold time.

## App Service — Pre-Deploy Verification (Step 6a)

After IaC deployment succeeds but BEFORE running `az webapp deploy`:

> ⛔ **Wait for App Service to stabilize before deploying code.** F1 App Service Plans take 30-120 seconds to cold-start after IaC creation. Deploying code immediately after `az deployment group create` returns causes 504 Gateway Timeout (Kudu sidecar not ready). Run this check first:
>
> ```powershell
> # Poll until App Service responds (max 2 min, 10s intervals)
> $maxAttempts = 12; $attempt = 0
> do {
>   $attempt++; Start-Sleep -Seconds 10
>   $state = az webapp show -g {rg} -n {app} --query state -o tsv 2>$null
> } while ($state -ne 'Running' -and $attempt -lt $maxAttempts)
> ```
>
> If the app doesn't reach `Running` after 2 min, check `az webapp log tail` before proceeding. Do NOT retry `az webapp deploy` blindly — failed retries provide no diagnostic value and waste time.

> ⛔ **TypeScript apps fail Oryx build** because `tsc` is a devDependency. Oryx sequence: `PRE_BUILD_COMMAND` → `npm install` (production — removes devDeps) → `npm run build` (`tsc` not found). Fix: move `typescript` to `dependencies` in `package.json` before creating the deploy zip. `PRE_BUILD_COMMAND=npm install --include=dev` does NOT work — the subsequent production install removes devDeps before the build step runs.

When `deployStrategy.codeDeployPattern == "startup-install"`, also surface at the deploy gate:

```
⚠️ First cold start will take 2-5 minutes (native module compilation).
   Subsequent starts are fast (node_modules persists on /home).
```

## App Service — Zip Deploy (Step 6b)

Deploy application code via zip deploy. Scaffold generates `scm.allow: true` for deploy convenience. After code upload, the deploy phase re-disables SCM via REST API.

**Pre-deploy: Verify SCM basic auth is enabled:**

```powershell
# Enable SCM for zip deploy
az rest --method put --url "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/basicPublishingCredentialsPolicies/scm?api-version=2023-12-01" --headers "Content-Type=application/json" --body '{"properties":{"allow":true}}'
```

Log this command in `deploy-audit.log`.

⛔ **OneDeploy (`az webapp deploy`) NEVER triggers Oryx — for ANY runtime.** It calls `/api/publish?type=zip`, a file-copy mechanism: unzip → overwrite `wwwroot` → restart. No `pip install`, `npm install`, `bundle install`, or any Oryx build step runs, regardless of `SCM_DO_BUILD_DURING_DEPLOYMENT`. This is by-design Azure behavior.

**Choose deploy method by runtime:**

| Runtime | Needs Oryx? | Deploy method |
|---|---|---|
| Python | Yes (`pip install`, venv) | **Kudu zipdeploy** (`/api/zipdeploy`) |
| Node.js (server-side) | Yes (`npm install`, `npm run build`) | **Kudu zipdeploy** |
| Ruby | Yes (`bundle install`) | **Kudu zipdeploy** |
| PHP | Yes (`composer install`) | **Kudu zipdeploy** |
| .NET / Java | No (ships compiled artifacts) | `az webapp deploy` (OneDeploy) |
| Static front-end (pre-built `/dist`) | No (CI already built it) | `az webapp deploy` (OneDeploy) |

**OneDeploy command** (.NET/Java/static only): `az webapp deploy --subscription {subscriptionId} --resource-group {rg} --name {app} --src-path app.zip --type zip`

**GitHub Actions:** `azure/webapps-deploy@v3` with managed identity — for CI/CD pipelines.

⛔ **NEVER use `az webapp deployment source config-zip`** — deprecated, fragile, and requires manual credential management.

⛔ **`az webapp deploy` does NOT support `--track-status`** — this flag does not exist. Omit it.

### Kudu Zipdeploy (Oryx-Dependent Runtimes)

For apps needing server-side package installation (Python, Node.js, Ruby, PHP), use Kudu zipdeploy directly:

```powershell
# Get publishing credentials
$creds = az webapp deployment list-publishing-credentials --subscription {sub} -g {rg} -n {app} --query "{user:publishingUserName, pass:publishingPassword}" -o json | ConvertFrom-Json
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($creds.user):$($creds.pass)"))

# Deploy via Kudu zipdeploy (triggers Oryx pip install)
Invoke-WebRequest -Uri "https://{app}.scm.azurewebsites.net/api/zipdeploy?isAsync=true" -Method POST -InFile $zipPath -Headers @{Authorization="Basic $auth"} -ContentType "application/zip" -UseBasicParsing

# Poll until build completes
for ($i = 1; $i -le 40; $i++) {
  Start-Sleep -Seconds 15
  $resp = Invoke-WebRequest -Uri "https://{app}.scm.azurewebsites.net/api/deployments/latest" -Headers @{Authorization="Basic $auth"} -UseBasicParsing
  $deploy = $resp.Content | ConvertFrom-Json
  if ($deploy.complete -eq $true) { break }
}
```

Prerequisites:
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` must be set (verified in Step 6a)
- Runtime manifest must be at the zip root — Oryx detects the runtime from it:
  - Python: `requirements.txt` (or `pyproject.toml`)
  - Node.js: `package.json` (+ lockfile)
  - Ruby: `Gemfile`
  - PHP: `composer.json`
- Do NOT pre-install packages locally — let Oryx run the install remotely
- Log the Kudu deploy command in `deploy-audit.log`

> **SCM auth lifecycle (REST API toggle — no Bicep edits):**
>
> IaC has `scm.allow: true` (deploy convenience). Deploy phase:
> Deploy code → health check → re-disable via REST API → verify `false` → log all in `deploy-audit.log`.
> If re-disable fails, log but don't block — add postDeployRecommendation.

**Zip creation:** Use `System.IO.Compression.ZipFile` with relative paths from workspace root. **On Windows, normalize entry paths: `$entryName = $relativePath.Replace('\', '/')` — ZipFile preserves backslashes which Linux App Service cannot resolve.** Never use `Compress-Archive -Path $files.FullName` — absolute paths flatten the directory structure, causing app crashes (`./src/app` not found).

## Database Post-Deploy Verification

> ⛔ **You MUST read [`database-post-deploy.md`](database-post-deploy.md)** for migration discovery, execution via App Service SSH, error handling, and PostgreSQL-specific checks.
