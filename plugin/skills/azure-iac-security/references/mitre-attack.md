# MITRE ATT&CK — Attack Path Analysis

Optional stage. Run only when the user asks for attack paths, threat scenarios, or MITRE
mapping. Chains individual MCSB findings into realistic adversary paths so teams can prioritize
by exploitability, not just severity.

## Map findings → techniques

Match each finding to its MITRE ATT&CK technique(s) using the table below. Many
misconfigurations enable more than one technique; record the most exploitable primary mapping
in `mitre_attack` and mention secondary techniques in the attack-path narrative.

### Initial Access
| Finding pattern | Technique | Tactic |
|---|---|---|
| Public NSG rule on 22/3389 (NS-7) | T1190 Exploit Public-Facing Application | Initial Access |
| Public network access / no private endpoint (NS-2) | T1133 External Remote Services | Initial Access |
| Publicly exposed management/API endpoint (NS-2, NS-7) | T1133 External Remote Services | Initial Access |
| Weak/default admin credentials, local auth (IM-1, IM-8) | T1078 Valid Accounts | Initial Access |
| Public-facing service with known-CVE image/runtime (NS-2) | T1190 Exploit Public-Facing Application | Initial Access |

### Execution & Persistence
| Finding pattern | Technique | Tactic |
|---|---|---|
| VM custom script / user-data extension unrestricted (NS-8) | T1059 Command and Scripting Interpreter | Execution |
| Function/automation account with broad rights (PA-7) | T1648 Serverless Execution | Execution |
| Persisted valid account / SP secret in template (IM-8) | T1078 Valid Accounts | Persistence |
| Added role assignment / new credential in IaC (PA-7) | T1098 Account Manipulation | Persistence |
| Automation runbook / scheduled task resource (NS-8) | T1053 Scheduled Task/Job | Persistence |

### Privilege Escalation
| Finding pattern | Technique | Tactic |
|---|---|---|
| Subscription/RG Owner or wildcard-action custom role (PA-7) | T1098 Account Manipulation | Privilege Escalation |
| Managed identity with excessive scope (IM-3, PA-7) | T1548 Abuse Elevation Control Mechanism | Privilege Escalation |
| Key Vault access policy granting all key/secret perms (IM-8) | T1548 Abuse Elevation Control Mechanism | Privilege Escalation |

### Credential Access
| Finding pattern | Technique | Tactic |
|---|---|---|
| Shared-key access / no managed identity (IM-3, IM-8) | T1528 Steal Application Access Token | Credential Access |
| Hardcoded secret in template/param file (IM-8) | T1552 Unsecured Credentials | Credential Access |
| No encryption in transit, TLS<1.2 (DP-3) | T1040 Network Sniffing | Credential Access |
| Key Vault soft-delete/purge protection off (DP-8) | T1555 Credentials from Password Stores | Credential Access |

### Discovery & Lateral Movement
| Finding pattern | Technique | Tactic |
|---|---|---|
| Flat network / no segmentation (NS-1) | T1046 Network Service Discovery | Discovery |
| Over-permissive identity enabling resource enum (PA-7) | T1580 Cloud Infrastructure Discovery | Discovery |
| Reachable internal service over public/peered net (NS-1, NS-7) | T1021 Remote Services | Lateral Movement |

### Collection & Exfiltration
| Finding pattern | Technique | Tactic |
|---|---|---|
| Public blob / container public access (NS-2) | T1530 Data from Cloud Storage | Collection |
| No CMK / encryption at rest disabled (DP-5, DP-6) | T1530 Data from Cloud Storage | Collection |
| Data egress over unrestricted public endpoint (NS-2) | T1048 Exfiltration Over Alternative Protocol | Exfiltration |

### Defense Evasion & Impact
| Finding pattern | Technique | Tactic |
|---|---|---|
| Threat detection / Defender disabled (LT-1) | T1562 Impair Defenses | Defense Evasion |
| Diagnostic/audit logging disabled (LT-3, LT-4) | T1562.008 Disable Cloud Logs | Defense Evasion |
| Short/no log retention (LT-6) | T1070 Indicator Removal | Defense Evasion |
| Logs not centralized to workspace (LT-5) | T1562 Impair Defenses | Defense Evasion |
| No Key Vault soft delete / purge protection (DP-8) | T1485 Data Destruction | Impact |
| Storage/DB recoverability disabled — confirm control live (BR pillar) | T1490 Inhibit System Recovery | Impact |

## Build attack paths

1. **Group by tactic** and order along the kill chain: Initial Access → Execution →
   Persistence → Privilege Escalation → Credential Access → Collection → Exfiltration →
   Defense Evasion.
2. **Chain** findings where the output of one enables the next. Example:
   - T1190 (public SSH, NS-7) → T1078 (weak/local auth, IM-1) → T1098 (subscription Owner,
     PA-7) → T1530 (public blob, NS-2), with T1562 (LT-1 disabled) hiding the whole chain.
3. **Score priority** by chain length and how far it reaches: a finding that begins or extends
   a full Initial-Access-to-Exfiltration chain outranks an isolated one of equal severity.
4. **Populate `mitre_attack`** on each contributing finding (`technique_id`, `technique_name`,
   `tactic`) per the output schema. Present the chained narrative separately from the findings.

## Report format

For each attack path: a short title, the ordered technique chain (with the enabling finding and
line number at each step), the impact if fully exploited, and the single highest-leverage fix
that breaks the chain earliest.
