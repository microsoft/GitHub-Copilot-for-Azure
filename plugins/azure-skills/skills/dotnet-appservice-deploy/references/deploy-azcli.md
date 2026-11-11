# Deploy via `az` CLI

Use when no `azure.yaml` exists. A file targeting another host is a handoff to `azure-prepare`, not permission to deploy somewhere else.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- For complex PowerShell queries, follow [Windows Azure CLI quoting](create-app.md#windows-azure-cli-quoting).
- Verify the latest stable Azure CLI is installed.
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3) and Web App with a matching .NET runtime exist (see [create-app.md](create-app.md))

## 1. Enable server-side build

Check setting names without printing values. If `WEBSITE_RUN_FROM_PACKAGE` exists, remove only that setting when switching to source deployment, then rerun the check. Stop on read/delete errors; app-setting changes restart the app.

```bash
CONFLICT=$(az webapp config appsettings list -n <app> -g <rg> --query "[?name=='WEBSITE_RUN_FROM_PACKAGE'].name" -o tsv) || exit 1
[ -z "$CONFLICT" ] || { echo "Resolve WEBSITE_RUN_FROM_PACKAGE before source deployment" >&2; exit 1; }
```
```powershell
$names = @(az webapp config appsettings list -n <app> -g <rg> --query "[].name" -o tsv)
if ($LASTEXITCODE -ne 0) { throw "Could not read app setting names" }
if ($names -contains 'WEBSITE_RUN_FROM_PACKAGE') { throw "Resolve WEBSITE_RUN_FROM_PACKAGE before source deployment" }
```

Run from the archive root selected in [detect.md](detect.md). Substitute the actual project path:

```bash
az webapp config appsettings set -n <app> -g <rg> \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true PROJECT="src/Web/Web.csproj" -o none
```

```powershell
az webapp config appsettings set -n <app> -g <rg> `
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true PROJECT="src/Web/Web.csproj" -o none
```

Oryx runs `dotnet restore` and `dotnet publish`. This path deploys **source**, not local publish output.

## 2. Startup command — normally automatic

Startup is normally automatic; see [startup-commands.md](startup-commands.md).

## 3. Package the code

### Normalize Linux scripts

Before every deployment, explicitly select shipped shell/startup files (including pre/post-build scripts). Skip only if none exist. From the archive root, replace `./startup.sh` with actual paths:

```bash
for f in ./startup.sh; do
  perl -pi -e 's/\r\n?/\n/g' "$f" || exit 1
  if grep -q $'\r' "$f"; then exit 1; elif [ "$?" -ne 1 ]; then exit 1; fi
done
```

```powershell
foreach ($f in @('./startup.sh')) {
  $p = (Resolve-Path $f -ErrorAction Stop).Path
  $b = [IO.File]::ReadAllBytes($p)
  if ($b -contains 0) { throw "Binary file: $f" }
  $s = [Text.Encoding]::GetEncoding(28591).GetString($b)
  $lf = $s -replace "`r`n?", "`n"
  if ($lf -ne $s) { [IO.File]::WriteAllBytes($p, [Text.Encoding]::GetEncoding(28591).GetBytes($lf)) }
  if ([IO.File]::ReadAllBytes($p) -contains 13) { throw "LF validation failed: $f" }
}
```

Stop on any normalization/validation failure.

### Create a fresh ZIP

Include source at the ZIP root, not an enclosing directory. Exclude `bin/` and `obj/` at **every** depth, local caches and secrets. Keep `wwwroot/` assets and project references. Review configuration files for secrets first.

```bash
rm -f app.zip || exit 1
zip -r app.zip . \
  -x '.git/*' '.vs/*' '*/.vs/*' 'bin/*' '*/bin/*' 'obj/*' '*/obj/*' \
  'node_modules/*' '*/node_modules/*' '.env' '.env.*' '*/.env' '*/.env.*' \
  '*.pubxml' '*.pubxml.user' '*.user' '*.pfx' '*.p12' 'app.zip' \
  || { rm -f app.zip; exit 1; }
```

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = (Get-Location).Path
$archive = Join-Path $root 'app.zip'
if (Test-Path $archive) { Remove-Item $archive -ErrorAction Stop }
$zip = [IO.Compression.ZipFile]::Open($archive, 'Create')
try {
  Get-ChildItem -LiteralPath $root -File -Recurse -Force -ErrorAction Stop |
    Where-Object {
      $_.FullName.Substring($root.Length + 1) -notmatch '(^|[\\/])(\.git|\.vs|bin|obj|node_modules)([\\/]|$)' -and
      $_.Name -notmatch '^(\.env($|\.)|app\.zip$)|\.(pubxml|pubxml\.user|user|pfx|p12)$'
    } | ForEach-Object {
      $name = $_.FullName.Substring($root.Length + 1).Replace('\','/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
    }
} catch {
  $zip.Dispose()
  Remove-Item $archive -ErrorAction Stop
  throw
} finally { $zip.Dispose() }
```

## 4. Deploy the zip

Proceed only if normalization, validation and ZIP creation all succeeded in this attempt. Never deploy a stale/partial archive or continue after a failed packaging call.

```bash
az webapp deploy -n <app> -g <rg> --src-path app.zip \
  --type zip --track-status false --enriched-errors true
```

```powershell
az webapp deploy -n <app> -g <rg> --src-path app.zip `
  --type zip --track-status false --enriched-errors true
```

Check the native exit code in the same shell call (`$LASTEXITCODE` in PowerShell). Report failures, not success. Do not suppress enriched diagnostics. Never use `az webapp up`.

## 5. Stop. Report the endpoint to the user.

After `az webapp deploy` returns, the skill is done.

Resolve `defaultHostName` with `az webapp show -n <app> -g <rg> --query defaultHostName -o tsv`, present it as `https://...`, then print [post-deploy-message.md](post-deploy-message.md).

Do not run log tail or HTTP probes. Acceptance is not proof Oryx completed or the app is healthy; allow 2–3 minutes for restore/publish and warm-up.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Wrong project or missing references | Select `PROJECT` and include referenced projects under the ZIP root ([detect.md](detect.md)). |
| Build did not run | Enable `SCM_DO_BUILD_DURING_DEPLOYMENT` and remove conflicting `WEBSITE_RUN_FROM_PACKAGE`; redeploy. |
| Runtime or SDK mismatch | Match the target framework and SDK; see [errors.md](errors.md). |
| ZIP contains local build output | Exclude `bin/` and `obj/` at every depth and create a fresh ZIP. |
