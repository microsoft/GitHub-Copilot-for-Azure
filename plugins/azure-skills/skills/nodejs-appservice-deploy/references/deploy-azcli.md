# Deploy via `az` CLI

Use this path when there is **no** `azure.yaml`. Existing projects targeting another host belong to `azure-prepare`.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- For complex PowerShell queries, follow [Windows Azure CLI quoting](create-app.md#windows-azure-cli-quoting).
- Verify the latest stable Azure CLI is installed ([installation/update guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows?pivots=winget)).
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3) and Web App (Node runtime) exist (see [create-app.md](create-app.md))

## 1. Enable server-side build

Read setting names only. Remove only `WEBSITE_RUN_FROM_PACKAGE` if present, then recheck; stop on read/delete errors. Keep `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. Setting changes restart the app.

```bash
CONFLICT=$(az webapp config appsettings list -n <app> -g <rg> --query "[?name=='WEBSITE_RUN_FROM_PACKAGE'].name" -o tsv) || exit 1
[ -z "$CONFLICT" ] || { echo "Resolve WEBSITE_RUN_FROM_PACKAGE before source deployment" >&2; exit 1; }
```
```powershell
$names = @(az webapp config appsettings list -n <app> -g <rg> --query "[].name" -o tsv)
if ($LASTEXITCODE -ne 0) { throw "Could not read app setting names" }
if ($names -contains 'WEBSITE_RUN_FROM_PACKAGE') { throw "Resolve WEBSITE_RUN_FROM_PACKAGE before source deployment" }
```

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

Oryx then runs `npm install` (including `devDependencies`), `npm run build` if a `build` script exists, and `npm run build:azure` if present.

## 2. Startup command — only when needed

Skip for apps with a `start` script or common entry file. Set it for NestJS and static SPAs, and warn for apps with no start entry. See [startup-commands.md](startup-commands.md).

## 3. Package the code

### Normalize Linux scripts

Before every deployment/redeployment, explicitly select shipped `.sh` files, text executables with a shebang (e.g. `bin/www`), and referenced startup scripts. Exclude binaries and `node_modules`. From the application root, replace the example path below with the selected files; skip only if none exist.

This command works in Bash and PowerShell (single quotes + template literals avoid shell quoting issues), preserves permissions, normalizes CRLF/lone CR, then re-reads bytes to verify LF:

```bash
node -e 'const fs=require(`fs`);for(const f of process.argv.slice(1)){const d=fs.readFileSync(f);if(d.includes(0))throw new Error(f);const s=d.toString(`latin1`);const lf=s.replace(/\r\n?/g,`\n`);if(lf!==s)fs.writeFileSync(f,Buffer.from(lf,`latin1`));if(fs.readFileSync(f).includes(13))throw new Error(f)}' ./startup.sh
```

Immediately check the result **in the same shell call** before packaging:

```bash
if [ "$?" -ne 0 ]; then exit 1; fi
```

```powershell
if (-not $? -or $LASTEXITCODE -ne 0) { throw "LF normalization/validation failed" }
```

### Create a fresh ZIP

Package only after normalization/validation succeeds. Stop on any failure; deployment requires successful packaging, not merely an existing archive.

Zip the project **without** `node_modules` (the remote build installs Linux-native packages) or build caches:

```bash
# bash
rm -f app.zip || exit 1
zip -r app.zip . \
  -x ".git/*" -x "node_modules/*" -x ".next/*" -x ".env" -x ".env.*" -x "app.zip" \
  || { rm -f app.zip; exit 1; }
```

```powershell
# PowerShell
if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
$exclude = @('.git','node_modules','.next','.env','app.zip')
$items = Get-ChildItem -Force -ErrorAction Stop | Where-Object { $exclude -notcontains $_.Name -and $_.Name -notlike '.env.*' }
try {
    Compress-Archive -Path $items -DestinationPath app.zip -Force -ErrorAction Stop
} catch {
    if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
    throw
}
```

> ⚠️ **Warning:** If the app has **no** `build` script but commits prebuilt output (e.g. `dist/`), keep that folder in the ZIP.

## 4. Deploy the zip

Proceed only if normalization, validation and ZIP creation all succeeded in this attempt. Never deploy a stale/partial archive or continue after a failed packaging call.

```bash
az webapp deploy \
  -n <app> -g <rg> \
  --src-path app.zip \
  --type zip \
  --track-status false \
  --enriched-errors true
```
```powershell
az webapp deploy `
  -n <app> -g <rg> `
  --src-path app.zip `
  --type zip `
  --track-status false `
  --enriched-errors true
```

Do not use `--only-show-errors` or suppress enriched diagnostics. Report failures with suggested fixes and the Copilot prompt, not success.

> 💡 **Tip:** `--track-status false` returns once the ZIP is **accepted by the SCM endpoint** — not when the Oryx `npm install`/`npm run build` finishes. If the site never starts, inspect `az webapp log deployment list/show`.

## 5. Stop. Report the endpoint to the user.

After `az webapp deploy` returns, the skill is done.

> ⛔ **Do NOT run** `az webapp log tail`, `curl`, `Invoke-WebRequest`, `wget`, or any other "verify startup" command. App Service routinely needs **2–3 minutes** to warm the container; a quiet log stream or a 5xx in the first couple of minutes is **not** a failure signal, and running these probes here will mislead the user.

Resolve the host name without hitting the site:

```bash
HOST=$(az webapp show -n <app> -g <rg> --query defaultHostName -o tsv)
echo "https://$HOST"
```
```powershell
$host_ = az webapp show -n <app> -g <rg> --query defaultHostName -o tsv
"https://$host_"
```

Then print the post-deploy message from [post-deploy-message.md](post-deploy-message.md) and end the turn. The user will run `az webapp log tail -n <app> -g <rg>` themselves if they want to watch logs.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| `Cannot find module 'express'` (or any dep) | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` not set — re-run step 1 then redeploy |
| Container ping timeout on port 8080 | App not listening on `process.env.PORT` — see [startup-commands.md](startup-commands.md) |
| Native module errors (`invalid ELF header`) | Local `node_modules` was zipped — exclude it and redeploy |
| `webapp up` examples in older docs | Replace with `az webapp create` + `az webapp deploy` (this file) |
