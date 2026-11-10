# Troubleshooting

## Quick diagnosis flow

```
Deploy failed?
  ├─ Check `az webapp log deployment list` / `show` for npm build errors
  ├─ Then `az webapp log tail` for runtime errors
  ├─ Then `az webapp config show` to verify runtime + startup
  └─ For `Connection reset` / `429` / `502-504` on create commands,
      see transient-retry.md
```

See [transient-retry.md](transient-retry.md) for the retry procedure.

## Symptom → Cause → Fix

| Symptom | Likely cause | Fix |
|---|---|---|
| `Container ... didn't respond to HTTP pings on port: 8080` | App ignores `process.env.PORT` or binds `127.0.0.1` | Listen on `process.env.PORT` and `0.0.0.0` ([startup-commands.md](startup-commands.md)) |
| `Error: Cannot find module '<pkg>'` | Build skipped, deps not installed | `az webapp config appsettings set --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true` then redeploy |
| `Cannot find module '/home/site/wwwroot/dist/...'` | `build` script missing or output path differs | Add `"build"` script (e.g. `tsc`, `nest build`) or fix startup path |
| `npm ERR! Missing script: "start"` | No `start` script | Add one, or set a startup command |
| `invalid ELF header` / native module load error | Windows/macOS `node_modules` was zipped | Exclude `node_modules` from the ZIP and redeploy |
| `sh: 1: next: not found` / `tsc: not found` | `npm install` didn't run or failed | Check deployment log; ensure build automation is on |
| Build fails with `Unsupported engine` / version errors | `engines.node` doesn't match runtime | Recreate/update runtime with matching `NODE:<major>` runtime from discovery ([create-app.md](create-app.md)) |
| Deployment hangs in "Building..." / npm timeout | Large dependency tree or private registry | Check `az webapp log deployment show`; add `.npmrc` auth via app settings |
| Deploy returns 202 but site shows default page | Async deploy not finished | Wait, or re-run with `--track-status true`; check `az webapp log deployment list` |
| `OperationNotAllowed: ... requires the plan to be Linux` | Plan was created as Windows | Recreate plan with `--is-linux` ([create-app.md](create-app.md)) |
| `Resource group '<rg>' could not be found` | Resource group missing | Check the subscription and resource group; create it in the chosen region if needed ([create-app.md](create-app.md)). |
| `An app with name '<app>' already exists` | Global name collision | Pick a different name |
| `az webapp up` shown in user's notes | Deprecated command | Replace with `az webapp create` + `az webapp deploy --type zip` |
| `azd up` provisions Container Apps instead of App Service | azure.yaml host isn't `appservice` | Fix the template's `host:` or fall back to az CLI path |
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
| Full log download | `az webapp log download -n <app> -g <rg>` |

## When to hand off to `azure-prepare`

Hand off (and stop) if the user needs:

- VNet integration, private endpoints, or Front Door
- Key Vault references for app settings
- A database (Cosmos DB, PostgreSQL, MySQL, SQL)
- Multiple environments with Bicep/Terraform-managed infra
- A non-App-Service target (Container Apps, Functions, Static Web Apps, AKS)

Tell the user clearly: *"This deployment goes beyond a code push — `azure-prepare` will build the full infrastructure plan."*
