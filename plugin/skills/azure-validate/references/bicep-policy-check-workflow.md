# Bicep Policy Check Workflow

Check Bicep templates against Azure Policy before deployment. Use this workflow when standard policy listing is not enough and you need per-resource preflight compliance.

## Required References


- [Bicep Parsing](procedures/bicep-parsing.md)
- [Azure Resource Configs](azure-resource-configs.md)
## Workflow

| # | Action | Details |
|---|--------|---------|
| 1 | **Parse Bicep** | Read `main.bicep` and modules. Extract all resource types, names, locations, and key properties. Follow [bicep-parsing.md](procedures/bicep-parsing.md) to parse the template and any referenced modules. |  
| 2 | **Build Resource Entries** | For each resource, construct a policy check entry with `type`, `name`, `location`, and relevant properties. Include the resource group as a separate `Microsoft.Resources/resourceGroups` entry. |  
| 3 | **Call checkPolicyRestrictions** | Make one REST API call per resource using that resource's payload: |  


## API Pattern

```bash
az rest --method POST \
  --url "https://management.azure.com/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.PolicyInsights/checkPolicyRestrictions?api-version=2022-03-01" \
  --headers "Content-Type=application/json" \
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

| Error | Remediation |
|---|---|
| 403 Forbidden | Report missing `Microsoft.PolicyInsights/checkPolicyRestrictions` permission and use fallback logic if possible. |
| 404 Not Found | Retry at subscription scope when the resource group does not yet exist. |
| Unrecognized resource type | Note it for manual review. |
| No active policies | Report that no policy restrictions were found. |
