# WAF Detection Mode vs Prevention Mode

Azure WAF operates in one of two modes that determine how it handles requests matching rule conditions. Choosing the right mode — and knowing when to transition — is critical for balancing security and availability.

## Mode Comparison

| Aspect | Detection Mode | Prevention Mode |
|--------|---------------|-----------------|
| Matching requests | Logged only | Blocked and logged |
| HTTP response to client | Request passes through to backend | 403 Forbidden (or custom response) |
| Impact on availability | None — no requests are blocked | Potential — false positives block legitimate traffic |
| Use case | Tuning, initial deployment, testing | Production protection |
| Risk | Attacks are logged but not stopped | False positives disrupt real users |

## Detection Mode

In Detection mode, WAF evaluates all incoming requests against managed and custom rules, logs matches, but **does not block any traffic**. The request is forwarded to the backend regardless of rule matches.

### When to use Detection mode
- **Initial WAF deployment**: Run Detection mode for the first 1–2 weeks in production to observe which rules fire and identify false positives before blocking anything
- **After rule changes**: When adding new managed rule sets or custom rules, temporarily switch to Detection for validation
- **After application changes**: When the application changes its request patterns (new APIs, new headers), run Detection to verify rules still match correctly
- **Troubleshooting**: When investigating whether WAF is causing application issues

### What gets logged
Every matched rule generates a log entry containing:
- Rule ID and rule group
- Match details (which part of the request matched: URI, headers, body, etc.)
- Action taken (Detected)
- Request metadata (client IP, URI, user agent)

### Log query example (Log Analytics)

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.NETWORK"
| where Category == "ApplicationGatewayFirewallLog"
| where action_s == "Detected"
| summarize count() by ruleId_s, ruleGroup_s
| order by count_ desc
```

For Front Door:
```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.CDN"
| where Category == "FrontDoorWebApplicationFirewallLog"
| where action_s == "Log"
| summarize count() by ruleName_s
| order by count_ desc
```

## Prevention Mode

In Prevention mode, WAF evaluates requests and **actively blocks** those matching rules with a Block action. Blocked requests receive a 403 Forbidden response (customizable) and are logged.

### When to use Prevention mode
- **Production protection**: After tuning is complete and false positives are resolved
- **Compliance requirements**: When regulatory requirements mandate active blocking of threats
- **Known-good configuration**: When the WAF rule set has been validated against production traffic

### Custom error responses

Application Gateway WAF allows customizing the block response:

```bash
# Set a custom response body for blocked requests
az network application-gateway waf-policy policy-setting update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --mode Prevention \
  --state Enabled \
  --custom-block-response-status-code 403 \
  --custom-block-response-body "PGh0bWw+QmxvY2tlZCBieSBXQUY8L2h0bWw+"
```

The response body is Base64-encoded. This example encodes `<html>Blocked by WAF</html>`.

## Transitioning from Detection to Prevention

Follow this workflow to safely transition:

### Step 1: Enable Detection mode with logging

```bash
# Application Gateway WAF
az network application-gateway waf-policy policy-setting update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --state Enabled \
  --mode Detection

# Front Door WAF
az network front-door waf-policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --mode Detection
```

### Step 2: Run for at least 1–2 weeks in production

During this period:
- Review WAF logs daily for matched rules
- Identify false positives — legitimate requests that match rules
- Correlate rule IDs with request patterns to understand what is triggering

### Step 3: Configure exclusions for false positives

For each false positive:
1. Identify the rule ID that triggered
2. Determine which request attribute caused the match (header, cookie, body field)
3. Add a per-rule exclusion (preferred) or global exclusion

See [exclusions.md](exclusions.md) for detailed exclusion configuration.

### Step 4: Disable overly aggressive rules (last resort)

If exclusions do not resolve a false positive:

```bash
# Disable a specific rule
az network application-gateway waf-policy managed-rule rule-set update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type OWASP \
  --version 3.2 \
  --group-name REQUEST-942-APPLICATION-ATTACK-SQLI \
  --rules 942130 \
  --state Disabled
```

### Step 5: Switch to Prevention mode

```bash
# Application Gateway WAF
az network application-gateway waf-policy policy-setting update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --mode Prevention

# Front Door WAF
az network front-door waf-policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --mode Prevention
```

### Step 6: Monitor closely for 48–72 hours

After switching:
- Watch for increased 403 responses
- Monitor application availability and error rates
- Have a rollback plan ready (switch back to Detection)
- Check WAF logs for blocked requests that might be legitimate

## Anomaly Scoring (Application Gateway CRS 3.2+)

OWASP CRS 3.2 and later on Application Gateway use anomaly scoring:

- Each matching rule adds a score (Critical: 5, Error: 4, Warning: 3, Notice: 2)
- The request is blocked only if the total anomaly score exceeds the threshold (default: 5)
- This reduces false positives compared to the "first match blocks" model in older CRS versions

To adjust the anomaly score threshold:

```bash
az network application-gateway waf-policy policy-setting update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --mode Prevention \
  --request-body-check true \
  --max-request-body-size-in-kb 128
```

> **Note**: Front Door DRS does not use anomaly scoring — each rule match independently determines the action.

## Platform Differences

| Behavior | Application Gateway WAF | Front Door WAF |
|----------|------------------------|----------------|
| Scoring model | Anomaly scoring (CRS 3.2+) | Per-rule action (no scoring) |
| Detection mode logging | `action_s = "Detected"` | `action_s = "Log"` |
| Prevention block response | 403 (customizable body) | 403 (customizable body) |
| Mode change propagation | Immediate | ~1-2 minutes (global edge deployment) |
| Body inspection | Up to 128 KB (configurable) | Up to 128 KB |

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| False positives blocking users after switching to Prevention | Insufficient tuning in Detection mode | Switch back to Detection; add exclusions for false positives |
| No WAF logs appearing | Diagnostic logs not configured | Enable WAF diagnostic logs to Log Analytics |
| Mode change not taking effect | Policy not associated with gateway/Front Door | Verify WAF policy association |
| Legitimate API calls blocked | Request body or headers matching SQL/XSS patterns | Add per-rule exclusions for the specific request attributes |

## Related

- [exclusions.md](exclusions.md) — How to configure exclusions for false positives
- [managed-rules.md](managed-rules.md) — Rule set versions and differences
- [WAF monitoring and logging](https://learn.microsoft.com/azure/web-application-firewall/ag/application-gateway-waf-metrics)
