# Deploy Strategy

Determine how application code will be deployed to Azure based on prereq scan results. The prepare phase writes `deployStrategy` to `prepare-plan.json`; scaffold encodes it in Bicep; deploy executes it.

## Deployment Patterns

Three patterns — select based on `prereq-output.json.components[].buildRequirements`:

> ⛔ **Dockerfile ≠ Container Apps.** A Dockerfile that only serves static files (nginx, httpd, `COPY . /usr/share/nginx/html`) is NOT a backend app. Route static-only Dockerfiles as static sites per `service-mapping.md § Static Dockerfile sites`, not Pattern C.

| Pattern | When | `deployStrategy` needed? |
|---------|------|--------------------------|
| **A: Oryx auto-build** | No native modules, no Dockerfile | No — Oryx handles build + deploy automatically |
| **B: Startup-install** | Native modules detected (`hasNativeModules: true`) | Yes — write to `prepare-plan.json.deployStrategy` |
| **C: Container-only** | Has Dockerfile that runs a server process (Express, Flask, uvicorn, etc.) | No — route to Container Apps (Dockerfile IS the deploy strategy) |

**Additional routing:**

| Condition | Action |
|-----------|--------|
| Jib build plugin (Java + `com.google.cloud.tools.jib`) | Container-only via Jib push to ACR — no Dockerfile needed |

---

## Pattern A: Oryx Auto-Build (Default)

**Languages:** Node.js, Python, .NET, Go, Java, PHP, Ruby

No `deployStrategy` needed. Oryx detects the stack from project manifests, installs dependencies, and builds automatically during `az webapp deploy --type zip`. This is the default for all components without native modules.

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
    "ENABLE_ORYX_BUILD": "true"
  },
  "reason": "Native module (better-sqlite3 via node-gyp) requires server-side npm install."
}
```

Replace `startupCommand` and `reason` with language-specific values from the entry point table below.

### Entry Point Detection & Startup Commands

Detect the entry point from project manifests before generating the startup command.

| Language | Entry point source | Fallback | Startup command |
|----------|-------------------|----------|----------------|
| Node.js | `package.json` → `scripts.start` → `main` field | `index.js` | `cd /home/site/wwwroot && if [ ! -d node_modules ]; then npm install --production; fi && node {entryPoint}` |
| Python (gunicorn) | `Procfile` → detect `gunicorn` in `requirements.txt` | `app.py` | `pip install -r requirements.txt && gunicorn {module}:{app} --bind 0.0.0.0:$PORT` |
| Python (uvicorn) | `Procfile` → detect `uvicorn` in `requirements.txt` | `main.py` | `pip install -r requirements.txt && uvicorn {module}:{app} --host 0.0.0.0 --port $PORT` |
| .NET | Oryx-native | — | Not needed — Oryx handles .NET natively |
| Go | Oryx-native | — | Not needed — Oryx handles Go natively |
| Java | Oryx-native | — | Not needed — Oryx handles Java natively |

> ⛔ **Python: do NOT use `venv` in startup commands.** App Service Linux provides a Python environment. Virtual environments (`.venv`) may not survive slot swaps or certain restarts. Use direct `pip install` — this is the standard Oryx-compatible pattern.

> ⛔ **Inline commands only.** Never generate a `.sh` startup script file — Windows-created files have CRLF line endings that cause `bash` exit code 2 on Linux. Use the `appCommandLine` Bicep property directly.

### SKU Implications

When `hasNativeModules: true` (any language):

| SKU | Viable? | Reason |
|-----|---------|--------|
| F1 (Free) | ❌ No | 60 CPU-min/day quota. Native compilation takes 2-5 min, consuming the entire daily budget. App auto-disables (403 Site Disabled) |
| F1 (Free) with build-time compilation (TypeScript `tsc`, large `npm install` >500KB lockfile) | ❌ No | Same CPU quota issue — build-time compilation exhausts F1 daily budget even without native modules. Seen in 5/18 manual runs. Default to B1 when prereq detects TypeScript or large lockfiles. |
| B1 (Basic) | ✅ Yes | No CPU quota limit. Native compilation succeeds. ~$13/month |
| S1+ | ✅ Yes | Production tiers |

Surface at the approval gate: "⚠️ Native modules detected ({signal}). F1 not viable — B1 (~$13/mo) minimum required."

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
