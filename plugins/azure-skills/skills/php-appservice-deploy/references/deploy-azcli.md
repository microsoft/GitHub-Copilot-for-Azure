# Deploy via `az` CLI

Use this path when there is **no** `azure.yaml`. Existing projects targeting another host belong to `azure-prepare`.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- For complex PowerShell queries, follow [Windows Azure CLI quoting](create-app.md#windows-azure-cli-quoting).
- Verify the latest stable Azure CLI is installed ([installation/update guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows?pivots=winget)).
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3) and Web App (PHP runtime) exist (see [create-app.md](create-app.md))

## 1. Enable server-side build

Needed when `composer.json` exists.

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

Oryx then runs `composer install`. It does **not** run npm — build front-end assets (e.g. `npm run build` for Vite) locally before packaging.

## 2. Startup command and app settings — only when needed

Skip for plain PHP with `index.php` in the root. Set the startup script for `public/` document roots, and `APP_KEY` for Laravel. See [startup-commands.md](startup-commands.md). For Symfony, complete the [build preflight](symfony-build.md) before packaging.

## 3. Package the code

### Normalize Linux scripts

Before every deployment/redeployment, select shipped `.sh` files (including `azure-startup.sh`), text executables with a shebang, and referenced startup scripts. Exclude binaries and `vendor`. From the application root, replace the example path with the selected files; skip only if none exist. Both commands normalize CRLF/lone CR, then re-read bytes to verify LF:

```bash
for f in ./azure-startup.sh; do
  perl -pi -e 's/\r\n?/\n/g' "$f" || exit 1
  if grep -q $'\r' "$f"; then exit 1; elif [ "$?" -ne 1 ]; then exit 1; fi
done
```

```powershell
foreach ($f in @('./azure-startup.sh')) {
  $p = (Resolve-Path $f -ErrorAction Stop).Path
  $b = [IO.File]::ReadAllBytes($p)
  if ($b -contains 0) { throw "Binary file: $f" }
  $s = [Text.Encoding]::GetEncoding(28591).GetString($b)
  $lf = $s -replace "`r`n?", "`n"
  if ($lf -ne $s) { [IO.File]::WriteAllBytes($p, [Text.Encoding]::GetEncoding(28591).GetBytes($lf)) }
  if ([IO.File]::ReadAllBytes($p) -contains 13) { throw "LF normalization/validation failed: $f" }
}
```

Stop on any failure before packaging.

### Create a fresh ZIP

Package a sanitized staging copy, excluding `.git`, `vendor`, `node_modules`, `.env`/`.env.*` at every depth and generated `bootstrap/cache/*.php`. Do not modify the source. Keep Laravel's `storage/` and `bootstrap/cache/` folders and their placeholder files.

```bash
# bash
rm -f app.zip || exit 1
ARCHIVE="$PWD/app.zip"
STAGE=$(mktemp -d) || exit 1
(set -o pipefail; tar -cf - \
  --exclude='.git' --exclude='vendor' --exclude='node_modules' \
  --exclude='.env' --exclude='.env.*' --exclude='*/.env' --exclude='*/.env.*' \
  --exclude='*/bootstrap/cache/*.php' --exclude='app.zip' . | tar -xf - -C "$STAGE") \
  || { rm -r -- "$STAGE"; exit 1; }
(cd "$STAGE" && zip -r "$ARCHIVE" .) \
  || { rm -r -- "$STAGE"; rm -f app.zip; exit 1; }
rm -r -- "$STAGE" || exit 1
```

```powershell
# PowerShell
if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
$root = (Get-Location).Path
$stage = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
try {
    Get-ChildItem -LiteralPath $root -File -Force -Recurse -ErrorAction Stop | ForEach-Object {
        $relative = $_.FullName.Substring($root.Length + 1) -replace '\\','/'
        if ($relative -match '(^|/)(\.git|vendor|node_modules)(/|$)|(^|/)\.env(\.|$)|(^|/)bootstrap/cache/[^/]+\.php$|^app\.zip$') { return }
        $destination = Join-Path $stage $relative
        New-Item -ItemType Directory -Path (Split-Path $destination) -Force -ErrorAction Stop | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $destination -ErrorAction Stop
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, (Join-Path $root 'app.zip'))
} catch {
    if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
    throw
} finally {
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction Stop
}
```

### Laravel: verify required folders are in the ZIP

```bash
unzip -l app.zip | grep -Eq ' storage/framework/' && unzip -l app.zip | grep -Eq ' bootstrap/cache/' || { echo "ZIP is missing storage/ or bootstrap/cache/"; exit 1; }
```
```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path app.zip).Path)
try { $names = $zip.Entries.FullName -replace '\\','/' } finally { $zip.Dispose() }
if (-not ($names -like 'storage/framework/*') -or -not ($names -like 'bootstrap/cache/*')) { throw "ZIP is missing storage/ or bootstrap/cache/" }
```

If a folder is missing locally, add it with a placeholder `.gitignore` (tell the user) and re-package.

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

> 💡 **Tip:** `--track-status false` returns once the ZIP is **accepted by the SCM endpoint** — not when `composer install` finishes. If the site never starts, inspect `az webapp log deployment list/show`.

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
| Deployed code missing dependencies | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` not set — re-run step 1 then redeploy |
| Default page or 404 for Laravel | Wrong document root — see [startup-commands.md](startup-commands.md) |
| Zip too large (>500 MB) | Exclude `vendor`, `node_modules`, and caches; consider a `.deployment` `.gitignore`-style file |
| `webapp up` examples in older docs | Replace with `az webapp create` + `az webapp deploy` (this file) |
