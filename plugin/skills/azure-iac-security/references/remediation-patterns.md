# Remediation Patterns

Every finding must ship with a concrete `code_fix` and a `learn.microsoft.com` URL. Prefer
official secure defaults; confirm property names/values with `microsoft_docs_search` or
`bicepschema_get` when unsure. Give the fix in the same dialect as the input template.

## Common fixes (ARM property → secure value)

| Control | Property | Insecure | Secure fix |
|---|---|---|---|
| NS-7 | `securityRules[].sourceAddressPrefix` | `0.0.0.0/0` / `*` / `Internet` on 22,3389,1433,3306,5432,27017 | Specific corporate CIDR, e.g. `10.0.0.0/24` |
| NS-2 | `publicNetworkAccess` | `Enabled` | `Disabled` + private endpoint |
| NS-2 | `networkAcls.defaultAction` | `Allow` | `Deny` + IP/VNet allowlist |
| DP-3 | `minimumTlsVersion` | `TLS1_0` / `TLS1_1` | `TLS1_2` |
| DP-3 | `supportsHttpsTrafficOnly` | `false` | `true` |
| IM-1 | `disableLocalAuth` | `false` | `true` |
| IM-3 | `identity` | missing | add `{ "type": "SystemAssigned" }` |
| IM-8 | `enableRbacAuthorization` | `false` | `true` |
| IM-8 | `allowSharedKeyAccess` | `true` | `false` |
| NS-2 | `allowBlobPublicAccess` | `true` | `false` |
| DP-4 | `transparentDataEncryption.state` | `Disabled` | `Enabled` |
| DP-5 | `encryption.keySource` | `Microsoft.Storage` | `Microsoft.Keyvault` (CMK) |
| DP-8 | `enableSoftDelete` / `enablePurgeProtection` | `false` / missing | `true` |
| LT-1 | `securityAlertPolicies.state` | `Disabled` | `Enabled` |
| LT-6 | `retentionDays` | `< 90` | `>= 90` (365+ for compliance) |

## Fix presentation

For each finding, show the **before → after** snippet with the exact property line, then a
one-line rationale and the Learn URL. Example:

```diff
- "sourceAddressPrefix": "0.0.0.0/0"
+ "sourceAddressPrefix": "10.0.0.0/24"
```
Restrict inbound SSH to the corporate range (MCSB NS-7). See:
https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-7-simplify-network-security-configuration

## Dialect notes

- **Bicep:** use `property: value` (no quotes on keys); managed identity is `identity: { type: 'SystemAssigned' }`.
- **Terraform:** snake_case attributes — e.g. `enable_https_traffic_only = true`,
  `min_tls_version = "TLS1_2"`, `public_network_access_enabled = false`; identity is an
  `identity { type = "SystemAssigned" }` block.

## Reporting order

Group by severity (Critical → High → Medium → Low). Within a severity, group by resource so a
reader can fix one resource end-to-end. Never emit a finding without a `code_fix`.
