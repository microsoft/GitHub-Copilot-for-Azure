# Artifact Generation

Generate infrastructure and configuration files based on selected recipe.

## CRITICAL: Research Before Generating

**DO NOT generate any files without first researching best practices.**

### Research Checklist

1. Load the selected recipe's README.md
2. Follow the recipe's "Before Generation" checklist
3. Apply all researched rules to generated files
4. Document which best practices were applied

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
│   └── preparation-manifest.md
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

## After Generation

1. Update manifest with generated file list
2. Run validation checks
3. Proceed to **azure-validate** skill
