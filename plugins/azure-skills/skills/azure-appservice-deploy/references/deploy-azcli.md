# Deploy via `az` CLI

Use this path when there is **no** `azure.yaml`. A different service host is a handoff, not a CLI fallback.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- Verify the latest stable Azure CLI is installed ([installation/update guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows?pivots=winget)).
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3) and Web App (selected runtime) exist (see [create-app.md](create-app.md))

## 1. Enable server-side build

For source ZIPs only. For Java artifacts, don't enable remote build.

```bash
az webapp config appsettings set \
  -n <app> -g <rg> \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true -o none || exit 1
```
```powershell
az webapp config appsettings set `
  -n <app> -g <rg> `
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true -o none
if ($LASTEXITCODE -ne 0) { throw "Could not enable remote build" }
```

For Python, this tells Oryx to run `pip install -r requirements.txt`. Other stacks use the build rules and additional settings from their language guide.

## 2. Startup command — follow the selected language guide

For non-Python apps, follow the selected language guide instead of the examples below.

Azure App Service (Oryx) auto-detects **Flask** and **Django** — **do not set a startup command** for these. Skip this step entirely.

For **FastAPI**, always set the uvicorn startup command, regardless of the Python runtime version. This skill does **not** rely on Oryx FastAPI auto-detection, so the behavior is identical on every supported runtime (3.12, 3.13, 3.14, …):

```bash
az webapp config set -n <app> -g <rg> \
  --startup-file "python -m uvicorn main:app --host 0.0.0.0"
```
```powershell
az webapp config set -n <app> -g <rg> `
  --startup-file "python -m uvicorn main:app --host 0.0.0.0"
```

(Replace `main:app` if the FastAPI entry point differs — e.g., `app.main:app`.)

For other Python frameworks (generic WSGI / ASGI / unknown), **skip this step** and emit the manual-startup warning. See [Python startup commands](python/startup-commands.md).

## 3. Package the code

Follow the selected guide's preflight and package rules. Java builds a fresh JAR/WAR/EAR instead of creating a ZIP; PHP uses its own [ZIP recipe](php/package.md).

### Normalize Linux scripts

Follow the shared [LF normalization and validation procedure](normalize-scripts.md) on shipped scripts before packaging.

### Create a fresh ZIP

Package only after normalization/validation succeeds. Stop on any failure; deployment requires successful packaging, not merely an existing archive.

ZIP the contents of the selected project root, applying the stack's exclusions. The examples below are for Python; exclude local secrets (including nested `.env*` files) and verify the resulting archive before deploying. For Node.js and .NET preserve the workspace or project references required to build.

```bash
# bash
rm -f app.zip || exit 1
zip -r app.zip . \
  -x ".git/*" -x ".venv/*" -x "venv/*" -x "__pycache__/*" \
  -x "*.pyc" -x ".env*" -x "*/.env*" -x "node_modules/*" -x "app.zip" \
  || { rm -f app.zip; exit 1; }
```

```powershell
# PowerShell
if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
$exclude = @('.git','.venv','venv','__pycache__','node_modules','app.zip')
$items = Get-ChildItem -Force -ErrorAction Stop | Where-Object { $exclude -notcontains $_.Name -and $_.Name -notlike '.env*' }
try {
    Compress-Archive -Path $items -DestinationPath app.zip -Force -ErrorAction Stop
} catch {
    if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
    throw
}
```

For PowerShell projects with nested secrets or required hidden files, stage only allowed files before archiving and verify the resulting entries. Do not upload if excluded files remain or required files are missing.

## 4. Deploy the package

Proceed only if normalization, validation and packaging all succeeded in this attempt. Never deploy a stale/partial archive. For Java, replace `app.zip` with the fresh artifact path and use `--type jar`, `war`, or `ear`.

```bash
az webapp deploy \
  -n <app> -g <rg> \
  --src-path app.zip \
  --type zip \
  --track-status false \
  --enriched-errors true || exit 1
```
```powershell
az webapp deploy `
  -n <app> -g <rg> `
  --src-path app.zip `
  --type zip `
  --track-status false `
  --enriched-errors true
if ($LASTEXITCODE -ne 0) { throw "Deployment failed" }
```

Do not use `--only-show-errors` or suppress enriched diagnostics. Report failures with suggested fixes and the Copilot prompt, not success.

> 💡 `--track-status false` returns once the ZIP is **accepted by the SCM endpoint** — this is **not** the same as "Oryx build succeeded". The server-side `pip install` / startup-command rendering happens asynchronously after the CLI returns. A zero exit code only confirms the upload + a deployment record. If the site never starts, inspect the build outcome via `az webapp log deployment list/show` — that is the only authoritative confirmation that the build itself succeeded.

## 5. Stop. Report the endpoint to the user.

After `az webapp deploy` returns, the skill is done.

> ℹ️ `az webapp deploy` does **not** initiate a cold start by pinging the site. With `--track-status false`, it returns as soon as the SCM endpoint accepts the ZIP; the Oryx build and container restart happen asynchronously on the SCM side. The container only warms up when an inbound HTTP request actually hits `https://<app>.azurewebsites.net` — which is why the post-deploy message tells the user to expect a 2–3 minute wait on their first visit.

> ⛔ **Do NOT run** `az webapp log tail`, `curl`, `Invoke-WebRequest`, `wget`, or any other "verify startup" command. App Service routinely needs **2–3 minutes** to warm the container; a quiet log stream or a 5xx in the first couple of minutes is **not** a failure signal, and running these probes here will mislead the user.

Resolve the host name without hitting the site:

```bash
HOST=$(az webapp show -n <app> -g <rg> --query defaultHostName -o tsv) || exit 1
[ -n "$HOST" ] || exit 1
echo "https://$HOST"
```
```powershell
$host_ = az webapp show -n <app> -g <rg> --query defaultHostName -o tsv
if ($LASTEXITCODE -ne 0 -or -not $host_) { throw "Could not resolve app hostname" }
"https://$host_"
```

Then print the post-deploy message from [post-deploy-message.md](post-deploy-message.md) and end the turn. The user will run `az webapp log tail -n <app> -g <rg>` themselves if they want to watch logs.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Deployed code missing dependencies | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` not set — re-run step 1 then redeploy |
| Container ping timeout | Check the selected language's startup command and port binding |
| Zip too large (>500 MB) | Exclude `.venv`, caches; consider `.deployment` `.gitignore`-style file |
| `webapp up` examples in older docs | Replace with `az webapp create` + `az webapp deploy` (this file) |
