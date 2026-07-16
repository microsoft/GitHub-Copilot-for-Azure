# Finding Output Schema

Emit findings as a JSON object with a `findings` array. Each finding uses the fields below.
Required fields must always be present.

```json
{
  "findings": [
    {
      "control_id": "NS-7",
      "pillar": "Network Security",
      "severity": "Critical",
      "priority": "P0",
      "description": "NSG rule exposes SSH port 22 to the internet (0.0.0.0/0).",
      "line_number": 45,
      "resource_id": "Microsoft.Network/networkSecurityGroups/myNSG",
      "vulnerable_code": "\"sourceAddressPrefix\": \"0.0.0.0/0\"",
      "code_fix": "\"sourceAddressPrefix\": \"10.0.0.0/24\"",
      "remediation_steps": "Restrict sourceAddressPrefix to a specific corporate CIDR range.",
      "azure_guidance": "https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-7-simplify-network-security-configuration",
      "grounding": "live",
      "mitre_attack": {
        "technique_id": "T1190",
        "technique_name": "Exploit Public-Facing Application",
        "tactic": "Initial Access"
      }
    }
  ],
  "unscanned_resources": [
    {
      "resource_id": "Microsoft.SomeNew/service/foo",
      "reason": "No seed mapping and live grounding returned no security guidance",
      "recommendation": "Manual review"
    }
  ]
}
```

## Field Reference

| Field | Required | Notes |
|---|---|---|
| `control_id` | ✅ | Reconciled MCSB control (e.g. `NS-7`, `DP-3`, `IM-8`) or `AI-SAFETY` for RAI/content-filter gaps |
| `pillar` | | `Network Security` \| `Identity Management` \| `Data Protection` \| `Logging & Threat Detection` \| `AI Workload` |
| `severity` | ✅ | `Critical` \| `High` \| `Medium` \| `Low` |
| `priority` | ✅ | `P0` \| `P1` \| `P2` \| `P3` |
| `description` | ✅ | Concise statement of the violation |
| `line_number` | ✅ | Source line of the vulnerable property (integer or string) |
| `resource_id` | | `<type>/<name>` of the affected resource |
| `vulnerable_code` | ✅ | Exact offending snippet |
| `code_fix` | ✅ | Exact corrected snippet |
| `remediation_steps` | | Step-by-step fix guidance |
| `azure_guidance` | ✅ | Reconciled `learn.microsoft.com` URL (never a stale/guessed link) |
| `grounding` | | `live` (reconciled via MCP) \| `offline` (seed-table fallback, MCP unavailable) |
| `mitre_attack` | | Object with `technique_id`, `technique_name`, `tactic`. Only in attack-path mode |
| `atlas` | | AI attack-path mode: object with `technique_id` (e.g. `AML.T0051`), `tactic` |
| `owasp_llm` | | AI attack-path mode: OWASP LLM risk id/name (e.g. `LLM01 Prompt Injection`) |

Use the top-level `unscanned_resources` array (each: `resource_id`, `reason`, `recommendation`)
for resource types that have no seed mapping and no live grounding, or properties that could not
be resolved. Never fabricate `vulnerable_code`/`code_fix` for these — report them here instead.

## Rules

- `additionalProperties` is allowed on each finding, but never omit a required field.
- **Secret redaction:** for hardcoded-secret findings (IM-8), never place the real value in
  `vulnerable_code` — use a redacted snippet (e.g. `"adminPassword": "<redacted>"`) and make
  `code_fix` a Key Vault reference (e.g. `"adminPassword": "[reference(...).secretValue]"` or a
  Bicep `getSecret()` / Key Vault reference).
- `azure_guidance` must be the URL reconciled via live Learn (or the seed-table URL with
  `grounding: offline` when MCP is unavailable) — never a guessed or stale link.
- In a standard scan, omit `mitre_attack` / `atlas` / `owasp_llm`. Populate them only when the
  user asks for attack-path / AI-risk analysis (see mitre-attack.md, ai-workload-security.md).
- Sort the reported findings by severity (Critical → Low), then by resource.
