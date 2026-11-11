# Troubleshooting

## Quick diagnosis flow

```
Deploy failed?
  ├─ Check `az webapp log deployment list` / `show` for composer build errors
  ├─ Then `az webapp log tail` for NGINX / PHP-FPM / startup errors
  ├─ Then `az webapp config show` to verify runtime + startup
  └─ For `Connection reset` / `429` / `502-504` on create commands,
      see transient-retry.md
```

See [transient-retry.md](transient-retry.md) for the retry procedure.

## Symptom → Cause → Fix

| Symptom | Likely cause | Fix |
|---|---|---|
| `vendor/autoload.php: Failed to open stream` | Build skipped, `composer install` didn't run | `az webapp config appsettings set --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true` then redeploy |
| Default "hostingstart" page, or 404/403 at `/` for Laravel/Symfony | NGINX root still `/home/site/wwwroot` | Set the `public/` startup script ([startup-commands.md](startup-commands.md)) |
| `/` works but other routes return 404 | `try_files` not routing to `index.php` | Use the provided `azure-nginx.conf`; confirm startup command is set |
| `Please provide a valid cache path` | `storage/framework/{sessions,views,cache}` missing | Keep `storage/` placeholders in the ZIP; startup script runs `mkdir -p` ([startup-commands.md](startup-commands.md)) |
| `The stream or file ".../storage/logs/laravel.log" could not be opened` / session write failures | `storage/` or `bootstrap/cache/` missing or not writable | Same as above; or set `LOG_CHANNEL=stderr` |
| `The bootstrap/cache directory must be present and writable` during build | `bootstrap/cache/` dropped from the ZIP | Add `bootstrap/cache/.gitignore`, verify ZIP contents ([deploy-azcli.md](deploy-azcli.md)), redeploy |
| `No application encryption key has been specified` | `APP_KEY` app setting missing (`.env` not deployed) | Set `APP_KEY` app setting ([startup-commands.md](startup-commands.md)) |
| `Database file at path [.../database.sqlite] does not exist` | Laravel `database` session/cache driver, no DB provisioned | Use file drivers as appropriate; check whether the project reads `CACHE_STORE` or `CACHE_DRIVER` ([startup-commands.md](startup-commands.md)). |
| `/bin/bash^M: bad interpreter` / `$'\r': command not found` | CRLF in `azure-startup.sh` | Normalize to LF ([deploy-azcli.md](deploy-azcli.md#normalize-linux-scripts)) and redeploy |
| `Your requirements could not be resolved` / PHP version constraint | `composer.json` `require.php` doesn't match runtime | Use a matching `PHP:<version>` runtime ([create-app.md](create-app.md)) |
| Missing `public/build/manifest.json` (Vite) | Oryx PHP build doesn't run npm | Run `npm run build` locally and include `public/build/` |
| Deploy returns 202 but site shows default page | Async deploy not finished | Wait, or re-run with `--track-status true`; check `az webapp log deployment list` |
| `OperationNotAllowed: ... requires the plan to be Linux` | Plan was created as Windows (PHP is Linux-only) | Recreate plan with `--is-linux` ([create-app.md](create-app.md)) |
| `An app with name '<app>' already exists` | Global name collision | Pick a different name |
| `az webapp up` shown in user's notes | Deprecated command | Replace with `az webapp create` + `az webapp deploy --type zip` |
| 401 / unauthorized on deploy | `az login` expired or wrong subscription | `az login` + `az account set -s <sub>` |

## Where logs live

> ⚠️ **Prereq for `az webapp log tail` on a fresh app**: enable container logging once, otherwise the stream stays empty:
>
> ```bash
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```
> ```powershell
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```

| Log | Command |
|---|---|
| Live stream | `az webapp log tail -n <app> -g <rg>` |
| Deployment history | `az webapp log deployment list -n <app> -g <rg>` |
| Deployment details | `az webapp log deployment show -n <app> -g <rg> --deployment-id <id>` |

## When to hand off to `azure-prepare`

Hand off (and stop) if the user needs VNet integration, private endpoints, Front Door, Key Vault references, a database (MySQL, PostgreSQL, SQL, Cosmos DB), Redis, Bicep/Terraform-managed environments, WordPress, or a non-App-Service target.

Tell the user clearly: *"This deployment goes beyond a code push — `azure-prepare` will build the full infrastructure plan."*
