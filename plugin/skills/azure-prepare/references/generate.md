# Artifact Generation

Generate infrastructure and configuration files based on selected recipe.

## CRITICAL: Research Must Be Complete

**DO NOT generate any files without first completing the [Research Components](research.md) step.**

The research step loads service-specific references and invokes related skills to gather best practices. Apply all research findings to generated artifacts.

## Research Checklist

1. ✅ Completed [Research Components](research.md) step
2. ✅ Loaded all relevant `services/*.md` references
3. ✅ Invoked related skills for specialized guidance
4. ✅ Documented findings in manifest

## Generation Order

| Order | Artifact | Notes |
|-------|----------|-------|
| 1 | Application config (azure.yaml) | AZD only—defines services and hosting |
| 2 | Application code scaffolding | Entry points, health endpoints, config |
| 3 | Dockerfiles | If containerized |
| 4 | Infrastructure (Bicep/Terraform) | IaC templates in `./infra/` |
| 5 | CI/CD pipelines | If requested |

## Recipe-Specific Generation

Load the appropriate recipe for detailed generation steps:

| Recipe | Reference |
|--------|-----------|
| AZD | [recipes/azd/](recipes/azd/) |
| AZCLI | [recipes/azcli/](recipes/azcli/) |
| Bicep | [recipes/bicep/](recipes/bicep/) |
| Terraform | [recipes/terraform/](recipes/terraform/) |

## Common Standards

### File Structure

```
project-root/
├── .azure/
│   └── plan.md
├── infra/
│   ├── main.bicep (or main.tf)
│   └── modules/
├── src/
│   └── <component>/
│       └── Dockerfile
└── azure.yaml (AZD only)
```

### Security Requirements

- No hardcoded secrets
- Use Key Vault for sensitive values
- Managed Identity for service auth
- HTTPS only, TLS 1.2+

### Runtime Configuration

Apply language-specific production settings for containerized apps:

| Runtime | Reference |
|---------|-----------|
| Node.js/Express | [runtimes/nodejs.md](runtimes/nodejs.md) |

## After Generation

1. Update manifest with generated file list
2. Run validation checks
3. Proceed to **azure-validate** skill
