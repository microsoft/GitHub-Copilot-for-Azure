---
name: azure-waf
description: "Configure and manage Web Application Firewall (WAF) on Application Gateway and Azure Front Door to protect web applications from OWASP threats, SQL injection, XSS, and bot attacks. WHEN: WAF, web application firewall, OWASP, SQL injection, XSS, cross-site scripting, bot protection, WAF policy, managed rules, custom WAF rules, WAF exclusions. DO NOT USE FOR: network-level firewall (use azure-firewall), DDoS mitigation (use azure-ddos-protection), NSG rules (use azure-virtual-network)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Web Application Firewall (WAF)

Azure Web Application Firewall provides centralized protection for web applications against common exploits and vulnerabilities. WAF can be deployed on Azure Application Gateway (regional) or Azure Front Door (global edge). It inspects every inbound HTTP/HTTPS request and applies managed rule sets (OWASP CRS, Microsoft DRS) and custom rules to detect and block attacks like SQL injection, cross-site scripting, and bot abuse.

## When to Use This Skill

- Deploying or configuring WAF on Application Gateway v2 or Azure Front Door
- Selecting between Detection mode and Prevention mode
- Configuring OWASP Core Rule Set (CRS) or Microsoft Default Rule Set (DRS) versions
- Creating custom WAF rules with match conditions and rate limiting
- Troubleshooting false positives and configuring WAF exclusions
- Setting up bot protection rules against automated threats
- Tuning WAF rules for specific application needs
- Migrating WAF configuration between Application Gateway and Front Door
- Reviewing WAF logs and diagnostics to identify blocked requests
- Configuring geo-filtering rules to restrict traffic by country or region

## Rules

1. WAF on Application Gateway and WAF on Front Door use different policy schemas — configurations are not interchangeable. Always confirm which platform the user is targeting.
2. Start with Detection mode in production to identify false positives before enabling Prevention mode. Review WAF logs for at least a few days of production traffic.
3. WAF policies are the recommended configuration model. Legacy WAF configuration on Application Gateway (via `waf-config`) is deprecated.
4. CRS is used on Application Gateway; DRS (Default Rule Set) is used on Front Door. Know which rule set applies to the target platform.
5. When disabling specific managed rules, prefer per-rule exclusions over globally disabling rule groups to maintain maximum protection.
6. Rate limiting rules on Front Door WAF use a different match condition structure than Application Gateway — verify the platform before providing syntax.
7. Always recommend enabling WAF diagnostic logs to a Log Analytics workspace for visibility into matched rules and blocked requests.
8. Bot protection managed rule set is available on both Application Gateway and Front Door, but must be explicitly added to the WAF policy.
9. Custom rules are evaluated before managed rules. Within custom rules, priority determines order (lowest number first).
10. Cross-reference with `azure-application-gateway` for Application Gateway-specific settings and with `azure-front-door` for Front Door routing; recommend `azure-ddos-protection` for volumetric attack mitigation that WAF does not address.

## MCP Tools

| Tool | Resource | Use |
|------|----------|-----|
| `azure__network` | `waf_policy_list` | List all WAF policies in a subscription or resource group |

## CLI Fallback

```bash
# List WAF policies for Application Gateway
az network application-gateway waf-policy list \
  --resource-group <rg-name> -o table

# Create a WAF policy for Application Gateway
az network application-gateway waf-policy create \
  --name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2

# Enable Prevention mode on Application Gateway WAF policy
az network application-gateway waf-policy policy-setting update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --state Enabled \
  --mode Prevention

# Add a custom rule to Application Gateway WAF policy
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadIP" \
  --priority 10 \
  --action Block \
  --rule-type MatchRule

# Add a match condition to the custom rule
az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockBadIP" \
  --match-variables RemoteAddr \
  --operator IPMatch \
  --values "203.0.113.0/24"

# Create a managed rule override (disable a specific rule)
az network application-gateway waf-policy managed-rule rule-set update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI \
  --rules 942130 \
  --state Disabled

# Add exclusion to WAF policy
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --match-variable RequestHeaderNames \
  --selector-match-operator Contains \
  --selector "X-Custom-Header"

# List Front Door WAF policies
az network front-door waf-policy list \
  --resource-group <rg-name> -o table

# Create a Front Door WAF policy
az network front-door waf-policy create \
  --name <policy-name> \
  --resource-group <rg-name> \
  --mode Prevention \
  --sku Premium_AzureFrontDoor

# Add a rate-limit custom rule to Front Door WAF
az network front-door waf-policy rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitAPI" \
  --priority 100 \
  --action Block \
  --rule-type RateLimitRule \
  --rate-limit-threshold 100 \
  --rate-limit-duration 1

# Enable WAF diagnostic logging
az monitor diagnostic-settings create \
  --name "waf-diag" \
  --resource <waf-policy-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"categoryGroup":"allLogs","enabled":true}]'
```

## Key Concepts

- **WAF platforms**: Application Gateway WAF (regional, inline with app) vs Front Door WAF (global edge, CDN-integrated); choose based on deployment model
- **Detection vs Prevention**: Detection mode logs but does not block; Prevention mode actively blocks matching requests; always start with Detection in production
- **Managed rule sets**: OWASP CRS (3.2, 3.1, 3.0) for Application Gateway; Microsoft DRS (2.1, 2.0, 1.1) for Front Door; both cover OWASP Top 10
- **Custom rules**: User-defined rules with match conditions; evaluated before managed rules; support IP matching, geo-filtering, rate limiting, string matching
- **Rule evaluation order**: Custom rules (by priority) → Managed rules (by rule group and rule ID); first matching rule determines action
- **Exclusions**: Exclude specific request attributes (headers, cookies, query parameters, body fields) from specific managed rules to eliminate false positives
- **Bot protection**: Managed rule set that classifies bots as good (search engines) or bad (scrapers, crawlers); can allow, block, or log per category
- **Rate limiting**: Limits request rate per client IP (or per socket address on Front Door); uses sliding window; available via custom rules
- **Per-rule exclusions**: Scoped exclusions that apply to a specific managed rule rather than globally — more secure than disabling the rule entirely
- **Anomaly scoring**: CRS 3.2+ on Application Gateway uses anomaly scoring — a request must exceed a score threshold to be blocked, reducing false positives
- **WAF policy association**: One WAF policy can be associated with multiple Application Gateways or Front Door endpoints; changes propagate to all associations
- **Geo-filtering**: Block or allow traffic from specific countries or regions using custom rules with GeoMatch operator

## References

- [waf-modes.md](references/waf-modes.md) — Detection vs Prevention mode guidance
- [managed-rules.md](references/managed-rules.md) — OWASP CRS and Microsoft DRS rule sets
- [custom-rules.md](references/custom-rules.md) — Custom rule creation and rate limiting
- [exclusions.md](references/exclusions.md) — WAF exclusion configuration and false positive handling
- [bot-protection.md](references/bot-protection.md) — Bot Manager rule set configuration
- [Azure WAF on Application Gateway documentation](https://learn.microsoft.com/azure/web-application-firewall/ag/ag-overview)
- [Azure WAF on Front Door documentation](https://learn.microsoft.com/azure/web-application-firewall/afds/afds-overview)
- [WAF policy overview](https://learn.microsoft.com/azure/web-application-firewall/overview)
