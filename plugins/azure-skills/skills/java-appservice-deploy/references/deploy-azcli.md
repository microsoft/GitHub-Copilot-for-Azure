# Deploy via `az` CLI

Use when no `azure.yaml` exists. A file targeting another host is a handoff to `azure-prepare`, not permission to deploy somewhere else.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- For complex PowerShell queries, follow [Windows Azure CLI quoting](create-app.md#windows-azure-cli-quoting).
- Verify the latest stable Azure CLI is installed.
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3), a matching Java runtime and local JDK exist (see [create-app.md](create-app.md))

## 1. Build locally

Run the build selected in [detect.md](detect.md) from the project (or module) root, checking the exit code in the same shell call:

```bash
./mvnw clean package || exit 1
```

```powershell
.\mvnw.cmd clean package
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
```

Stop on any build failure. Never deploy an artifact left over from an earlier build.

## 2. Select the artifact

Pick exactly one fresh JAR/WAR/EAR (adjust `target/` → `build/libs/` for Gradle):

```bash
ls -t target/*.jar target/*.war target/*.ear 2>/dev/null \
  | grep -Ev '(-plain|-sources|-javadoc|-tests)\.jar$|\.original$'
```

```powershell
Get-ChildItem target -File -Include *.jar,*.war,*.ear -Recurse -Depth 0 |
  Where-Object { $_.Name -notmatch '(-plain|-sources|-javadoc|-tests)\.jar$' } |
  Sort-Object LastWriteTime -Descending | Select-Object -ExpandProperty FullName
```

If more than one remains, ask which to deploy.

## 3. Prepare app settings

Deploy prebuilt artifacts without remote build. Read setting names only; remove only existing `SCM_DO_BUILD_DURING_DEPLOYMENT` and `WEBSITE_RUN_FROM_PACKAGE` settings. Stop on read/delete errors. Setting changes restart the app.

```bash
NAMES=$(az webapp config appsettings list -n <app> -g <rg> --query "[].name" -o tsv) || exit 1
TO_REMOVE=()
while IFS= read -r name; do
  case "$name" in
    SCM_DO_BUILD_DURING_DEPLOYMENT|WEBSITE_RUN_FROM_PACKAGE) TO_REMOVE+=("$name") ;;
  esac
done <<< "$NAMES"
if [ "${#TO_REMOVE[@]}" -gt 0 ]; then
  az webapp config appsettings delete -n <app> -g <rg> --setting-names "${TO_REMOVE[@]}" -o none || exit 1
fi
```

```powershell
$names = @(az webapp config appsettings list -n <app> -g <rg> --query "[].name" -o tsv)
if ($LASTEXITCODE -ne 0) { throw "Could not read app setting names" }
$toRemove = @($names | Where-Object { $_ -in @('SCM_DO_BUILD_DURING_DEPLOYMENT', 'WEBSITE_RUN_FROM_PACKAGE') })
if ($toRemove.Count -gt 0) {
  az webapp config appsettings delete -n <app> -g <rg> --setting-names $toRemove -o none
  if ($LASTEXITCODE -ne 0) { throw "Could not remove conflicting app settings" }
}
```

Startup is normally automatic; see [startup-commands.md](startup-commands.md).

### Normalize Linux scripts

Only when shipping a startup script (e.g., `startup.sh` deployed with `--type startup`), normalize it to LF first and verify there are no CR bytes:

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

## 4. Deploy the artifact

Use `--type jar` (Java SE), `war` (Tomcat/JBoss EAP) or `ear` (JBoss EAP). OneDeploy renames JAR/WAR packages to `app.jar`/`app.war` under `/home/site/wwwroot`; the web artifact is served at the root path. For EAR, preserve the context root from `application.xml`; use `<context-root>/</context-root>` if it must be served at `/`.

```bash
az webapp deploy -n <app> -g <rg> --src-path target/<artifact>.jar \
  --type jar --track-status false --enriched-errors true
```

```powershell
az webapp deploy -n <app> -g <rg> --src-path target/<artifact>.jar `
  --type jar --track-status false --enriched-errors true
```

Check the native exit code in the same shell call. Report failures, not success. Do not suppress enriched diagnostics. Never use `az webapp up` or FTP for JAR/WAR.

## 5. Stop. Report the endpoint to the user.

After `az webapp deploy` returns, the skill is done.

Resolve `defaultHostName` with `az webapp show -n <app> -g <rg> --query defaultHostName -o tsv`, present it as `https://...`, then print [post-deploy-message.md](post-deploy-message.md).

Do not run log tail or HTTP probes. Upload acceptance is not proof the app is healthy; allow 2–3 minutes for JVM startup.
