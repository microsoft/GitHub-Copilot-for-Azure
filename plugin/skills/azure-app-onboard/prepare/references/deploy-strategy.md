# Deploy Strategy

Determine how application code will be deployed to Azure based on prereq scan results. The prepare phase writes `deployStrategy` to `prepare-plan.json`; scaffold encodes it in Bicep; deploy executes it.

## Deployment Patterns

Three patterns — select based on `prereq-output.json.components[].buildRequirements`:

> ⛔ **Dockerfile ≠ Container Apps.** A Dockerfile that only serves static files (nginx, httpd, `COPY . /usr/share/nginx/html`) is NOT a backend app. Route static-only Dockerfiles as static sites per `service-mapping.md § Static Dockerfile sites`, not Pattern C.

| Pattern | When | `deployStrategy` needed? |
|---------|------|--------------------------|
| **A: Oryx auto-build** | No native modules, no Dockerfile | Yes — startup command + app settings go in Bicep at scaffold time |
| **B: Startup-install** | Native modules detected (`hasNativeModules: true`) | Yes — startup command + fallback install + app settings in Bicep |
| **C: Container-only** | Has Dockerfile that runs a server process (Express, Flask, uvicorn, etc.) | No — route to Container Apps (Dockerfile IS the deploy strategy) |

**Additional routing:**

| Condition | Action |
|-----------|--------|
| Jib build plugin (Java + `com.google.cloud.tools.jib`) | Container-only via Jib push to ACR — no Dockerfile needed |

---

## Pattern A: Oryx Auto-Build (Default)

**Languages:** Node.js, Python, .NET, Go, Java, PHP, Ruby

Oryx detects the stack from project manifests, installs dependencies, and builds automatically during zip deploy.

**Still write `deployStrategy` to `prepare-plan.json`** — even though Oryx auto-detects, the startup command and app settings MUST be in Bicep at scaffold time (not generated at deploy time). This eliminates 5+ imperative CLI commands during deploy.

```json
"deployStrategy": {
  "codeDeployPattern": "oryx-auto",
  "startupCommand": "cd /home/site/wwwroot && {startCommand}",
  "requiredAppSettings": {
    "SCM_DO_BUILD_DURING_DEPLOYMENT": "true",
    "ENABLE_ORYX_BUILD": "true",
    "ORYX_DISABLE_COMPRESSION": "true"
  },
  "reason": "Standard Oryx build — no native modules, no Dockerfile. Compression disabled to prevent output.tar.zst extraction failures at startup."
}
```

**Startup command by language** (always prefix with `cd /home/site/wwwroot &&`):

| Language | Start command source | Fallback | Startup command |
|----------|---------------------|----------|----------------|
| Node.js | `package.json` → `scripts.start` or `main` field | `index.js` | `cd /home/site/wwwroot && node {entryPoint}` |
| Python (gunicorn) | `Procfile` or `gunicorn` in requirements | `app.py` | `cd /home/site/wwwroot && gunicorn {module}:{app} --bind 0.0.0.0:$PORT` |
| Python (uvicorn) | `Procfile` or `uvicorn` in requirements | `main.py` | `cd /home/site/wwwroot && uvicorn {module}:{app} --host 0.0.0.0 --port $PORT` |
| .NET / Go / Java | Oryx-native | — | Not needed — Oryx handles startup natively |

> ⛔ **Every startup command MUST start with `cd /home/site/wwwroot &&`.** Oryx may run from a staging directory (`/tmp/{hash}/`). Without the `cd`, imports like `from app import create_app` fail with `ModuleNotFoundError`.

Scaffold encodes `startupCommand` → Bicep `appCommandLine`, and `requiredAppSettings` → Bicep `siteConfig.appSettings`. Deploy only does: wait → zip → health check.

---

## Pattern B: Startup-Install (Native Modules)

When native modules are detected, Oryx may fail to compile them. The startup-install pattern provides a two-layer safety net.

### Two-Layer Strategy

1. **Primary — Oryx zip build:** `SCM_DO_BUILD_DURING_DEPLOYMENT=true` + `ENABLE_ORYX_BUILD=true` tells Oryx to run dependency installation during the Kudu-side zip deploy. The Kudu build environment on App Service Linux has `gcc`, `make`, and build tools available, so native compilation CAN succeed here.

2. **Fallback — startup-install command:** `appCommandLine` runs dependency installation on first container boot IF the dependency directory doesn't exist. The existence guard ensures it only runs when needed — subsequent restarts skip it because `/home` is persistent storage.

Both layers are set in Bicep at scaffold time. The startup command is insurance — not the primary mechanism.

> **Why two layers?** `az webapp deploy --type zip` uses the OneDeploy API, which may not trigger Oryx even with `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. The startup command catches this case. If Oryx DID build successfully, the guard skips the redundant install.

### Deploy Strategy Schema

Write to `prepare-plan.json.deployStrategy`:

```json
"deployStrategy": {
  "codeDeployPattern": "startup-install",
  "startupCommand": "cd /home/site/wwwroot && if [ ! -d node_modules ]; then npm install --production; fi && node index.js",
  "requiredAppSettings": {
    "WEBSITES_CONTAINER_START_TIME_LIMIT": "1800",
    "SCM_DO_BUILD_DURING_DEPLOYMENT": "true",
    "ENABLE_ORYX_BUILD": "true",
    "ORYX_DISABLE_COMPRESSION": "true"
  },
  "reason": "Native module (better-sqlite3 via node-gyp) requires server-side npm install."
}
```

Replace `startupCommand` and `reason` with language-specific values from the entry point table below.

### Entry Point Detection & Startup Commands

Same startup commands as Pattern A (see table above), but Node.js adds a dependency guard:

| Language | Startup command (Pattern B only — differs from A) |
|----------|--------------------------------------------------|
| Node.js | `cd /home/site/wwwroot && if [ ! -d node_modules ]; then npm install --production; fi && node {entryPoint}` |
| Python / .NET / Go / Java | Same as Pattern A — no guard needed |

> ⛔ **Inline commands only.** Never generate a `.sh` startup script file — Windows-created files have CRLF line endings that cause `bash` exit code 2 on Linux.

> ⛔ **Python: do NOT use `venv` in startup commands.** App Service Linux provides a Python environment. Virtual environments (`.venv`) may not survive slot swaps or certain restarts.

### SKU Implications

When `hasNativeModules: true` (any language):

| SKU | Viable? | Reason |
|-----|---------|--------|
| F1 (Free) | ❌ No | 60 CPU-min/day quota. Native compilation takes 2-5 min, consuming the entire daily budget. App auto-disables (403 Site Disabled) |
| F1 (Free) with build-time compilation (TypeScript `tsc`, large `npm install` >500KB lockfile) | ❌ No | Same CPU quota issue — build-time compilation exhausts F1 daily budget even without native modules. Default to B1 when prereq detects TypeScript or large lockfiles. |
| F1 (Free) with large dependency tree (Python >10 deps, .NET >20 NuGet, Java WAR) | ❌ No | Oryx compresses deps into `output.tar.zst`. F1 (shared CPU, 1 GB RAM) cannot decompress at cold start — container times out. |
| F1 (Free) with WSGI/ASGI server (gunicorn, uvicorn) | ❌ No | WSGI/ASGI server + Oryx venv decompression + app startup exceeds F1 cold-start budget. |
| B1 (Basic) | ✅ Yes | No CPU quota limit. Native compilation succeeds. ~$13/month |
| S1+ | ✅ Yes | Production tiers |

When `prereq-output.json.buildRequirements.f1Viable == false`, use B1 as minimum SKU. Surface at the approval gate: "⚠️ {f1BlockReason}. F1 not viable — B1 (~$13/mo) minimum required."

### Container Timeout

`WEBSITES_CONTAINER_START_TIME_LIMIT` controls how long Azure waits for the container to start responding.

| Value | Use case |
|-------|----------|
| 230 (default) | Standard apps, no native compilation |
| 1800 (max) | Startup-install — native compilation takes 2-5 min. Python with scipy/scikit-learn can take longer |

Always set to `1800` when `codeDeployPattern == "startup-install"`.

---

## Pattern C: Container-Only

When the component has a Dockerfile with backend logic, route to **Container Apps**. The Dockerfile IS the deploy strategy — no `deployStrategy` needed in `prepare-plan.json`.

The deploy phase handles: ACR build → image push → Bicep redeploy with real image. See [code-deployment-container-apps.md](../../deploy/references/code-deployment-container-apps.md).

For Java apps using Jib (`build.gradle` + `com.google.cloud.tools.jib`), the build produces a container image without a Dockerfile — push to ACR via `jib` task.

## References

- [Troubleshooting Node.js deployments on App Service Linux](https://azureossd.github.io/2023/02/09/troubleshooting-nodejs-deployments-on-appservice-linux/) — `SCM_DO_BUILD_DURING_DEPLOYMENT`, `ENABLE_ORYX_BUILD`, Oryx build pipeline, native module compilation
- [az webapp deploy](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip) — official deploy command reference (OneDeploy API)
- [WEBSITE_RUN_FROM_PACKAGE](https://learn.microsoft.com/en-us/azure/app-service/deploy-run-package) — alternative deploy pattern (not compatible with startup-install)
- [WEBSITES_CONTAINER_START_TIME_LIMIT](https://github.com/Azure/app-service-linux-docs/issues/253) — max value is 1800 seconds
