# Symfony Oryx Build Preflight

The source ZIP excludes `.env*`, but Oryx runs Composer scripts, including `cache:clear`. Before packaging:

1. Inspect `composer.json` scripts and `config/` for required environment variables; do not assume every app needs `DEFAULT_URI`. Obtain secrets from the user or approved store; never print them or package `.env`.
2. Check the locked `symfony/runtime` version. JSON `APP_RUNTIME_OPTIONS` requires Runtime 7.4+; after installation, confirm the generated `vendor/autoload_runtime.php` decodes JSON. For older/custom bootstraps, establish a dotenv-free equivalent; ask before changing bootstrap or dependencies.
3. For JSON-capable Runtime, merge `disable_dotenv: true` into existing options. Configure `APP_ENV=prod`, `APP_DEBUG=0` and only required app-specific settings before the Oryx build; respect explicit user configuration and resolve conflicts first.

Use a temporary UTF-8 JSON settings file outside the package root. Its `APP_RUNTIME_OPTIONS` value must be a JSON-encoded string containing the **merged** options. Include only settings being changed; preserve unrelated settings. Apply it without printing values:

```bash
az webapp config appsettings set -n <app> -g <rg> --settings "@<settings-file>.json" -o none || exit 1
```
```powershell
az webapp config appsettings set -n <app> -g <rg> --settings "@<settings-file>.json" -o none
if ($LASTEXITCODE -ne 0) { throw "Could not configure Symfony build settings" }
```

Delete the temporary file even on failure. Privately verify the persisted Runtime options and required setting names; stop on read, parse or value mismatches without printing secrets.

In a dedicated local shell, supply the same merged options (`RUNTIME_OPTIONS` / `$runtimeOptions`) and required environment variables before installing locked dependencies. Use local-only secret values where possible. With dependencies installed, run the full production cache clear from the app root (examples assume JSON-capable Runtime):

```bash
APP_ENV=prod APP_DEBUG=0 APP_RUNTIME_OPTIONS="$RUNTIME_OPTIONS" php bin/console cache:clear --no-ansi || exit 1
```
```powershell
$env:APP_ENV = 'prod'
$env:APP_DEBUG = '0'
$env:APP_RUNTIME_OPTIONS = $runtimeOptions
php bin\console cache:clear --no-ansi
if ($LASTEXITCODE -ne 0) { throw "Symfony production cache clear failed" }
```

Do not use `--no-warmup`. Stop before packaging/deployment if the command fails or the dotenv-free build environment cannot be reproduced. See [Symfony Runtime options](https://symfony.com/doc/current/components/runtime.html#using-options).
