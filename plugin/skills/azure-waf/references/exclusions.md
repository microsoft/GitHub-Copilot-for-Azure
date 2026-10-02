# WAF Exclusion Lists

WAF exclusions allow specific request attributes to bypass managed rule evaluation, eliminating false positives without disabling rules entirely. Exclusions are the preferred approach to handle false positives because they maintain protection for all other traffic.

## Exclusion Types

### Global exclusions
Apply to **all** managed rules. The specified request attribute is not inspected by any managed rule.

### Per-rule exclusions
Apply to a **specific** managed rule or rule group. The request attribute is excluded only from that rule's evaluation — all other rules still inspect it.

**Always prefer per-rule exclusions** — they minimize the security surface exposed by the exclusion.

## Exclusion Match Variables

| Match Variable | Description | Example |
|----------------|-------------|---------|
| `RequestHeaderNames` | HTTP request header name | Exclude `X-Custom-Token` header |
| `RequestCookieNames` | Cookie name | Exclude `session_id` cookie |
| `RequestArgNames` | Query string parameter name | Exclude `search` query parameter |
| `RequestBodyPostArgNames` | POST body parameter name | Exclude `comment_text` form field |
| `RequestBodyJsonArgNames` | JSON body field name | Exclude `data.payload` JSON field |

## Selector Match Operators

| Operator | Behavior | Example |
|----------|----------|---------|
| `Equals` | Exact match on the attribute name | Header name exactly equals `Authorization` |
| `Contains` | Substring match on the attribute name | Any header containing `Token` |
| `StartsWith` | Prefix match on the attribute name | Any cookie starting with `__utm` |
| `EndsWith` | Suffix match on the attribute name | Any parameter ending with `_raw` |
| `EqualsAny` | Matches any attribute of that type | All request headers (use cautiously) |

## Configuring Global Exclusions

### Application Gateway WAF

```bash
# Exclude a specific header from all managed rules
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestHeaderNames \
  --selector-match-operator Equals \
  --selector "X-Custom-Auth"

# Exclude a query parameter from all managed rules
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestArgNames \
  --selector-match-operator Equals \
  --selector "returnUrl"

# Exclude a POST body field from all managed rules
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestBodyPostArgNames \
  --selector-match-operator Equals \
  --selector "article_body"
```

### Front Door WAF

Front Door exclusions are configured similarly but through the WAF policy managed-rule settings. Use the portal or ARM template for per-rule exclusions on Front Door.

## Configuring Per-Rule Exclusions

Per-rule exclusions target a specific rule ID so the excluded attribute is only bypassed for that rule.

### Application Gateway WAF per-rule exclusion

```bash
# Exclude a specific header from rule 942130 only
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestHeaderNames \
  --selector-match-operator Equals \
  --selector "X-Forwarded-Host" \
  --type OWASP \
  --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI \
  --rule-ids 942130
```

### Per-rule-group exclusion

```bash
# Exclude a field from all rules in the SQLI group
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestBodyPostArgNames \
  --selector-match-operator Equals \
  --selector "sql_query_field" \
  --type OWASP \
  --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI
```

## Common False Positive Patterns and Resolutions

### 1. SQL-like content in form fields

**Scenario**: A CMS or admin panel has a text field where users enter content that looks like SQL (e.g., `SELECT * FROM users`).

**Triggering rules**: 942100, 942110, 942130, 942150, 942180, 942200, 942210, 942260, 942340, 942370, 942430

**Resolution**:
```bash
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestBodyPostArgNames \
  --selector-match-operator Equals \
  --selector "content_body" \
  --type OWASP --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI
```

### 2. Rich text / HTML in request body

**Scenario**: A WYSIWYG editor sends HTML content that triggers XSS rules.

**Triggering rules**: 941100, 941110, 941120, 941130, 941140, 941150, 941160, 941170, 941180, 941320

**Resolution**:
```bash
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestBodyPostArgNames \
  --selector-match-operator Equals \
  --selector "editor_content" \
  --type OWASP --version 3.2 \
  --group-name REQUEST-941-APPLICATION-ATTACK-XSS
```

### 3. Encoded tokens in headers

**Scenario**: Custom authentication headers contain Base64 or JWT tokens that match SQLi or XSS patterns.

**Triggering rules**: Various across SQLI and XSS groups

**Resolution**:
```bash
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestHeaderNames \
  --selector-match-operator Equals \
  --selector "Authorization"
```

### 4. File paths in URL parameters

**Scenario**: API accepts file paths as query parameters, triggering LFI rules.

**Triggering rules**: 930100, 930110, 930120, 930130

**Resolution**:
```bash
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestArgNames \
  --selector-match-operator Equals \
  --selector "filePath" \
  --type OWASP --version 3.2 \
  --group-name REQUEST-930-APPLICATION-ATTACK-LFI
```

### 5. API bodies with command-like strings

**Scenario**: DevOps or infrastructure APIs accept command strings that trigger RCE rules.

**Triggering rules**: 932100, 932105, 932106, 932110, 932115, 932150

**Resolution**:
```bash
az network application-gateway waf-policy managed-rule exclusion rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestBodyJsonArgNames \
  --selector-match-operator Equals \
  --selector "command" \
  --type OWASP --version 3.2 \
  --group-name REQUEST-932-APPLICATION-ATTACK-RCE
```

## Diagnosing What to Exclude

### Step 1: Find the triggering rule

Query WAF logs to identify the rule ID and the matched request attribute:

```kusto
AzureDiagnostics
| where Category == "ApplicationGatewayFirewallLog"
| where action_s == "Blocked" or action_s == "Detected"
| project TimeGenerated, ruleId_s, ruleGroup_s, details_message_s, 
          details_data_s, requestUri_s, clientIp_s
| order by TimeGenerated desc
| take 50
```

The `details_message_s` field shows what part of the request matched (e.g., "Matched Data: SELECT found within ARGS:search_query").

### Step 2: Identify the match variable and selector

From the log:
- `ARGS:search_query` → Match variable: `RequestArgNames`, Selector: `search_query`
- `REQUEST_HEADERS:X-Custom-Header` → Match variable: `RequestHeaderNames`, Selector: `X-Custom-Header`
- `REQUEST_BODY` → Match variable: `RequestBodyPostArgNames` or `RequestBodyJsonArgNames`
- `REQUEST_COOKIES:session` → Match variable: `RequestCookieNames`, Selector: `session`

### Step 3: Create the narrowest possible exclusion

1. First try per-rule exclusion (specific rule ID)
2. If multiple rules in the same group trigger, try per-rule-group exclusion
3. Only use global exclusion as a last resort

## Best Practices

1. **Always use per-rule exclusions over global exclusions** — global exclusions remove the attribute from ALL rule evaluation
2. **Use `Equals` operator by default** — `Contains`, `StartsWith`, and `EndsWith` may inadvertently exclude more attributes than intended
3. **Document every exclusion** — record the rule ID, the reason for the exclusion, and the date it was added
4. **Review exclusions quarterly** — applications change; exclusions that were needed may no longer be relevant
5. **Test exclusions in Detection mode** — verify the false positive disappears before switching to Prevention
6. **Never use `EqualsAny`** in production unless absolutely necessary — it excludes all attributes of that type from the rule

## Limits

| Resource | Limit |
|----------|-------|
| Global exclusions per policy | 100 |
| Per-rule exclusions per policy | 100 per rule override |
| Maximum selector length | 256 characters |

## Related

- [waf-modes.md](waf-modes.md) — Using Detection mode to identify false positives
- [managed-rules.md](managed-rules.md) — Rule groups and IDs referenced in exclusions
- [WAF exclusion documentation](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-waf-configuration)
