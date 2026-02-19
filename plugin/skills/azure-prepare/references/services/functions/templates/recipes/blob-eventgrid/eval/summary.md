# Eval Summary

## Coverage Status

| Language | Source | Eval | Status |
|----------|--------|------|--------|
| Python | ✅ | ✅ | PASS |
| TypeScript | ✅ | 🔲 | Pending |
| JavaScript | ✅ | 🔲 | Pending |
| C# (.NET) | ✅ | 🔲 | Pending |
| Java | ✅ | 🔲 | Pending |
| PowerShell | ✅ | 🔲 | Pending |

## IaC Validation

| IaC Type | File | Syntax | Policy Compliant | Status |
|----------|------|--------|------------------|--------|
| Bicep | blob.bicep | ✅ | ✅ | PASS |
| Terraform | blob.tf | ✅ | ✅ | PASS |

## Results

| Test | Python | TypeScript | JavaScript | .NET | Java | PowerShell |
|------|--------|------------|------------|------|------|------------|
| Health | ✅ | - | - | - | - | - |
| Blob trigger | ✅ | - | - | - | - | - |
| EventGrid event | ✅ | - | - | - | - | - |
| Copy to processed | ✅ | - | - | - | - | - |

## Notes

Dedicated AZD templates available for all 6 languages:
- `functions-quickstart-{lang}-azd-eventgrid-blob`

## IaC Features

| Feature | Bicep | Terraform |
|---------|-------|-----------|
| Storage Account (RBAC-only) | ✅ | ✅ |
| Event Grid System Topic | ✅ | ✅ |
| Event Grid Subscription | ✅ | ✅ |
| RBAC Assignment | ✅ | ✅ |
| Private Endpoint (VNet) | ✅ | ✅ |
| Azure Policy Compliance | ✅ | ✅ |
