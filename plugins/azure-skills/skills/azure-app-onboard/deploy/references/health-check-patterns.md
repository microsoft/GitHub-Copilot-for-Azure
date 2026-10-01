# Health Check Patterns

Post-deployment health verification for AppOnboard-deployed resources.

## HTTP Endpoints

For each endpoint: HTTPS GET, 30s timeout, 3 retries (10s/20s/40s backoff).

| Status | Health | Note |
|--------|--------|------|
| 2xx | `healthy` | **Verify not a placeholder page (see below)** |
| 401/403 | `healthy` | Auth working, app running |
| 5xx ×3 | `degraded` | |
| Timeout/DNS ×3 | `unreachable` | |

> ⛔ **DB-backed OR auth/session apps: a 200 on `/` is NOT healthy.** When `prepare-plan.json.services[]` includes a database, OR prereq detected auth/session middleware (e.g. `express-session`, `passport`, Flask-Login, Django sessions), probing only `/` just proves the web server booted. Probe at least one **data-backed or authenticated route** (derive from the app's detected routes, e.g. a REST resource path) and inspect the body for DB errors (`insecure transport`, `Access denied`, `connection refused`, `Unknown database`, `doesn't exist`). For session apps, verify the session cookie round-trips: a request that sets a cookie followed by an authenticated call must NOT return `401`/`Not authenticated` — that signals a dropped session cookie (missing `trust proxy` behind Azure's TLS-terminating LB). Any of these → mark `degraded`, not `healthy`.

### HTTP Redirect Handling (Container Apps)

> ⛔ **ACA health probes do NOT follow HTTP redirects.** A 301/302 response from the probe path causes `ActivationFailed` — the probe treats it as a failure, not a redirect.

If the first health check returns **301 or 302**:
1. Read the `Location` header: `curl -sI "https://{fqdn}{probePath}" | Select-String "^location:" -CaseSensitive:$false`
2. Update `probePath` in Bicep to the redirect target (e.g., `/wetty/` → `/wetty`)
3. Redeploy: `az deployment sub create` with updated Bicep
4. Re-check health after new revision activates

Common redirect patterns: Express trailing-slash normalization (`/app/` → `/app`), framework-level path canonicalization, HTTPS redirects on mixed-content paths.

### App Service Default Page Detection

> ⛔ **HTTP 200 ≠ app started.** Azure serves its own default page with 200 when the app fails to start — false positive.

After HTTP 200 from App Service, check first 2KB of body:

| Body contains | Meaning |
|---------------|--------|
| `"Your app service is up and running"` | Default page — app didn't start |
| `"Time to take the next step and deploy your code"` | Default page — no code or app failed |
| `"Hey, Python developers!"` / `"Hey, Node.js developers!"` | Runtime default — app didn't start |
| `"Error 503"` / `"Application Error"` | App crashed on startup |

If detected → `healthStatus: "degraded"` + warning: `"App Service default page detected — check logs: az webapp log tail -g {rg} -n {app}"`.

## Non-HTTP Resources

```bash
az resource show --ids {resourceId} --query "properties.provisioningState" -o tsv
```

`Succeeded` → `healthy`. `Failed` → `degraded`. Other → `unknown`.

| Service | Health Signal |
|---------|---------------|
| Container Apps | `latestReadyRevisionName` not empty + HTTP on ingress FQDN |
| App Service | HTTP GET `https://{name}.azurewebsites.net/` + `/health` |
| Static Web Apps | HTTP GET `https://{defaultHostname}/` → 2xx = `healthy` (hostname: `az staticwebapp show -n {swa} -g {rg} --query defaultHostname -o tsv`) |
| Azure SQL | `provisioningState` + `az sql db show` |
| Cosmos DB | `provisioningState` |
| Storage | `provisioningState` + `statusOfPrimary` |
| Key Vault | `provisioningState` |
| Functions | HTTP trigger URL + HTTP check |

> ⛔ **Container Apps — run an explicit live HTTP probe (the pipeline status is NOT sufficient).** After `latestReadyRevisionName` is set, run an observable request against the ingress FQDN and capture the result into `deploy-result.json.endpoints[].healthStatus`:
> ```powershell
> iwr "https://{ingressFqdn}/{probePath}" -UseBasicParsing   # PowerShell
> curl -sSfL "https://{ingressFqdn}/{probePath}"             # bash
> ```
> This live HTTP call against `*.azurecontainerapps.io` IS the health verification — do NOT infer health from the revision's internal status alone.

## Output

Write to `deploy-result.json.endpoints[]`:

```jsonc
{
  "name": "api",
  "url": "https://myapp-ca-dev-a1b2.azurecontainerapps.io",
  "healthStatus": "healthy"  // healthy | degraded | unreachable | unknown
}
```

Overall `healthStatus` = worst status across all endpoints. If any `unreachable` → overall `unreachable`.

## Functional Endpoint Verification

> ⛔ **A 200 on `/` only proves the web server booted — not that the app works.** After the HTTP check, confirm the app actually functions against the services the plan provisioned (database, cache, KV secrets), not just that it responds.

Health checks only confirm the web server is responding. Exercise a route that depends on the backing services — for example:

| Pattern | Functional Check |
|---------|-----------------|
| Database in the plan (MySQL/PostgreSQL/SQL/Cosmos) | Probe a route that reads/writes the DB (a detected app route, NOT `/` — root often serves a static page with no DB access, so 200 on `/` masks broken DB connectivity). A 5xx or a DB error in the body (`Access denied`, `connection refused`, `does not exist`) → `degraded` — usually a KV↔DB credential mismatch or an unseeded secret. |
| `FIRST_SUPERUSER` env var or `prestart.sh`/`init_db()` | After health passes, attempt login endpoint. If 401/500 → startup scripts may have failed. Trigger `az containerapp revision restart` to re-run startup. |
| Migration frameworks (Alembic, Django, Prisma, EF) | After health passes, check `prereq-output.json` for migration signals. If found, run migrations per [database-post-deploy.md](database-post-deploy.md). |
| Two-phase Container Apps with KV secrets | Wait 60s after Phase 2 for RBAC propagation. If login/API fails with auth errors, KV secrets may not have resolved at revision startup. Create a new revision. |
