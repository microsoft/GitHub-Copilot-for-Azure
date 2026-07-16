# MCSB v3.0 — Logging & Threat Detection (LT) — SEED HINTS

> Seed hints only. Reconcile control ID/name/URL against live Microsoft Learn via
> `microsoft_docs_search` (query: "MCSB logging threat detection LT-<n>") before emitting.
> The `MITRE:` hints below are indicative; **mitre-attack.md is authoritative** for attack-path
> technique selection.
> URL base: https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection

## LT-1: Enable threat detection capabilities
- **Check:** Microsoft Defender plans enabled for the resource type (Storage/SQL/Key Vault/Cosmos DB/servers); `advancedThreatProtectionSettings.isEnabled` = true; SQL `securityAlertPolicies.state` = `Enabled`.
- **Properties:** `advancedThreatProtectionSettings`, `securityAlertPolicies`, `threatDetectionSettings`
- **MITRE:** T1190, T1059
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection#lt-1-enable-threat-detection-capabilities

## LT-3: Enable logging for security investigation
- **Check:** SQL `auditingSettings.state` = `Enabled` (retentionDays >= 90); Storage/Key Vault/App Service diagnostic settings enabled.
- **Properties:** `auditingSettings`, `diagnosticSettings`, `logs`
- **MITRE:** T1562, T1070
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection#lt-3-enable-logging-for-security-investigation

## LT-4: Enable network logging for security investigation
- **Check:** NSG flow logs enabled; Azure Firewall diagnostic logs; Application Gateway WAF logs.
- **Properties:** `flowLogs`, `firewallLogs`, `diagnosticSettings`
- **MITRE:** T1071, T1021
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection#lt-4-enable-network-logging-for-security-investigation

## LT-5: Centralize security log management and analysis
- **Check:** `workspaceId` configured in diagnostic settings; logs not fragmented across workspaces.
- **Properties:** `workspaceId`, `eventHubAuthorizationRuleId`, `storageAccountId`
- **MITRE:** T1562, T1580
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection#lt-5-centralize-security-log-management-and-analysis

## LT-6: Configure log storage retention
- **Check:** `retentionDays` >= 90 (365+ for compliance); `retentionPolicy.enabled` = true.
- **Severity by retention:** < 30 days = Critical; 30-89 = High; 90-364 = Medium; 365+ = Compliant.
- **Properties:** `retentionDays`, `retentionPolicy`
- **MITRE:** T1070
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-logging-threat-detection#lt-6-configure-log-storage-retention
