# Terraform Recipe

Terraform workflow for Azure deployments.

> ⛔ **PURE TERRAFORM — Do NOT create `azure.yaml`**
>
> This recipe generates **only** Terraform (`.tf`) files. `azure.yaml` is an azd configuration file and **must NOT be created** for pure Terraform projects. If you create `azure.yaml`, you are using the wrong recipe.
>
> → If you want azd + Terraform (which produces `azure.yaml`), use the [AZD+Terraform recipe](../azd/terraform.md) instead.

> **⚠️ IMPORTANT: Consider azd+Terraform First**
>
> If you're deploying to Azure and have not explicitly requested pure Terraform, you should consider **[azd with Terraform](../azd/terraform.md)** instead. azd+Terraform gives you:
> - Terraform's IaC capabilities
> - Simple `azd up` deployment workflow
> - Built-in environment management
> - Automatic CI/CD pipeline generation
> - Service orchestration from azure.yaml
>
> → **See [azd+Terraform documentation](../azd/terraform.md)** ←

## When to Use Pure Terraform (Without azd)

Only use pure Terraform workflow when you have specific requirements that prevent using azd:

- **Multi-cloud deployments** where Azure is not the primary target
- **Complex Terraform modules/workspaces** that are incompatible with azd conventions
- **Existing Terraform CI/CD** pipelines that are hard to migrate
- **Organization mandate** for pure Terraform workflow without any wrapper tools
- **Explicitly requested** by the user to use "pure Terraform", "Terraform without azd", or "Terraform as the infrastructure provider"

## When to Use azd+Terraform Instead

Use azd+Terraform (the default) when:

- **Azure-first deployment** (even if you want multi-cloud IaC)
- Want **`azd up` simplicity** with Terraform IaC
- **Multi-service apps** needing orchestration
- Team wants to learn Terraform with a simpler workflow

→ See [azd+Terraform documentation](../azd/terraform.md)

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

> ⛔ **`azure.yaml` must NOT exist** — Pure Terraform projects do not use azd and must not have an `azure.yaml` file. If you produced one, delete it and reconsider whether you should use the [AZD+Terraform recipe](../azd/terraform.md).

## References

- [Terraform Patterns](patterns.md)

## Next

→ Update `.azure/deployment-plan.md` → **azure-validate**
