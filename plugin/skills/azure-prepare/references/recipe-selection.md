# Recipe Selection Guide

How to choose the right recipe for the Prepare → Validate → Deploy workflow.

## Quick Decision

**Default to AZD** unless you have a specific reason to use another recipe.

## Decision Criteria

### Choose AZD Recipe When:

- ✅ Starting a new Azure project
- ✅ Want simplest deployment experience (`azd up`)
- ✅ Multi-service applications (API + Web + Worker)
- ✅ Need environment management (dev/staging/prod)
- ✅ Want generated CI/CD pipelines
- ✅ No existing IaC in project

### Choose Bicep Recipe When:

- Organization standardized on Bicep without AZD
- Existing `az deployment` pipelines
- Need direct ARM deployment control
- Custom deployment orchestration requirements
- Already have Bicep modules to reuse

### Choose Terraform Recipe When:

- Existing Terraform codebase in project
- Team expertise is Terraform
- Multi-cloud deployment requirements
- Need Terraform state management features
- Organization mandate for Terraform

## Auto-Detection Signals

During workspace analysis, look for these indicators:

| Found in Workspace | Suggested Recipe |
|--------------------|------------------|
| `azure.yaml` | AZD (already configured) |
| `*.tf` files | Terraform |
| `./infra/*.bicep` (no azure.yaml) | Bicep |
| None of above | AZD (default) |

## Recipe Comparison

| Feature | AZD | Bicep | Terraform |
|---------|-----|-------|-----------|
| Config file | azure.yaml | *.bicep | *.tf |
| Deploy command | `azd up` | `az deployment` | `terraform apply` |
| Dockerfile generation | ✅ Automatic | ❌ Manual | ❌ Manual |
| Environment management | ✅ Built-in | ❌ Manual | ✅ Workspaces |
| CI/CD generation | ✅ Built-in | ❌ Manual | ❌ Manual |
| Multi-cloud | ❌ Azure only | ❌ Azure only | ✅ Yes |
| State management | Azure | Azure | Configurable |
| Learning curve | Low | Medium | Medium |

## Recording Selection

After selection, record in Preparation Manifest:

```markdown
## Recipe: AZD

### Selection Rationale
- New project, no existing IaC
- Multi-service app (API + Web)
- Team wants simplest deployment
```

## Changing Recipe Later

Switching recipes mid-project requires:

1. Regenerating infrastructure files
2. Potentially restructuring project
3. Updating CI/CD pipelines

**Recommendation**: Commit to a recipe early and stick with it.
