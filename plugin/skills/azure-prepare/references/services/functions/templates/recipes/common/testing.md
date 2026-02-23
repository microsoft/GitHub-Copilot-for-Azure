# Testing Azure Functions

Common pitfalls and best practices when testing Azure Functions after deployment.

## Route Prefix

> ⚠️ **Critical: Azure Functions use `/api/` prefix by default**

All HTTP-triggered functions have routes prefixed with `/api/` unless explicitly overridden.

| Route Attribute | Actual URL |
|-----------------|------------|
| `Route = "shorten"` | `https://{host}/api/shorten` |
| `Route = "r/{id}"` | `https://{host}/api/r/{id}` |
| `Route = "health"` | `https://{host}/api/health` |

### Option 1: Test with `/api/` prefix (default)

```bash
# Correct - includes /api/
curl https://func-app.azurewebsites.net/api/shorten

# Wrong - missing /api/, returns 404
curl https://func-app.azurewebsites.net/shorten
```

### Option 2: Remove prefix via host.json

Add to `host.json` to remove the `/api/` prefix:

```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  }
}
```

After this change:
- `Route = "shorten"` → `https://{host}/shorten`
- `Route = "r/{id}"` → `https://{host}/r/{id}`

**Recommendation**: Set `routePrefix: ""` for cleaner URLs, especially for URL shorteners and public APIs.

## Cold Start Delays

Flex Consumption and Consumption plans scale to zero when idle. First request after idle triggers a cold start:

| Plan | Typical Cold Start |
|------|-------------------|
| Flex Consumption | 1-5 seconds |
| Consumption (Y1) | 5-15 seconds |
| Premium | ~0 (always warm) |

**Testing strategy:**
```bash
# First request may timeout or be slow
curl --max-time 30 https://func-app.azurewebsites.net/api/health

# Subsequent requests are fast
curl https://func-app.azurewebsites.net/api/health
```

## RBAC Propagation Delays

Azure RBAC role assignments take 30-60 seconds to propagate. Functions accessing Azure resources (Storage, Cosmos DB, Event Hubs) may fail with 401/403 immediately after deployment.

**Two-phase deployment strategy:**
```bash
# Phase 1: Provision infrastructure + RBAC
azd provision --no-prompt

# Wait for RBAC propagation
sleep 60

# Phase 2: Deploy code
azd deploy --no-prompt
```

**Symptoms of RBAC not propagated:**
- 401 Unauthorized
- 403 Forbidden
- "AuthorizationPermissionMismatch" errors
- Storage or Cosmos operations failing silently

## Testing Checklist

Before reporting a function as broken, verify:

- [ ] **Route**: Using correct URL with or without `/api/` prefix
- [ ] **Cold start**: Waited for first request to complete (up to 30s)
- [ ] **RBAC**: Waited 60s after provision for role assignments to propagate
- [ ] **App settings**: Verified settings are deployed (`az functionapp config appsettings list`)
- [ ] **Logs**: Checked Application Insights for actual errors

## Sample Test Script

```bash
#!/bin/bash
FUNC_URL="https://func-app.azurewebsites.net"

echo "Testing health endpoint..."
curl -s --max-time 30 "$FUNC_URL/api/health" || echo "Cold start - retrying..."
sleep 5
curl -s "$FUNC_URL/api/health"

echo -e "\nTesting create endpoint..."
RESULT=$(curl -s -X POST "$FUNC_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}')
echo "$RESULT"

SHORT_CODE=$(echo "$RESULT" | jq -r '.shortCode')
echo -e "\nTesting redirect for $SHORT_CODE..."
curl -i "$FUNC_URL/api/r/$SHORT_CODE"
```

## Common Errors

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| 404 Not Found | Wrong route (missing `/api/`) | Check route prefix |
| 401 Unauthorized | RBAC not propagated | Wait 60s, check role assignments |
| 403 Forbidden | Missing RBAC role | Verify role assignment exists |
| 500 Internal Error | App setting missing | Check app configuration |
| Empty response | Function crashed | Check Application Insights logs |
