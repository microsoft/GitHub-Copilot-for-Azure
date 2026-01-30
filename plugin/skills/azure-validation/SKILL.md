---
name: azure-validation
description: Pre-deployment validation for Azure resources. Validates naming, Bicep, quotas, and prevents deployment failures.
---

# Pre-Deployment Validation

Catch naming errors, quota limits, and Bicep issues before deployment.

## Naming Constraints (Critical)

| Resource | Max | Chars | Global |
|----------|-----|-------|--------|
| Storage Account | **24** | lowercase+numbers only | Yes |
| Key Vault | **24** | alphanumerics+hyphens | Yes |
| Container Registry | 50 | alphanumerics only | Yes |
| Container App | 32 | lowercase+numbers+hyphens | No |
| App Service | 60 | alphanumerics+hyphens | Yes |

**The 24-char problem:** Storage & Key Vault names often fail. Use abbreviations: `prod` not `production`, `stor` not `storage`.

## Validation Tools

**Get schema:**
```
Tool: azure__bicepschema
Parameters: resource-type: "Microsoft.Storage/storageAccounts"
```

**Get IaC rules:**
```
Tool: azure__deploy
Command: deploy_iac_rules_get
Parameters: deployment-tool: "AZD", iac-type: "bicep"
```

**Generate plan:**
```
Tool: azure__deploy
Command: deploy_plan_get
```

## CLI Filtering (Required)

```bash
# GOOD - filtered output
az resource list -g RG --query "[].{Name:name, Type:type}" -o table

# BAD - can overflow context (100K+ chars)
az resource list
```

## Quick Flow

1. Validate names against limits
2. Get IaC rules via `azure__deploy`
3. Get schemas via `azure__bicepschema`
4. Run `/azure:preflight`
5. Deploy: `azd up`
