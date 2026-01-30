# Terraform Recipe

Terraform workflow for Azure deployments.

## When to Use

- Multi-cloud requirements
- Existing Terraform expertise
- State management features needed
- Organization mandate for Terraform

## Before Generation

**REQUIRED: Research best practices before generating any files.**

| Artifact | Research Action |
|----------|-----------------|
| Terraform patterns | Call `mcp_azure_mcp_azureterraformbestpractices` |
| Azure best practices | Call `mcp_azure_mcp_get_bestpractices` |

## Generation Steps

### 1. Generate Infrastructure

Create Terraform files in `./infra/`.

→ [patterns.md](patterns.md)

**Structure:**
```
infra/
├── main.tf
├── variables.tf
├── outputs.tf
├── terraform.tfvars
├── backend.tf
└── modules/
    └── ...
```

### 2. Set Up State Backend

Azure Storage for remote state.

### 3. Generate Dockerfiles (if containerized)

Manual Dockerfile creation required.

## Output Checklist

| Artifact | Path |
|----------|------|
| Main config | `./infra/main.tf` |
| Variables | `./infra/variables.tf` |
| Outputs | `./infra/outputs.tf` |
| Values | `./infra/terraform.tfvars` |
| Backend | `./infra/backend.tf` |
| Modules | `./infra/modules/` |
| Dockerfiles | `src/<service>/Dockerfile` |

## References

- [Terraform patterns](mdc:patterns.md)

## Next

→ Update manifest → **azure-validate**
