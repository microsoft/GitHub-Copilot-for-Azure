# URL-Based Routing, Multi-Site, Redirects, and Rewrites

## Path-Based Routing

Path-based routing sends requests to different backend pools based on the URL path.

### Architecture Example

```
Client → App Gateway Listener (:443)
    │
    URL Path Map
    ├── /api/*        → API Backend Pool (port 8080)
    ├── /images/*     → Blob Storage Backend (port 443)
    ├── /admin/*      → Admin Backend Pool (port 443)
    └── /* (default)  → Web Frontend Pool (port 80)
```

### Configuration

```bash
# Create URL path map with rules
az network application-gateway url-path-map create \
  --gateway-name myAppGw -g myRG \
  --name myPathMap \
  --default-address-pool webPool \
  --default-http-settings defaultSettings \
  --paths "/api/*" \
  --address-pool apiPool \
  --http-settings apiSettings \
  --rule-name apiRule

# Add additional path rules
az network application-gateway url-path-map rule create \
  --gateway-name myAppGw -g myRG \
  --path-map-name myPathMap \
  --name imagesRule \
  --paths "/images/*" "/static/*" \
  --address-pool staticPool \
  --http-settings staticSettings

az network application-gateway url-path-map rule create \
  --gateway-name myAppGw -g myRG \
  --path-map-name myPathMap \
  --name adminRule \
  --paths "/admin/*" \
  --address-pool adminPool \
  --http-settings adminSettings
```

### Path Matching Rules

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `/api/*` | `/api/users`, `/api/v1/data` | `/API/users` (case-sensitive) |
| `/images/*.jpg` | `/images/logo.jpg` | `/images/logo.png` |
| `/` | Exact root path | `/anything-else` |
| `/*` (default) | Everything not matched by other rules | — |

**Important**: Path matching is **case-sensitive** and evaluated in order. The first match wins. The default rule (`/*`) catches everything not matched.

## Multi-Site Hosting

Host multiple websites on a single Application Gateway using hostname-based listeners.

### Configuration

```bash
# Listener for site 1
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name contoso-listener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port443 \
  --ssl-cert contoso-cert \
  --host-name "www.contoso.com"

# Listener for site 2
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name fabrikam-listener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port443 \
  --ssl-cert fabrikam-cert \
  --host-name "www.fabrikam.com"

# Routing rule for each site
az network application-gateway rule create \
  --gateway-name myAppGw -g myRG \
  --name contoso-rule --priority 100 \
  --rule-type Basic \
  --http-listener contoso-listener \
  --address-pool contosoPool \
  --http-settings contosoSettings

az network application-gateway rule create \
  --gateway-name myAppGw -g myRG \
  --name fabrikam-rule --priority 200 \
  --rule-type Basic \
  --http-listener fabrikam-listener \
  --address-pool fabrikamPool \
  --http-settings fabrikamSettings
```

### Wildcard Hostnames

v2 supports wildcard hostnames in listeners:

| Pattern | Matches |
|---------|---------|
| `*.contoso.com` | `www.contoso.com`, `api.contoso.com` |
| `*.contoso.*` | Not supported (only leading wildcard) |

## Redirect Configurations

### HTTP to HTTPS Redirect

```bash
# Create HTTPS listener first
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name httpsListener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port443 \
  --ssl-cert myCert

# Create redirect config
az network application-gateway redirect-config create \
  --gateway-name myAppGw -g myRG \
  --name httpToHttps \
  --type Permanent \
  --target-listener httpsListener \
  --include-path true \
  --include-query-string true

# Create HTTP listener and rule that uses the redirect
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name httpListener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port80

az network application-gateway rule create \
  --gateway-name myAppGw -g myRG \
  --name redirectRule --priority 50 \
  --rule-type Basic \
  --http-listener httpListener \
  --redirect-config httpToHttps
```

### Redirect Types

| Type | HTTP Code | Use Case |
|------|-----------|----------|
| Permanent | 301 | HTTP → HTTPS (cached by browsers) |
| Found | 302 | Temporary redirect |
| SeeOther | 303 | POST → GET redirect |
| Temporary | 307 | Temporary, preserves HTTP method |

### External URL Redirect

```bash
az network application-gateway redirect-config create \
  --gateway-name myAppGw -g myRG \
  --name externalRedirect \
  --type Permanent \
  --target-url "https://www.newsite.com" \
  --include-path true \
  --include-query-string true
```

## Rewrite Rules

Rewrite rules modify HTTP request and response headers or URL components.

### Common Rewrite Scenarios

| Scenario | Action |
|----------|--------|
| Add security headers | Add `X-Frame-Options`, `Strict-Transport-Security` to response |
| Strip server headers | Remove `Server`, `X-Powered-By` from response |
| Modify URL path | Rewrite `/old-api/v1/*` to `/api/v2/*` |
| Add correlation header | Add `X-Request-ID` from `{var_request_uri}` |
| Override host header | Set `Host` header for backend routing |

### Create Rewrite Rule Set

```bash
# Create rule set
az network application-gateway rewrite-rule set create \
  --gateway-name myAppGw -g myRG \
  --name securityHeaders

# Add rule: Security response headers
az network application-gateway rewrite-rule create \
  --gateway-name myAppGw -g myRG \
  --rule-set-name securityHeaders \
  --name addSecurityHeaders \
  --response-headers "X-Frame-Options=SAMEORIGIN" "Strict-Transport-Security=max-age=31536000; includeSubDomains" "X-Content-Type-Options=nosniff"

# Add rule: Remove server identification headers
az network application-gateway rewrite-rule create \
  --gateway-name myAppGw -g myRG \
  --rule-set-name securityHeaders \
  --name removeServerHeaders \
  --response-headers "Server=" "X-Powered-By="

# Associate rewrite rule set with routing rule
az network application-gateway rule update \
  --gateway-name myAppGw -g myRG \
  --name myRule \
  --rewrite-rule-set securityHeaders
```

### Server Variables for Conditions

| Variable | Description |
|----------|-------------|
| `{var_host}` | Host header value |
| `{var_request_uri}` | Full request URI |
| `{var_uri_path}` | URI path only |
| `{var_query_string}` | Query string |
| `{var_client_ip}` | Client IP address |
| `{var_server_port}` | Server port |
| `{http_req_headerName}` | Request header value |
| `{http_resp_headerName}` | Response header value |

## Source Documentation

- [URL path-based routing](https://learn.microsoft.com/azure/application-gateway/url-route-overview)
- [Multi-site hosting](https://learn.microsoft.com/azure/application-gateway/multiple-site-overview)
- [Redirect overview](https://learn.microsoft.com/azure/application-gateway/redirect-overview)
- [Rewrite HTTP headers and URL](https://learn.microsoft.com/azure/application-gateway/rewrite-http-headers-url)
