# WAF Bot Protection

Azure WAF Bot Manager rule set provides protection against automated bot traffic. It classifies bots into categories and lets you allow, block, or log based on bot type. Bot protection is available on both Application Gateway WAF and Front Door WAF.

## Bot Manager Rule Set

The Bot Manager rule set is a managed rule set that must be explicitly added to your WAF policy — it is not included in the default OWASP CRS or Microsoft DRS.

### Bot categories

| Category | Description | Default action | Examples |
|----------|-------------|---------------|----------|
| **GoodBot** | Known legitimate bots that should be allowed | Allow | Googlebot, Bingbot, Slurp (Yahoo), Facebookbot, LinkedInBot |
| **BadBot** | Known malicious or unwanted bots | Block | Known scrapers, spam bots, vulnerability scanners |
| **UnknownBot** | Bots that cannot be classified into good or bad | Log (configurable) | Custom crawlers, unrecognized automated tools |

### How bot detection works

Bot Manager uses multiple signals to classify traffic:
1. **User-Agent string analysis** — matches against a database of known bot signatures
2. **IP reputation** — cross-references source IPs against known bot infrastructure
3. **Behavioral patterns** — identifies bot-like request patterns (rapid-fire, systematic crawling)
4. **JavaScript challenge** (Front Door Premium) — client-side challenge that distinguishes browsers from headless bots

## Enabling Bot Protection

### Application Gateway WAF

```bash
# Add Bot Manager rule set to an existing WAF policy
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type Microsoft_BotManagerRuleSet \
  --version 1.0
```

The latest version is 1.1 (if available in your region). Check available versions:

```bash
az network application-gateway waf-policy managed-rule rule-set list \
  --query "[?ruleSetType=='Microsoft_BotManagerRuleSet']" -o table
```

### Front Door WAF

Bot Manager on Front Door is configured through the managed rule sets in the WAF policy. Use the portal or ARM template:

```json
{
  "managedRules": {
    "managedRuleSets": [
      {
        "ruleSetType": "Microsoft_DefaultRuleSet",
        "ruleSetVersion": "2.1"
      },
      {
        "ruleSetType": "Microsoft_BotManagerRuleSet",
        "ruleSetVersion": "1.0"
      }
    ]
  }
}
```

## Customizing Bot Rules

### Override a specific bot rule action

You can change the action for individual bot rules. For example, to block unknown bots instead of just logging:

```bash
# Application Gateway: change UnknownBot action from Log to Block
az network application-gateway waf-policy managed-rule rule-set update \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --type Microsoft_BotManagerRuleSet \
  --version 1.0 \
  --group-name UnknownBots \
  --rules 300700 \
  --action Block
```

### Common bot rule IDs

| Rule ID | Category | Description |
|---------|----------|-------------|
| 300100 | GoodBot | Known search engine crawlers |
| 300200 | GoodBot | Known legitimate service bots |
| 300300 | BadBot | Known malicious bot signatures |
| 300400 | BadBot | Known scraping tools |
| 300500 | BadBot | Known vulnerability scanners |
| 300600 | BadBot | Known spam bots |
| 300700 | UnknownBot | Unclassified bot traffic |

> **Note**: Rule IDs and groupings may vary by version. Check the latest documentation for your rule set version.

## Combining Bot Protection with Custom Rules

For more granular bot control, combine the Bot Manager rule set with custom rules:

### Allow specific bot IPs (bypass bot check)

```bash
# Create an allow rule for your monitoring bot
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "AllowMonitoringBot" \
  --priority 1 \
  --action Allow \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "AllowMonitoringBot" \
  --match-variables RemoteAddr \
  --operator IPMatch \
  --values "10.0.5.10" "10.0.5.11"
```

Since custom rules evaluate before managed rules, this Allow rule bypasses bot detection for your monitoring infrastructure.

### Block specific User-Agent patterns not covered by Bot Manager

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockCustomScrapers" \
  --priority 5 \
  --action Block \
  --rule-type MatchRule

az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "BlockCustomScrapers" \
  --match-variables "RequestHeaders['User-Agent']" \
  --operator Contains \
  --values "my-custom-scraper" "data-harvester" \
  --transforms Lowercase
```

### Rate limit suspected bot traffic

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitBots" \
  --priority 10 \
  --action Block \
  --rule-type RateLimitRule \
  --rate-limit-threshold 60 \
  --rate-limit-duration OneMin \
  --group-by-user-session "ClientAddr"

# Scope to requests without common browser headers
az network application-gateway waf-policy custom-rule match-condition add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --name "RateLimitBots" \
  --match-variables "RequestHeaders['Accept-Language']" \
  --operator Equal \
  --negate true \
  --values "*"
```

## Platform Differences

| Feature | Application Gateway WAF | Front Door WAF |
|---------|------------------------|----------------|
| Bot Manager versions | 1.0, 1.1 | 1.0, 1.1 |
| JavaScript challenge | Not available | Available (Premium tier) |
| Bot detection signals | UA string, IP reputation | UA string, IP reputation, behavioral, JS challenge |
| Custom bot rules | Via custom WAF rules | Via custom WAF rules |
| Bot traffic logging | WAF diagnostic logs | WAF diagnostic logs + Front Door access logs |

### Front Door JavaScript Challenge

Front Door Premium tier offers a JavaScript challenge capability:
- When a request is suspected to be from a bot, the client receives a JavaScript challenge page
- Real browsers execute the JavaScript and are allowed through
- Headless bots and scripts that cannot execute JavaScript are blocked
- This is particularly effective against sophisticated bots that spoof User-Agent strings

## Monitoring Bot Traffic

### Log Analytics query: Bot rule matches

```kusto
AzureDiagnostics
| where Category == "ApplicationGatewayFirewallLog"
| where ruleGroup_s contains "Bot"
| summarize count() by ruleId_s, action_s, bin(TimeGenerated, 1h)
| render timechart
```

### Log Analytics query: Top blocked bot IPs

```kusto
AzureDiagnostics
| where Category == "ApplicationGatewayFirewallLog"
| where ruleGroup_s contains "Bot"
| where action_s == "Blocked"
| summarize BlockCount = count() by clientIp_s
| order by BlockCount desc
| take 20
```

### Log Analytics query: Good bot traffic volume

```kusto
AzureDiagnostics
| where Category == "ApplicationGatewayFirewallLog"
| where ruleGroup_s == "GoodBots"
| summarize count() by ruleId_s, bin(TimeGenerated, 1d)
| render timechart
```

## Best Practices

1. **Always add the Bot Manager rule set** — OWASP CRS and Microsoft DRS do not include bot detection; it must be added separately
2. **Start with default actions** — GoodBot: Allow, BadBot: Block, UnknownBot: Log; tune after reviewing logs
3. **Allow your own automation** — Use custom Allow rules (by IP) for your own monitoring, CI/CD, and health check bots
4. **Review UnknownBot logs regularly** — Reclassify frequently seen unknown bots as Allow or Block using rule overrides
5. **Use rate limiting as a complement** — Bot Manager catches known bots; rate limiting catches unknown bots hitting endpoints too fast
6. **Keep the rule set version updated** — Microsoft continuously updates bot signatures; upgrade to the latest version when available
7. **Combine with DDoS Protection** for comprehensive defense — bot attacks at scale become DDoS attacks; see `azure-ddos-protection`

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Search engine crawler blocked | GoodBot rule overridden to Block | Reset GoodBot rule action to Allow |
| Bad bot not detected | Bot not in signature database | Add a custom rule matching the bot's User-Agent or IP |
| Too many UnknownBot alerts | Default action is Log for unknown bots | Review and reclassify frequent unknown bots; consider blocking persistent offenders |
| JavaScript challenge not working | Using Application Gateway (not supported) or Standard Front Door | Upgrade to Front Door Premium tier |
| Own monitoring tools blocked | Not exempted | Add a custom Allow rule for monitoring IPs |

## Related

- [custom-rules.md](custom-rules.md) — Custom rules for advanced bot control
- [managed-rules.md](managed-rules.md) — Core managed rule sets (CRS/DRS)
- [waf-modes.md](waf-modes.md) — Detection vs Prevention for testing bot rules
- [Bot protection documentation (Application Gateway)](https://learn.microsoft.com/azure/web-application-firewall/ag/bot-protection-overview)
- [Bot protection documentation (Front Door)](https://learn.microsoft.com/azure/web-application-firewall/afds/waf-front-door-configure-bot-protection)
