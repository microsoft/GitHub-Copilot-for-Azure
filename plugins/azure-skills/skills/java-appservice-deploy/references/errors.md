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
| `invalid target release`, `UnsupportedClassVersionError` | Local JDK or App Service runtime older than the project's Java release | Install a matching local JDK; choose the matching `javaNN` runtime via [create-app.md](create-app.md). Never lower the release silently. |
| `JAVA_HOME is not defined correctly` | Stale/missing local `JAVA_HOME` | Point `JAVA_HOME` at an installed JDK for the build shell only; report it. |
| Build/test failure | Compile errors or tests needing external services | Report; ask before skipping tests. Never deploy an older artifact. |
| `no main manifest attribute` / app exits immediately | Deployed plain or `.original` JAR | Deploy the executable (Spring Boot repackaged / uber) JAR; see [detect.md](detect.md). |
| Container didn't respond to HTTP pings on port 80 | Hard-coded port or `localhost` binding; slow startup | Bind to `PORT`/`SERVER_PORT` on all interfaces; see [startup-commands.md](startup-commands.md). For slow JVM start, set `WEBSITES_CONTAINER_START_TIME_LIMIT` (seconds, max 1800). |
| 404 on Tomcat/JBoss for every path | `javax.*` app on Tomcat 10+/EAP 8, or `jakarta.*` on Tomcat 9/EAP 7 | Pick the server generation matching the imports. |
| 404 at root, works under `/<name>` | Non-OneDeploy upload (FTP/WarDeploy) or EAR context root | Use `az webapp deploy --type war`; set EAR `<context-root>/</context-root>`. |
| Wrong JAR deployed | Multiple artifacts in `target/` | Clean build, select one per [detect.md](detect.md). |
| `OutOfMemoryError`, restarts | Heap too large/small for plan | Tune `-Xmx` in `JAVA_OPTS`/`CATALINA_OPTS`; suggest a larger plan if needed. |
| JBoss EAP create fails on SKU | Unsupported pricing tier | Use P0v3 or another supported tier; explain licensing cost. |
| Deploy fails with 409/conflict | Concurrent deployment or `WEBSITE_RUN_FROM_PACKAGE` | Wait for the running deployment; remove `WEBSITE_RUN_FROM_PACKAGE`. |
| `/bin/bash^M` in startup script | CRLF line endings | Normalize to LF, redeploy with `--type startup`. |
| HTTP 500 from configuration | Missing production setting/secret | Use app settings; never print secrets. |
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
