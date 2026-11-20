# Package PHP source

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
