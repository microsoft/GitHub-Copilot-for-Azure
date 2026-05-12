# Health Check Patterns

Post-deployment health verification for AppOnboard-deployed resources.

## HTTP Endpoints

For each endpoint in deployment outputs:

```
HTTP GET {url} with:
  - Timeout: 30 seconds
  - Retries: 3 attempts
  - Backoff: 10s / 20s / 40s (exponential)
  - Scheme: HTTPS only (never HTTP)
```

| Status | Interpretation |
|--------|---------------|
| 200–299 | `healthy` — **but verify not a placeholder page (see below)** |
| 401/403 | `healthy` (auth working, app running) |
| 5xx after 3 retries | `degraded` |
| Timeout after 3 retries | `unreachable` |
| DNS resolution failure | `unreachable` |

### App Service Default Page Detection

> ⛔ **HTTP 200 does NOT guarantee the app started.** When an App Service app fails to start (runtime error, missing dependency, framework crash), Azure serves its own default landing page with HTTP 200. This is a **false positive** for health checks.

After receiving HTTP 200 from an App Service endpoint, check the response body for Azure placeholder page indicators:

| Body contains | Meaning | Health status |
|---------------|---------|---------------|
| `"Your app service is up and running"` | Azure default page — app did NOT start | `degraded` |
| `"Time to take the next step and deploy your code"` | Azure default page — no code deployed or app failed to start | `degraded` |
| `"Hey, Python developers!"` or `"Hey, Node.js developers!"` | Azure runtime-specific default page — app didn't start | `degraded` |
| `"Error 503"` or `"Application Error"` in body | App crashed on startup | `degraded` |

**Detection procedure:** After HTTP 200, read the first 2KB of the response body. If any of the strings above are found, set `healthStatus: "degraded"` and add a warning: `"App Service default page detected — application did not start. Check logs: az webapp log tail -g {rg} -n {app}"`.

> **Why this matters:** Some frameworks return HTTP 200 with the Azure default page (e.g., "Hey, Python developers!") while the actual app silently fails to start. The health check accepts 200 as healthy, masking the failure.

## Non-HTTP Resources

Verify provisioning state via ARM:

```bash
az resource show \
  --ids {resourceId} \
  --query "properties.provisioningState" -o tsv
```

`Succeeded` → `healthy`. `Failed` → `degraded`. Other → `unknown`.

### Per-Service Checks

| Service | Health Signal |
|---------|---------------|
| Container Apps | `latestReadyRevisionName` not empty + HTTP check on ingress FQDN |
| App Service | HTTP GET on `https://{name}.azurewebsites.net/` + `/health` if exists |
| Azure SQL | `provisioningState: Succeeded` + connectivity test via `az sql db show` |
| Cosmos DB | `provisioningState: Succeeded` (no HTTP endpoint to check) |
| Storage | `provisioningState: Succeeded` + `az storage account show --query statusOfPrimary` |
| Key Vault | `provisioningState: Succeeded` (access validated by app at runtime) |
| Functions | HTTP trigger URL from deployment outputs + HTTP check |

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

> ⛔ **For apps with user seeding or init scripts, verify functional endpoints after health check.**

Health checks only confirm the web server is responding — they do NOT confirm the app is fully functional. For apps with initialization patterns, also test:

| Pattern | Functional Check |
|---------|-----------------|
| `FIRST_SUPERUSER` env var or `prestart.sh`/`init_db()` | After health passes, attempt login endpoint. If 401/500 → startup scripts may have failed. Trigger `az containerapp revision restart` to re-run startup. |
| Migration frameworks (Alembic, Django, Prisma, EF) | After health passes, check `prereq-output.json` for migration signals. If found, run migrations per [database-post-deploy.md](database-post-deploy.md). |
| Two-phase Container Apps with KV secrets | Wait 60s after Phase 2 for RBAC propagation. If login/API fails with auth errors, KV secrets may not have resolved at revision startup. Create a new revision. |
