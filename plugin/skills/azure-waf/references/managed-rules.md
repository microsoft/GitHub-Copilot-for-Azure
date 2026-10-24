# WAF Managed Rule Sets

Azure WAF provides Microsoft-curated managed rule sets that protect against the OWASP Top 10 and other common web vulnerabilities. The rule sets differ between Application Gateway WAF and Front Door WAF.

## Rule Sets by Platform

### Application Gateway WAF: OWASP Core Rule Set (CRS)

| Version | Status | Scoring model | Notes |
|---------|--------|---------------|-------|
| CRS 3.2 | **Recommended** | Anomaly scoring | Latest, fewest false positives, best performance |
| CRS 3.1 | Supported | Anomaly scoring | Stable, widely deployed |
| CRS 3.0 | Supported | Anomaly scoring | Older, more false positives |
| CRS 2.2.9 | Deprecated | First-match | Legacy — migrate to 3.2 |

### Front Door WAF: Microsoft Default Rule Set (DRS)

| Version | Status | Scoring model | Notes |
|---------|--------|---------------|-------|
| DRS 2.1 | **Recommended** | Per-rule action | Latest, optimized for Front Door |
| DRS 2.0 | Supported | Per-rule action | Stable |
| DRS 1.1 | Supported | Per-rule action | Older |
| DRS 1.0 | Deprecated | Per-rule action | Legacy — migrate to 2.1 |

## Rule Groups (CRS 3.2)

Each rule set is organized into rule groups that target specific attack categories:

| Rule Group | Rule ID range | What it detects |
|------------|---------------|-----------------|
| REQUEST-911-METHOD-ENFORCEMENT | 911xxx | Unusual HTTP methods (PUT, DELETE, PATCH, etc.) |
| REQUEST-913-SCANNER-DETECTION | 913xxx | Known scanner/bot user agents and patterns |
| REQUEST-920-PROTOCOL-ENFORCEMENT | 920xxx | Protocol violations (missing Host header, malformed requests) |
| REQUEST-921-PROTOCOL-ATTACK | 921xxx | HTTP request smuggling, response splitting |
| REQUEST-930-APPLICATION-ATTACK-LFI | 930xxx | Local file inclusion (path traversal like `../../etc/passwd`) |
| REQUEST-931-APPLICATION-ATTACK-RFI | 931xxx | Remote file inclusion |
| REQUEST-932-APPLICATION-ATTACK-RCE | 932xxx | Remote code execution (OS command injection) |
| REQUEST-933-APPLICATION-ATTACK-PHP | 933xxx | PHP-specific injection attacks |
| REQUEST-941-APPLICATION-ATTACK-XSS | 941xxx | Cross-site scripting (reflected, stored, DOM) |
| REQUEST-942-APPLICATION-ATTACK-SQLI | 942xxx | SQL injection (all database types) |
| REQUEST-943-APPLICATION-ATTACK-SESSION-FIXATION | 943xxx | Session fixation attacks |
| REQUEST-944-APPLICATION-ATTACK-JAVA | 944xxx | Java-specific attacks (Log4j, deserialization) |
| General | Various | Catch-all rules not fitting other categories |

## DRS Rule Groups (DRS 2.1)

DRS uses similar categories with Microsoft-specific optimizations:

| Rule Group | What it detects |
|------------|-----------------|
| General | Generic attack patterns |
| METHOD-ENFORCEMENT | Unusual HTTP methods |
| PROTOCOL-ENFORCEMENT | Protocol violations |
| PROTOCOL-ATTACK | HTTP smuggling, splitting |
| LFI | Local file inclusion |
| RFI | Remote file inclusion |
| RCE | Remote code execution |
| PHP | PHP injection |
| NODEJS | Node.js-specific attacks |
| XSS | Cross-site scripting |
| SQLI | SQL injection |
| SESSION-FIXATION | Session fixation |
| JAVA | Java attacks (Log4j) |
| MS-ThreatIntel-WebShells | Known web shell patterns |
| MS-ThreatIntel-AppSec | Microsoft threat intelligence application security |
| MS-ThreatIntel-SQLI | Microsoft threat intelligence SQL injection |
| MS-ThreatIntel-CVEs | Known CVE exploits |

The `MS-ThreatIntel-*` groups are unique to DRS and powered by Microsoft's threat intelligence — they have no CRS equivalent.

## Configuring Managed Rules

### Application Gateway: Add CRS 3.2

```bash
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2
```

### Disable a specific rule

```bash
az network application-gateway waf-policy managed-rule rule-set update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI \
  --rules 942130 \
  --state Disabled
```

### Change a rule's action (DRS 2.1 on Front Door)

```bash
# Front Door DRS: Override a rule action to Log instead of Block
az network front-door waf-policy managed-rule-definition list -o table
```

For Front Door, use the portal or ARM template to override individual rule actions in DRS.

## Upgrading Rule Set Versions

### CRS upgrade on Application Gateway

```bash
# Remove old rule set
az network application-gateway waf-policy managed-rule rule-set remove \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.1

# Add new rule set
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2
```

**Before upgrading**:
1. Switch to Detection mode
2. Apply the new rule set version
3. Run for 1–2 weeks to catch new false positives introduced by the new version
4. Add exclusions as needed
5. Switch back to Prevention mode

### What changes between versions

- New rules added for emerging threats
- Existing rules may be tuned (fewer false positives)
- Rule IDs may change — check if disabled rules still exist in the new version
- Anomaly score thresholds may be adjusted

## Common False Positive Rule Groups

These rule groups most frequently trigger false positives and often need tuning:

| Rule Group | Common trigger | Resolution |
|------------|---------------|------------|
| SQLI (942xxx) | Application forms with SQL-like syntax in inputs | Add exclusion for the specific form field |
| XSS (941xxx) | Rich text editors, HTML content in request body | Add exclusion for the editor's request field |
| PROTOCOL-ENFORCEMENT (920xxx) | Missing or unusual headers from API clients | Add exclusion or disable specific rules |
| LFI (930xxx) | File paths in URL parameters (e.g., `/api/files/path/to/file`) | Add exclusion for the specific URL pattern |
| RCE (932xxx) | Application fields with OS-command-like syntax | Add per-rule exclusion for the field |

## Best Practices

1. **Always use the latest rule set version** — newer versions have better detection and fewer false positives
2. **Prefer per-rule exclusions over disabling rules** — maintain protection while allowing specific request attributes through
3. **Never disable entire rule groups in production** — disable individual rules if needed
4. **Monitor rule hit counts** to understand your application's attack surface and identify over-triggering rules
5. **Subscribe to Azure WAF rule set update notifications** to stay informed about new rules and changes
6. **Test rule set upgrades in Detection mode** before enabling Prevention mode

## Related

- [exclusions.md](exclusions.md) — How to configure exclusions for false positive rules
- [waf-modes.md](waf-modes.md) — Detection vs Prevention mode
- [custom-rules.md](custom-rules.md) — User-defined rules that run before managed rules
- [OWASP CRS documentation](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-crs-rulegroups-rules)
- [DRS documentation](https://learn.microsoft.com/azure/web-application-firewall/afds/waf-front-door-drs)
