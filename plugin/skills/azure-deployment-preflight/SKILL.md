---
name: azure-deployment-preflight
description: Validates Bicep deployments before execution via what-if analysis and permission checks. Activate for deploying to Azure, validating Bicep, checking permissions, previewing changes, running what-if, or preparing azd provision.
---

# Azure Deployment Preflight Validation

Validates Bicep deployments before execution, supporting Azure CLI (`az`) and Azure Developer CLI (`azd`) workflows.

## When to Use

- Before deploying infrastructure to Azure
- To preview what changes a deployment will make
- To verify deployment permissions
- Before `azd up`, `azd provision`, or `az deployment` commands

## Key Commands

| Task | Command |
|------|---------|
| Validate Bicep syntax | `bicep build <file> --stdout` |
| azd preview | `azd provision --preview` |
| az what-if (resource group) | `az deployment group what-if -g <rg> -f <file>` |
| az what-if (subscription) | `az deployment sub what-if -l <location> -f <file>` |
| Validate azure.yaml | `azure__azd` → `validate_azure_yaml` |

## Validation Steps

1. **Detect project type** - Check for `azure.yaml` (azd) vs standalone Bicep
2. **Validate azure.yaml** (azd only) - Use `azure__azd` tool
3. **Validate Bicep syntax** - Run `bicep build --stdout`
4. **Run what-if** - `azd provision --preview` or `az deployment * what-if`
5. **Generate report** - Create `preflight-report.md` in project root

## References

- [Validation Process](references/VALIDATION-PROCESS.md) - Complete step-by-step guide
- [Validation Commands](references/VALIDATION-COMMANDS.md) - All CLI commands and options
- [Error Handling](references/ERROR-HANDLING.md) - Common errors and remediation
- [Report Template](references/REPORT-TEMPLATE.md) - Output format specification
