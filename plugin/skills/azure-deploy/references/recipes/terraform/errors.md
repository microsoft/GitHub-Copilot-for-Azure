# Terraform Errors

| Error | Resolution |
|-------|------------|
| State lock error | Wait or `terraform force-unlock <lock-id>` |
| Resource exists | `terraform import <resource>` |
| Backend denied | Check storage permissions |
| Provider error | `terraform init -upgrade` |
| Literal `{{ .Env.* }}` in variable values | azd does not interpolate template variables in `.tfvars.json`. Remove the file and use `TF_VAR_*` env vars. See [AZD Errors](../azd/errors.md#unresolved-terraform-template-variables) |
| State cleared on each `azd provision` | azd copies Terraform config to `.azure/<env>/infra/` on each run. Use a remote state backend to persist state across runs |

## Cleanup (DESTRUCTIVE)

```bash
terraform destroy -auto-approve
```

Selective:
```bash
terraform destroy -target=azurerm_container_app.api
```

⚠️ Permanently deletes resources.
