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
| Azure SQL | `provisioningState` + `az sql db show` |
| Cosmos DB | `provisioningState` |
| Storage | `provisioningState` + `statusOfPrimary` |
| Key Vault | `provisioningState` |
| Functions | HTTP trigger URL + HTTP check |

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
