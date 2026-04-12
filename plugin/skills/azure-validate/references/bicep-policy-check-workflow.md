# Bicep Policy Check Workflow

Check Bicep templates against Azure Policy using the `checkPolicyRestrictions` REST API. This validates that proposed resources comply with organization policies before deployment.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Parse Bicep** | Read `main.bicep` and modules. Extract all resource types, names, locations, and key properties. See [bicep-parsing.md](procedures/bicep-parsing.md) if available, or parse directly. |
| 2 | **Build Resource Entries** | For each resource, construct a policy check entry with `type`, `name`, `location`, and relevant properties. Include the resource group as a separate `Microsoft.Resources/resourceGroups` entry. |
| 3 | **Call checkPolicyRestrictions** | Make a single REST API call per resource (batch where possible): |

```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.PolicyInsights/checkPolicyRestrictions?api-version=2022-03-01" \
  --body '{
    "resourceDetails": {
      "resourceContent": {
        "type": "<resource-type>",
        "name": "<resource-name>",
        "location": "<location>",
        "properties": { ... }
      },
      "apiVersion": "<api-version>"
    }
  }'
```

| # | Action | Details |
|---|--------|---------|
| 4 | **Parse Results** | For each response, check `fieldRestrictions` array. Each entry describes a policy restriction on a specific field. |
| 5 | **Present Report** | Show policy compliance status per resource. |

## Report Format

```
## Policy Compliance Check

| # | Resource | Type | Policy Status |
|---|----------|------|---------------|
| 1 | vnet-web | Microsoft.Network/virtualNetworks | ✅ Compliant |
| 2 | storage-01 | Microsoft.Storage/storageAccounts | ❌ 2 restrictions |

### Restrictions
- **storage-01**: `properties.supportsHttpsTrafficOnly` must be `true` (Policy: "Enforce HTTPS on Storage")
- **storage-01**: `properties.minimumTlsVersion` must be `TLS1_2` (Policy: "Require TLS 1.2")
```

## Error Handling

| Error | Cause | Remediation |
|---|---|---|
| 403 Forbidden | Insufficient permissions for policy check API | User needs `Microsoft.PolicyInsights/checkPolicyRestrictions/action` permission. Report the resources that could not be checked and continue with the rest. |
| Resource type not recognized | Preview or rare resource type | Skip and note in report |
| No active policies | Subscription has no policy assignments | Report "No policy restrictions found" — all resources pass |
