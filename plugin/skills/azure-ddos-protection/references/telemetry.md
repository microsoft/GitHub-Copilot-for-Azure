# Azure DDoS Protection Telemetry and Monitoring

Azure DDoS Protection provides comprehensive telemetry through Azure Monitor metrics, diagnostic logs, and mitigation reports. Proper monitoring configuration is essential — without it, you have no visibility into attacks or mitigation effectiveness.

## Metrics (Azure Monitor)

DDoS Protection exposes metrics on each protected public IP address. These metrics are available in real time through Azure Monitor.

### Key Metrics

| Metric | Description | Unit | Use case |
|--------|-------------|------|----------|
| `IfUnderDDoSAttack` | 1 if under attack, 0 otherwise | Binary | Trigger alerts when an attack starts |
| `InboundPacketsDroppedDDoS` | Packets dropped by DDoS mitigation | Count/sec | Measure mitigation effectiveness |
| `InboundPacketsForwardedDDoS` | Packets forwarded (not dropped) | Count/sec | Track legitimate traffic during mitigation |
| `InboundBytesDroppedDDoS` | Bytes dropped by DDoS mitigation | Bytes/sec | Quantify attack volume in bytes |
| `InboundBytesForwardedDDoS` | Bytes forwarded to the application | Bytes/sec | Verify application still receives traffic |
| `TCPPacketsDroppedDDoS` | TCP packets dropped | Count/sec | Identify TCP-based attacks (SYN floods) |
| `TCPPacketsForwardedDDoS` | TCP packets forwarded | Count/sec | Verify TCP traffic health |
| `UDPPacketsDroppedDDoS` | UDP packets dropped | Count/sec | Identify UDP-based attacks |
| `UDPPacketsForwardedDDoS` | UDP packets forwarded | Count/sec | Verify UDP traffic health |
| `TCPBytesDroppedDDoS` | TCP bytes dropped | Bytes/sec | TCP attack bandwidth |
| `TCPBytesForwardedDDoS` | TCP bytes forwarded | Bytes/sec | Legitimate TCP bandwidth |
| `UDPBytesDroppedDDoS` | UDP bytes dropped | Bytes/sec | UDP attack bandwidth |
| `UDPBytesForwardedDDoS` | UDP bytes forwarded | Bytes/sec | Legitimate UDP bandwidth |

### Viewing metrics

```bash
# Query if a public IP is currently under attack
az monitor metrics list \
  --resource <public-ip-resource-id> \
  --metric "IfUnderDDoSAttack" \
  --interval PT1M \
  --output table

# View dropped packets in the last hour
az monitor metrics list \
  --resource <public-ip-resource-id> \
  --metric "InboundPacketsDroppedDDoS" \
  --interval PT1M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --output table
```

### KQL queries for metrics (Log Analytics)

```kusto
// DDoS attack timeline (when attacks started and stopped)
AzureMetrics
| where ResourceId contains "PUBLICIPADDRESS"
| where MetricName == "IfUnderDDoSAttack"
| where Maximum == 1
| project TimeGenerated, ResourceId, MetricName, Maximum
| order by TimeGenerated desc
```

## Diagnostic Logs

DDoS diagnostic logs provide detailed per-flow and per-event information during attacks. They must be explicitly enabled via diagnostic settings.

### Log Categories

| Category | Description | Content |
|----------|-------------|---------|
| `DDoSProtectionNotifications` | Attack lifecycle events | Attack started, attack stopped, mitigation started |
| `DDoSMitigationFlowLogs` | Per-flow traffic details during mitigation | Source IP, destination IP, source port, dest port, protocol, action (dropped/forwarded) |
| `DDoSMitigationReports` | Aggregated attack reports | 5-minute incremental reports during attack + post-attack summary |

### Enable diagnostic logging

```bash
# Enable all DDoS log categories for a public IP
az monitor diagnostic-settings create \
  --name "ddos-diagnostics" \
  --resource <public-ip-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[
    {"category": "DDoSProtectionNotifications", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}},
    {"category": "DDoSMitigationFlowLogs", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}},
    {"category": "DDoSMitigationReports", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}}]'
```

**Critical**: Enable diagnostic logging on **every** protected public IP **before** an attack occurs. If logging is not configured when an attack starts, you will have no data for post-incident analysis or cost protection claims.

### Verify diagnostic settings

```bash
az monitor diagnostic-settings list \
  --resource <public-ip-resource-id> \
  --output table
```

## DDoS Protection Notifications

These logs record the lifecycle of DDoS mitigation events.

### Notification types

| Type | Meaning |
|------|---------|
| `MitigationStarted` | DDoS mitigation has been activated for this IP |
| `MitigationStopped` | DDoS mitigation has been deactivated (attack subsided) |
| `UnderAttack` | Active attack detected (may be logged repeatedly during sustained attack) |

### KQL query: Attack timeline

```kusto
AzureDiagnostics
| where Category == "DDoSProtectionNotifications"
| project TimeGenerated, Resource, properties_s
| order by TimeGenerated desc
```

### KQL query: Attack duration

```kusto
AzureDiagnostics
| where Category == "DDoSProtectionNotifications"
| extend NotificationType = tostring(parse_json(properties_s).type)
| where NotificationType in ("MitigationStarted", "MitigationStopped")
| project TimeGenerated, Resource, NotificationType
| order by TimeGenerated asc
```

## DDoS Mitigation Flow Logs

Flow logs provide per-flow details during active mitigation — which flows were dropped and which were forwarded.

### KQL query: Top attack source IPs

```kusto
AzureDiagnostics
| where Category == "DDoSMitigationFlowLogs"
| extend SourceIP = tostring(parse_json(properties_s).sourceIP)
| extend Action = tostring(parse_json(properties_s).action)
| where Action == "Dropped"
| summarize DroppedFlows = count() by SourceIP
| order by DroppedFlows desc
| take 20
```

### KQL query: Attack protocol distribution

```kusto
AzureDiagnostics
| where Category == "DDoSMitigationFlowLogs"
| extend Protocol = tostring(parse_json(properties_s).protocol)
| extend Action = tostring(parse_json(properties_s).action)
| where Action == "Dropped"
| summarize DroppedFlows = count() by Protocol
| render piechart
```

### KQL query: Forwarded vs dropped traffic

```kusto
AzureDiagnostics
| where Category == "DDoSMitigationFlowLogs"
| extend Action = tostring(parse_json(properties_s).action)
| summarize count() by Action, bin(TimeGenerated, 5m)
| render timechart
```

## DDoS Mitigation Reports

Mitigation reports provide aggregated summaries of attack characteristics.

### Report types
- **Incremental reports**: Generated every 5 minutes during an active attack; contain attack vectors, dropped/forwarded traffic volumes, and top source countries
- **Post-attack report**: Generated after mitigation ends; contains the complete attack summary including peak bandwidth, duration, and mitigation effectiveness

### KQL query: Attack summary

```kusto
AzureDiagnostics
| where Category == "DDoSMitigationReports"
| extend ReportType = tostring(parse_json(properties_s).reportType)
| where ReportType == "PostAttack"
| project TimeGenerated, Resource, properties_s
| order by TimeGenerated desc
```

## Alerting

### Create a DDoS attack alert

```bash
# Alert when any protected public IP comes under attack
az monitor metrics alert create \
  --name "ddos-attack-detected" \
  --resource-group <rg-name> \
  --scopes <public-ip-resource-id> \
  --condition "max IfUnderDDoSAttack > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id> \
  --severity 1 \
  --description "DDoS attack detected on public IP"
```

### Create SNAT exhaustion alert (complementary)

```bash
az monitor metrics alert create \
  --name "ddos-packet-drop-high" \
  --resource-group <rg-name> \
  --scopes <public-ip-resource-id> \
  --condition "avg InboundPacketsDroppedDDoS > 10000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id> \
  --severity 2 \
  --description "High volume of packets being dropped by DDoS mitigation"
```

### Recommended alert rules

| Alert | Condition | Severity | Purpose |
|-------|-----------|----------|---------|
| Attack start | `IfUnderDDoSAttack > 0` | Sev 1 (Critical) | Immediate notification of attack |
| High packet drop | `InboundPacketsDroppedDDoS > 10000` | Sev 2 (Error) | Quantify attack impact |
| Sustained attack | `IfUnderDDoSAttack > 0` for 30 min | Sev 1 (Critical) | Escalation for prolonged attacks |

## Azure Workbooks

Azure provides a built-in DDoS Protection workbook that visualizes:
- Attack timeline across all protected IPs
- Top attacked resources
- Traffic distribution (dropped vs forwarded)
- Geographic attack sources
- Protocol distribution

Access: Azure Portal → Azure Monitor → Workbooks → "Azure DDoS Protection" template

## Best Practices

1. **Enable diagnostic logs on ALL protected public IPs** — not just the primary ones; attackers target any exposed IP
2. **Configure alerts before you need them** — alert rules must exist before an attack starts
3. **Retain logs for at least 90 days** — post-incident analysis and cost protection claims may need historical data
4. **Use the DDoS Protection workbook** for at-a-glance visibility across your environment
5. **Set up action groups** that page the on-call team (SMS, email, webhook to PagerDuty/Opsgenie)
6. **Test your alerts** — use the `az monitor metrics alert` test capabilities to verify notifications work
7. **Correlate with WAF and Firewall logs** — DDoS attacks often come with application-layer attacks; use `azure-waf` and `azure-firewall` logs together

## Related

- [ddos-tiers.md](ddos-tiers.md) — Which tiers include telemetry features
- [rapid-response.md](rapid-response.md) — Using telemetry data during DRR engagement
- [attack-types.md](attack-types.md) — Understanding metrics per attack type
- [Azure DDoS monitoring](https://learn.microsoft.com/azure/ddos-protection/ddos-protection-standard-features#ddos-protection-telemetry)
