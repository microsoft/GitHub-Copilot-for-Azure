# Recipe Selection

Choose the deployment recipe based on project needs and existing tooling.

## Quick Decision

**Default: AZD** unless specific requirements indicate otherwise.

## Decision Criteria

| Choose | When |
|--------|------|
| **AZD** | New projects, multi-service apps, want simplest deployment (`azd up`) |
| **AZCLI** | Existing az scripts, need imperative control, custom pipelines, AKS |
| **Bicep** | IaC-first approach, no CLI wrapper needed, direct ARM deployment |
| **Terraform** | Multi-cloud requirements, existing TF expertise, state management |

## Auto-Detection

| Found in Workspace | Suggested Recipe |
|--------------------|------------------|
| `azure.yaml` | AZD |
| `*.tf` files | Terraform |
| `infra/*.bicep` (no azure.yaml) | Bicep or AZCLI |
| Existing `az` scripts | AZCLI |
| None | AZD (default) |

## Recipe Comparison

| Feature | AZD | AZCLI | Bicep | Terraform |
|---------|-----|-------|-------|-----------|
| Config file | azure.yaml | scripts | *.bicep | *.tf |
| Deploy command | `azd up` | `az` commands | `az deployment` | `terraform apply` |
| Dockerfile gen | Auto | Manual | Manual | Manual |
| Environment mgmt | Built-in | Manual | Manual | Workspaces |
| CI/CD gen | Built-in | Manual | Manual | Manual |
| Multi-cloud | No | No | No | Yes |
| Learning curve | Low | Medium | Medium | Medium |

## Record Selection

Document in manifest:

```markdown
## Recipe: AZD

**Rationale:**
- New project, no existing IaC
- Multi-service app (API + Web)
- Team wants simplest deployment
```

## Recipe References

- [AZD Recipe](recipes/azd/)
- [AZCLI Recipe](recipes/azcli/)
- [Bicep Recipe](recipes/bicep/)
- [Terraform Recipe](recipes/terraform/)
