# AZD Deploy Recipe

Deploy to Azure using Azure Developer CLI (azd).

## Prerequisites

- `azd` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: azd` if needed
- `.azure/preparation-manifest.md` exists with status `Validated`
- `azure.yaml` exists and validated
- **Subscription and location confirmed** → See [pre-deploy-checklist.md](../pre-deploy-checklist.md)

## Workflow

| Step | Task | Command |
|------|------|---------|
| 1 | Select environment | `azd env select <name>` |
| 2 | **[Pre-deploy checklist](../pre-deploy-checklist.md)** | Confirm subscription/location with user |
| 3 | Deploy | `azd up --no-prompt` |
| 4 | Verify | `azd show` |

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

- [Azure Functions deployment](mdc:functions-deploy.md)
- [Verification steps](mdc:verify.md)
- [Error handling](mdc:errors.md)
