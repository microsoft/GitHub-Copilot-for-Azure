# AZD Recipe

Azure Developer CLI workflow for preparing Azure deployments.

## When to Use

- New projects, multi-service apps, want `azd up`
- Need environment management, auto-generated CI/CD

## Before Generation

**REQUIRED: Research best practices before generating any files.**

| Artifact | Reference |
|----------|-----------|
| azure.yaml | [azure-yaml.md](azure-yaml.md) |
| AZD IAC rules | [iac-rules.md](iac-rules.md) |
| Bicep best practices | `mcp_bicep_get_bicep_best_practices` |
| Bicep resource schema | `mcp_bicep_get_az_resource_type_schema` |
| Azure Verified Modules | `mcp_bicep_list_avm_metadata` |
| Dockerfiles | [docker.md](docker.md) |

## Generation Steps

| # | Artifact | Reference |
|---|----------|-----------|
| 1 | azure.yaml | [azure-yaml.md](azure-yaml.md) |
| 2 | Application code | Entry points, health endpoints, config |
| 3 | Dockerfiles | [docker.md](docker.md) (if containerized) |
| 4 | Infrastructure | `./infra/main.bicep` + modules per [iac-rules.md](iac-rules.md) |

## Outputs

| Artifact | Path |
|----------|------|
| azure.yaml | `./azure.yaml` |
| App Code | `src/<service>/*` |
| Dockerfiles | `src/<service>/Dockerfile` (if containerized) |
| Infrastructure | `./infra/` |

## References

- [azure.yaml schema](mdc:azure-yaml.md)
- [Docker configuration](mdc:docker.md)
- [IAC rules](mdc:iac-rules.md)

## Next

→ Update manifest → **azure-validate**
