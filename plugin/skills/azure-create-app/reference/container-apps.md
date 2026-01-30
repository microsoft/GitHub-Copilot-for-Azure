# Azure Container Apps Guide

Deploy containerized apps to Azure Container Apps using azd.

## When to Use

**Container Apps (long-running):** Web apps, APIs, microservices, background workers
**Container Apps Jobs:** Scheduled tasks (cron), batch processing, queue processors

## Prerequisites

- Docker running (`docker ps`)
- azd installed and authenticated (`azd auth login`)
- `AZURE_LOCATION` set (`azd env set AZURE_LOCATION eastus`)

## MCP Tools

| Tool | Command | Purpose |
|------|---------|---------|
| `azure__azd` | `validate_azure_yaml` | Validate config |
| `azure__azd` | `docker_generation` | Generate Dockerfiles |
| `azure__deploy` | `deploy_plan_get` | Generate deployment plan |
| `azure__deploy` | `deploy_iac_rules_get` | Get Bicep rules |

## Workflow

### 1. Initialize
```bash
azd init  # Detects Dockerfile(s) automatically
```

### 2. azure.yaml Structure
```yaml
name: my-app
services:
  web:
    project: ./frontend
    host: containerapp
    docker: { path: ./Dockerfile }
  api:
    project: ./backend
    host: containerapp
```

### 3. Deploy
```bash
azd up --no-prompt
```

## Common Patterns

**Frontend + Backend:**
```yaml
services:
  web: { project: ./frontend, host: containerapp }
  api: { project: ./backend, host: containerapp }
```

**API + Background Job:**
```yaml
services:
  api: { project: ./api, host: containerapp }
  worker: { project: ./worker, host: containerjob }
```

## Scaling

```yaml
services:
  api:
    host: containerapp
    config:
      scale: { minReplicas: 1, maxReplicas: 10 }
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Image pull failed | Use managed identity: `az containerapp registry set --identity system` |
| Cold start slow | Set `minReplicas: 1` |
| 502/503 errors | Verify targetPort matches app port |
| Health probe fails | Add `/health` endpoint returning 200 |

## Resources

[Container Apps Docs](https://learn.microsoft.com/azure/container-apps/) · [azd Templates](https://azure.github.io/awesome-azd/)
