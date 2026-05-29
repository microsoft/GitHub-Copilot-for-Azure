# WAF Custom Rules

Custom rules let you define your own match conditions and actions to handle scenarios that managed rule sets do not cover. Custom rules are evaluated **before** managed rules and follow a priority-based order.

## Custom Rule Evaluation Order

```
Incoming request
  │
  ▼
Custom Rules (by priority, lowest first)
  │ Match → Execute action (Allow, Block, Log, Redirect)
  │ No match → continue to next custom rule
  ▼
Managed Rules (OWASP CRS / Microsoft DRS)
  │
  ▼
Default action (allow if no rule matched)
```

If a custom rule with an **Allow** action matches, the request bypasses all subsequent custom rules and managed rules.

## Custom Rule Structure

| Field | Description | Required |
|-------|-------------|----------|
| Name | Unique rule name (alphanumeric, hyphens, underscores) | Yes |
| Priority | Processing order (1–100); lower = processed first | Yes |
| Rule type | `MatchRule` or `RateLimitRule` | Yes |
| Match conditions | One or more conditions that must ALL be true (AND logic) | Yes |
| Action | `Allow`, `Block`, `Log`, `Redirect` (platform-dependent) | Yes |

## Match Conditions

Each match condition specifies a request attribute to inspect, an operator, and match values.

### Match variables

| Variable | Description | Example use |
|----------|-------------|-------------|
| `RemoteAddr` | Client IP address | IP-based allow/block lists |
| `RequestMethod` | HTTP method | Block PUT/DELETE on production |
| `RequestUri` | Full request URI | Block specific URL patterns |
| `RequestHeaders` | HTTP request headers (specify header name) | Match on User-Agent, Referer |
| `RequestBody` | Request body content | Match body patterns |
| `RequestCookies` | Cookie values (specify cookie name) | Inspect session cookies |
| `QueryString` | Query string content | Block injection in query params |
| `PostArgs` | POST body parameters (specify param name) | Inspect form fields |
| `SocketAddr` | Source socket IP (the direct connection IP, may differ from RemoteAddr behind a proxy) | Front Door-specific |

### Operators

| Operator | Description |
|----------|-------------|
| `IPMatch` | IP address or CIDR range match |
| `GeoMatch` | Country/region code match (ISO 3166-1 alpha-2) |
| `Equal` | Exact string match |
| `Contains` | Substring match |
| `BeginsWith` | String prefix match |
| `EndsWith` | String suffix match |
| `Regex` | Regular expression match |
| `LessThan` | Numeric comparison |
| `GreaterThan` | Numeric comparison |
| `LessThanOrEqual` | Numeric comparison |
| `GreaterThanOrEqual` | Numeric comparison |
| `Any` | Always matches (use with negation) |

### Transforms

Apply transforms to the match variable before evaluation:

| Transform | Description |
|-----------|-------------|
| `Lowercase` | Convert to lowercase |
| `Uppercase` | Convert to uppercase |
| `Trim` | Remove leading/trailing whitespace |
| `UrlDecode` | URL-decode the value |
| `UrlEncode` | URL-encode the value |
| `RemoveNulls` | Remove null bytes |
| `HtmlEntityDecode` | Decode HTML entities |

## Common Custom Rule Patterns

### 1. IP-based Allow List (allow only known IPs)

```bash
# Application Gateway WAF
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "AllowKnownIPs" \
  --priority 5 \
  --action Allow \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "AllowKnownIPs" \
  --match-variables RemoteAddr \
  --operator IPMatch \
  --values "198.51.100.0/24" "203.0.113.10"
```

### 2. IP-based Block List

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadIPs" \
  --priority 10 \
  --action Block \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadIPs" \
  --match-variables RemoteAddr \
  --operator IPMatch \
  --values "192.0.2.0/24" "198.51.100.50"
```

### 3. Geo-Filtering (block traffic from specific countries)

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "GeoBlock" \
  --priority 15 \
  --action Block \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "GeoBlock" \
  --match-variables RemoteAddr \
  --operator GeoMatch \
  --values "CN" "RU" "KP"
```

### 4. Block specific User-Agents

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadUA" \
  --priority 20 \
  --action Block \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadUA" \
  --match-variables "RequestHeaders['User-Agent']" \
  --operator Contains \
  --values "sqlmap" "nikto" "nmap" \
  --transforms Lowercase
```

### 5. Block access to admin paths

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockAdminPaths" \
  --priority 25 \
  --action Block \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockAdminPaths" \
  --match-variables RequestUri \
  --operator Contains \
  --values "/admin" "/wp-admin" "/phpmyadmin" \
  --transforms Lowercase
```

## Rate Limiting Rules

Rate limiting rules restrict the number of requests from a source within a time window.

### Application Gateway WAF rate limiting

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitAll" \
  --priority 30 \
  --action Block \
  --rule-type RateLimitRule \
  --rate-limit-threshold 500 \
  --rate-limit-duration FiveMins \
  --group-by-user-session "ClientAddr"
```

### Front Door WAF rate limiting

```bash
az network front-door waf-policy rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitAPI" \
  --priority 10 \
  --action Block \
  --rule-type RateLimitRule \
  --rate-limit-threshold 100 \
  --rate-limit-duration 1
```

### Rate limiting configuration

| Parameter | Application Gateway | Front Door |
|-----------|-------------------|------------|
| Threshold | Requests per window | Requests per window |
| Duration | `OneMin` or `FiveMins` | `1` (1 minute) or `5` (5 minutes) |
| Group by | `ClientAddr`, `GeoLocation`, or `None` | `SocketAddr` by default |
| Scope | Per Application Gateway | Per Front Door edge POP |

### Rate limiting with path scoping

Rate limit only specific endpoints (e.g., login API):

```bash
# Create rate limit rule
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitLogin" \
  --priority 35 \
  --action Block \
  --rule-type RateLimitRule \
  --rate-limit-threshold 20 \
  --rate-limit-duration OneMin \
  --group-by-user-session "ClientAddr"

# Add match condition to scope to /api/login
az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitLogin" \
  --match-variables RequestUri \
  --operator Contains \
  --values "/api/login" \
  --transforms Lowercase
```

## Platform Differences

| Feature | Application Gateway WAF | Front Door WAF |
|---------|------------------------|----------------|
| Actions | Allow, Block, Log | Allow, Block, Log, Redirect |
| Redirect action | Not supported | Redirect to a URL with custom status code |
| Max custom rules | 100 per policy | 100 per policy |
| Rate limit group-by | ClientAddr, GeoLocation, None | SocketAddr |
| Match variables | RemoteAddr, RequestHeaders, RequestUri, etc. | Same + SocketAddr |
| Negation | Supported (`--negate true`) | Supported |

## Best Practices

1. **Use low priority numbers for Allow rules** — allow list rules should have the lowest priority so trusted traffic bypasses all other checks
2. **Combine multiple match conditions** for precision — conditions within a rule are AND'd; for OR logic, create separate rules
3. **Test custom rules in Detection mode first** — verify match behavior before switching to Prevention
4. **Use transforms** (especially `Lowercase`) to prevent case-based evasion
5. **Rate limit login and API endpoints** — these are the most common targets for brute-force and credential-stuffing attacks
6. **Regularly review custom rules** — remove rules for IPs that are no longer relevant; keep the rule set clean
7. **Document each custom rule's purpose** — use descriptive names and maintain an external record of why each rule exists

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Custom rule not matching | Transform not applied; case mismatch | Add `Lowercase` transform |
| Allow rule not bypassing managed rules | Priority too high (higher number) | Set Allow rule to the lowest priority number |
| Rate limit not triggering | Threshold too high or wrong duration | Reduce threshold or adjust duration |
| Geo-filter blocking wrong countries | Country code typo | Verify ISO 3166-1 alpha-2 codes |
| Rule matching too broadly | Match condition too general | Narrow with additional conditions or more specific operators |

## Related

- [waf-modes.md](waf-modes.md) — Testing custom rules in Detection mode
- [exclusions.md](exclusions.md) — Exclusions for managed rules (not custom rules)
- [managed-rules.md](managed-rules.md) — Managed rules evaluated after custom rules
- [Custom rules documentation](https://learn.microsoft.com/azure/web-application-firewall/ag/custom-waf-rules-overview)
