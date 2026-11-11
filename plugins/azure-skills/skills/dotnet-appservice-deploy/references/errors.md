# Troubleshooting

Use diagnostics when deployment fails or the user later asks to troubleshoot. Do not add post-deploy probes to a successful deployment.

## Quick diagnosis flow

```
Deploy failed?
  ├─ Check `az webapp log tail` first
  ├─ Then `az webapp log deployment list` for build-time errors
  ├─ Then `az webapp config show` to verify runtime + startup
  └─ For `Connection reset` / `429` / `502-504` on create commands,
      see [transient-retry.md](transient-retry.md)
```

## Symptom → Cause → Fix

| Symptom | Likely cause | Fix |
|---|---|---|
| `NETSDK1045`, SDK not found, `global.json` resolution failure | Required SDK absent in Oryx/local azd environment | Check `TargetFramework`, SDK pin and supported versions. Install a matching local SDK for azd or explain remote SDK limitations. Never silently retarget/remove `global.json`. |
| No project detected / default page | ZIP has an enclosing directory, missing source, wrong `PROJECT`, or remote build disabled | Put source/config at ZIP root, set `PROJECT` relative to it, enable `SCM_DO_BUILD_DURING_DEPLOYMENT`, redeploy. |
| Wrong site deployed | Multiple web projects / stale `PROJECT` | Select the intended web project explicitly; see [detect.md](detect.md). |
| Referenced project or props not found | ZIP contains only web folder or paths have wrong case | Include sibling references, `Directory.Build.*`, package props/config; preserve Linux case. |
| NuGet restore fails (`NU1301`, 401/403) | Inaccessible/private feed or bad package version | Check source configuration and authorized feed access without printing tokens. Never ZIP credentials. |
| `You must install or update .NET` / missing `Microsoft.AspNetCore.App` | Runtime does not match app target | Discover matching runtimes with [create-app.md](create-app.md); do not simply choose the newest. |
| `BadImageFormatException`, native library load failure | Windows-only/native local output | Exclude all `bin/`/`obj/`; remote build for Linux. Windows-only apps go to `azure-prepare`. |
| Container fails startup / ping timeout | Hard-coded localhost/port or wrong DLL startup override | Use automatic startup and platform binding; see [startup-commands.md](startup-commands.md). |
| `/bin/bash^M` / script not found despite existing file | CRLF in Linux script | Normalize and verify LF, create a fresh ZIP, redeploy. |
| Read-only files / remote build not taking effect | `WEBSITE_RUN_FROM_PACKAGE` conflicts with source build | Remove that setting for CLI source deploy, enable remote build, redeploy. |
| azd tries to build published DLLs remotely | Stale remote-build setting from CLI deployment | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` for azd's published output. |
| Blazor interactive circuit disconnects | WebSockets/session affinity configuration | Check platform settings; do not deploy the standalone client instead of the server project. |
| Missing JS/CSS | Separate front-end build omitted | Honor project build targets or build assets locally and include `wwwroot/`. |
| HTTP 500 due to configuration | Required production setting missing | Use app settings (`__` for nested Linux keys), never enable public developer exception pages by default. |
| 429/5xx during resource creation | Transient ARM error | Follow [transient-retry.md](transient-retry.md); don't retry authorization/quota/configuration errors. |

## Deployment diagnostics (on failure or user request)

```bash
az webapp log deployment list -n <app> -g <rg> -o table
az webapp log deployment show -n <app> -g <rg> --deployment-id <id>
```

```powershell
az webapp log deployment list -n <app> -g <rg> -o table
az webapp log deployment show -n <app> -g <rg> --deployment-id <id>
```

Report the actual failed stage and preserve enriched CLI diagnostics. A successful upload alone does not establish application health.

## Where logs live

> ⚠️ **Prereq for `az webapp log tail` on a fresh app**: filesystem container logging must be enabled, otherwise the stream stays empty. Run **once** after the app is created:
>
> ```bash
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```
> ```powershell
> az webapp log config -n <app> -g <rg> --docker-container-logging filesystem
> ```
>
> `az webapp log deployment list/show` and `az webapp log download` do **not** require this — they read from a different store.

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
- A non-App-Service target (Container Apps, Functions, AKS)

Tell the user clearly: *"This deployment goes beyond a code push — `azure-prepare` will build the full infrastructure plan."*
