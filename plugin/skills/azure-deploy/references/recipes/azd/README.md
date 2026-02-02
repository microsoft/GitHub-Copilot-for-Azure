# AZD Deploy Recipe

Deploy to Azure using Azure Developer CLI (azd).

## Prerequisites

- `azd` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: azd` if needed
- `.azure/preparation-manifest.md` exists with status `Validated`
- `azure.yaml` exists and validated

## Workflow

| Step | Task | Command |
|------|------|---------|
| 1 | Select environment | `azd env select <name>` |
| 2 | Deploy | `azd up --no-prompt` |
| 3 | Verify | `azd show` |

## Service-Specific Deployment

| Service Type | Reference |
|--------------|-----------|
| Static Web Apps | [static-web-apps.md](static-web-apps.md) |

## Deployment Commands

### Full Deployment

Provisions infrastructure AND deploys application:

```bash
azd up --no-prompt
```

### Infrastructure Only

```bash
azd provision --no-prompt
```

### Application Only

Deploy code to existing infrastructure:

```bash
azd deploy --no-prompt
```

### Single Service

```bash
azd deploy api --no-prompt
```

## References

- [Verification steps](mdc:verify.md)
- [Error handling](mdc:errors.md)
