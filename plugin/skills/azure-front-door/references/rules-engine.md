# Rules Engine Configuration

## Overview

The Front Door rules engine processes requests after routing but before forwarding to the origin. Rules can modify request/response headers, rewrite URLs, redirect requests, and override route configurations.

## Rule Set Structure

```
Route → Rule Set 1 → Rule Set 2 → Origin Group
         │               │
         ├── Rule 1      ├── Rule 1
         ├── Rule 2      └── Rule 2
         └── Rule 3
```

- Multiple rule sets can be associated with a single route
- Rule sets execute in order of association
- Rules within a set execute in order (by `order` number)
- Lower order number = evaluated first

## Rule Components

### Match Conditions

| Condition | Matches On | Operators |
|-----------|-----------|-----------|
| RequestScheme | HTTP or HTTPS | Equal |
| RequestMethod | GET, POST, PUT, DELETE, etc. | Equal |
| RequestUri | Full URI | Contains, BeginsWith, EndsWith, RegEx, Equal |
| RequestPath | URL path only | Contains, BeginsWith, EndsWith, RegEx, Equal |
| RequestHeader | Specific header value | Contains, BeginsWith, EndsWith, RegEx, Equal, Any |
| QueryString | Query string parameters | Contains, BeginsWith, EndsWith, RegEx, Equal |
| RemoteAddress | Client IP | IPMatch, GeoMatch |
| HostName | Request Host header | Contains, BeginsWith, EndsWith, RegEx, Equal, Any |
| SslProtocol | TLS version | Equal |
| IsDevice | Mobile or Desktop | Equal |
| Cookies | Cookie values | Contains, BeginsWith, EndsWith, RegEx, Equal, Any |
| PostArgs | POST body arguments | Contains, BeginsWith, EndsWith, RegEx, Equal, Any |
| UrlFileExtension | File extension in URL | Contains, BeginsWith, EndsWith, RegEx, Equal |
| UrlFileName | File name in URL | Contains, BeginsWith, EndsWith, RegEx, Equal |
| ServerPort | Port number | Equal |
| SocketAddress | Direct client socket IP | IPMatch, GeoMatch |

### Actions

| Action | Description |
|--------|-------------|
| UrlRedirect | Redirect to a different URL (301, 302, 307, 308) |
| UrlRewrite | Rewrite URL path before sending to origin |
| RouteConfigurationOverride | Override caching, origin group, or forwarding protocol |
| RequestHeader | Add, overwrite, append, or delete request header |
| ResponseHeader | Add, overwrite, append, or delete response header |

## Common Rule Examples

### HTTP to HTTPS Redirect

```bash
az afd rule create \
  --rule-name httpRedirect \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 1 \
  --match-variable RequestScheme \
  --operator Equal \
  --match-values HTTP \
  --action-name UrlRedirect \
  --redirect-type Moved \
  --redirect-protocol Https
```

### URL Rewrite (API Versioning)

Rewrite `/api/v1/*` to `/api/v2/*` at the origin:

```bash
az afd rule create \
  --rule-name apiVersionRewrite \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 2 \
  --match-variable RequestPath \
  --operator BeginsWith \
  --match-values "/api/v1/" \
  --action-name UrlRewrite \
  --source-pattern "/api/v1/" \
  --destination "/api/v2/"
```

### Add Security Headers

```bash
az afd rule create \
  --rule-name securityHeaders \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 3 \
  --match-variable RequestMethod \
  --operator Equal \
  --match-values GET POST \
  --action-name ResponseHeader \
  --header-action Overwrite \
  --header-name "X-Content-Type-Options" \
  --header-value "nosniff"
```

### Geo-Based Redirect

Redirect users from specific countries to a localized site:

```bash
az afd rule create \
  --rule-name geoRedirect \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 4 \
  --match-variable RemoteAddress \
  --operator GeoMatch \
  --match-values "DE" "AT" "CH" \
  --action-name UrlRedirect \
  --redirect-type Found \
  --redirect-protocol Https \
  --custom-host "de.contoso.com"
```

### Cache Override for Dynamic Content

```bash
az afd rule create \
  --rule-name noCacheApi \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 5 \
  --match-variable RequestPath \
  --operator BeginsWith \
  --match-values "/api/" \
  --action-name RouteConfigurationOverride \
  --enable-caching false
```

### Mobile Device Redirect

```bash
az afd rule create \
  --rule-name mobileRedirect \
  --rule-set-name myRuleSet \
  --profile-name myFD -g myRG \
  --order 6 \
  --match-variable IsDevice \
  --operator Equal \
  --match-values "Mobile" \
  --action-name UrlRedirect \
  --redirect-type Found \
  --redirect-protocol MatchRequest \
  --custom-host "m.contoso.com"
```

## Associating Rule Sets with Routes

```bash
# Associate rule set with an existing route
az afd route update \
  --route-name myRoute \
  --endpoint-name myEndpoint \
  --profile-name myFD -g myRG \
  --rule-sets myRuleSet1 myRuleSet2
```

Rule sets execute in the order listed. First rule set processes first.

## Limits

| Resource | Standard | Premium |
|----------|----------|---------|
| Rule sets per profile | 25 | 50 |
| Rules per rule set | 25 | 25 |
| Match conditions per rule | 10 | 10 |
| Actions per rule | 5 | 5 |
| Rule sets per route | 2 | 2 |

## Troubleshooting Rules

| Issue | Check |
|-------|-------|
| Rule not firing | Verify match conditions (case sensitivity, operator) |
| Wrong redirect | Check redirect-type and redirect-protocol settings |
| Rules not in order | Verify `order` numbers; lower = first |
| Rewrite not working | Source pattern must match the incoming URL path |
| Headers not appearing | Check action type (Overwrite vs Append vs Delete) |

## Source Documentation

- [Rules engine overview](https://learn.microsoft.com/azure/frontdoor/front-door-rules-engine)
- [Match conditions](https://learn.microsoft.com/azure/frontdoor/rules-match-conditions)
- [Actions](https://learn.microsoft.com/azure/frontdoor/front-door-rules-engine-actions)
- [Rule set configuration](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-configure-rule-set)
