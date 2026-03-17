# Error Handling

| Error | Message | Remediation |
|---|---|---|
| MCP tool unreachable | Tool call timeout or connection error | Retry once; if still failing, fall back to reference files and warn user that guidance may be stale |
| WAF guide fetch failed | Sub-agent returns empty or error | Skip that service guide, note the gap in plan reasoning, continue with remaining services |
| Bicep schema unavailable | `bicepschema_get` returns no result | Use reference files for ARM type and properties; warn user to verify generated IaC |
| Plan approval missing | `meta.status` is not `approved` | Stop and prompt user for approval before IaC generation or deployment |
| Bicep build failure | `az bicep build` returns errors | Show errors to user, fix the generated Bicep, and re-validate |
| Terraform validate failure | `terraform validate` returns errors | Show errors to user, fix the generated Terraform, and re-validate |
| Deployment failure | `az deployment create` or `terraform apply` fails | Present the error, suggest fixes (SKU availability, quota, naming conflict), and retry after user confirms |
| Pairing constraint violation | Incompatible SKU or resource combination | Flag in verification (Phase 4), fix in plan before proceeding to IaC generation |
