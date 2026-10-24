# WAF v2 Integration on Application Gateway

## Overview

Web Application Firewall (WAF) v2 runs as a tier of Application Gateway (WAF_v2 SKU), providing protection against common web exploits and vulnerabilities using OWASP Core Rule Set (CRS) and Microsoft-managed bot protection rules.

## Enabling WAF

### New Application Gateway with WAF

```bash
# Create WAF policy
az network application-gateway waf-policy create \
  --name myWafPolicy -g myRG

# Create Application Gateway with WAF_v2 SKU
az network application-gateway create \
  --name myWafAppGw -g myRG \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name myVNet \
  --subnet AppGwSubnet \
  --public-ip-address wafPIP \
  --waf-policy myWafPolicy
```

### Add WAF to Existing Application Gateway

You cannot change SKU from Standard_v2 to WAF_v2 in-place. Options:
1. **Create new** WAF_v2 gateway and migrate configuration
2. **Associate WAF policy** with per-listener scope on Standard_v2 (limited)

For full WAF capabilities, deploy as WAF_v2 from the start.

## WAF Modes

| Mode | Behavior | When to Use |
|------|----------|-------------|
| Detection | Logs rule matches but does NOT block requests | Initial deployment, tuning phase |
| Prevention | Blocks requests matching rules, returns 403 | Production after tuning is complete |

```bash
# Set to Detection mode (for tuning)
az network application-gateway waf-policy policy-setting update \
  --policy-name myWafPolicy -g myRG \
  --mode Detection \
  --state Enabled

# Switch to Prevention mode (production)
az network application-gateway waf-policy policy-setting update \
  --policy-name myWafPolicy -g myRG \
  --mode Prevention \
  --state Enabled
```

## Managed Rule Sets

### OWASP Core Rule Set (CRS)

| Version | Status | Recommendation |
|---------|--------|----------------|
| CRS 3.2 | Current | ✅ Recommended for most deployments |
| CRS 3.1 | Supported | Stable, well-tested |
| CRS 3.0 | Supported | Legacy |
| CRS 2.2.9 | Deprecated | ❌ Migrate |

```bash
# Configure CRS 3.2
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name myWafPolicy -g myRG \
  --type OWASP \
  --version 3.2
```

### CRS Rule Groups

| Group | Protects Against |
|-------|-----------------|
| SQL Injection (sqli) | SQL injection attacks |
| Cross-Site Scripting (xss) | XSS attacks |
| Local File Inclusion (lfi) | File traversal attacks |
| Remote File Inclusion (rfi) | Remote file inclusion |
| Remote Code Execution (rce) | Command injection |
| Protocol Enforcement | HTTP protocol violations |
| Protocol Attack | Request smuggling, splitting |
| Session Fixation | Session hijacking |
| Scanner Detection | Vulnerability scanner fingerprints |
| General | General security rules |

### Bot Manager Rule Set

```bash
# Add bot manager rules
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name myWafPolicy -g myRG \
  --type Microsoft_BotManagerRuleSet \
  --version 1.0
```

## Custom Rules

Custom rules are evaluated BEFORE managed rules with higher priority.

### Rule Components

| Component | Options |
|-----------|---------|
| Priority | 1-100 (lower = evaluated first) |
| Rule type | MatchRule, RateLimitRule |
| Match conditions | IP address, geo, request body, headers, URI, query string |
| Action | Allow, Block, Log, AnomalyScoring |
| Operators | IPMatch, GeoMatch, Equal, Contains, BeginsWith, Regex, etc. |

### Example: Block by IP

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name myWafPolicy -g myRG \
  --name blockBadIP \
  --priority 10 \
  --rule-type MatchRule \
  --action Block \
  --match-condition \
    match-variable=RemoteAddr \
    operator=IPMatch \
    values="203.0.113.0/24" "198.51.100.50"
```

### Example: Geo-Block

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name myWafPolicy -g myRG \
  --name geoBlock \
  --priority 20 \
  --rule-type MatchRule \
  --action Block \
  --match-condition \
    match-variable=RemoteAddr \
    operator=GeoMatch \
    values="CN" "RU"
```

### Example: Rate Limiting

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name myWafPolicy -g myRG \
  --name rateLimit \
  --priority 30 \
  --rule-type RateLimitRule \
  --action Block \
  --rate-limit-threshold 100 \
  --rate-limit-duration FiveMins \
  --group-by-user-session "client_addr" \
  --match-condition \
    match-variable=RequestUri \
    operator=Contains \
    values="/api/"
```

## Exclusions

When managed rules produce false positives, add exclusions instead of disabling entire rule groups.

### Exclusion Scopes

| Scope | Description |
|-------|-------------|
| Request header name | Exclude a specific header from inspection |
| Request cookie name | Exclude a specific cookie |
| Request body post arg | Exclude a form field |
| Request body JSON arg | Exclude a JSON property |

```bash
# Exclude a specific field from a specific rule
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name myWafPolicy -g myRG \
  --match-variable RequestBodyPostArgsNames \
  --selector-match-operator Equals \
  --selector "description" \
  --exclusion-rule-set-type OWASP \
  --exclusion-rule-set-version 3.2 \
  --exclusion-rule-group REQUEST-942-APPLICATION-ATTACK-SQLI \
  --exclusion-rules 942130
```

## WAF Tuning Workflow

1. **Deploy in Detection mode** — enable WAF but don't block
2. **Monitor logs** — review WAF logs for triggered rules
3. **Identify false positives** — legitimate requests flagged as attacks
4. **Add exclusions** — for specific fields/rules causing false positives
5. **Disable noisy rules** — only as a last resort (prefer exclusions)
6. **Switch to Prevention mode** — when false positives are minimized
7. **Continue monitoring** — WAF tuning is ongoing

### Monitoring WAF

```bash
# Enable diagnostic logging
az monitor diagnostic-settings create \
  --name wafDiag \
  --resource <appgw-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"category":"ApplicationGatewayFirewallLog","enabled":true}]'
```

Key log fields to analyze:
- `ruleId` — which rule fired
- `action` — Detected, Blocked, Matched
- `message` — rule description
- `requestUri` — request that triggered the rule
- `details.data` — the specific data that matched

## Source Documentation

- [WAF on Application Gateway overview](https://learn.microsoft.com/azure/web-application-firewall/ag/ag-overview)
- [WAF custom rules](https://learn.microsoft.com/azure/web-application-firewall/ag/create-custom-waf-rules)
- [WAF exclusion lists](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-waf-configuration)
- [WAF tuning](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-waf-faq)
- [CRS rule groups](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-crs-rulegroups-rules)
