---
name: azure-create-app
description: Create Azure-ready app configurations using Azure Developer CLI (azd). Use for "prepare for Azure", "create azure.yaml", "azd init".
---

# Azure Create App

Generate Azure deployment configuration using Azure Developer CLI (azd).

## Execution Flow

### 1. Check State
- `azure.yaml` exists → Already configured (offer to regenerate or deploy)
- `azd-arch-plan.md` exists → Resume from incomplete phase
- Neither → Start discovery

### 2. Discovery
Call `azure__azd` MCP with `discovery_analysis` → Scans files, identifies languages/frameworks, creates `azd-arch-plan.md`

### 3. Architecture Planning
Call `azure__azd` MCP with `architecture_planning` → Selects Azure services, updates plan

### 4. Generate Files
Call sequentially:
1. `iac_generation_rules` - Get Bicep rules
2. `docker_generation` - Dockerfiles (if containerizing)
3. `infrastructure_generation` - Bicep templates
4. `azure_yaml_generation` - azure.yaml

**Output:** `azure.yaml`, `infra/main.bicep`, `infra/main.parameters.json`

### 5. Validation (Required)
Call `azure__azd` with `project_validation` → Must pass before deploying

### 6. Complete
Ready to deploy → Use `azure-deploy` skill

## References

| Guide | Purpose |
|-------|---------|
| [app-type-detection.md](./reference/app-type-detection.md) | Identify app types |
| [service-selection.md](./reference/service-selection.md) | Azure service mapping |
| [azure-yaml-config.md](./reference/azure-yaml-config.md) | Config reference |
| [static-web-apps.md](./reference/static-web-apps.md) | SWA details |
| [container-apps.md](./reference/container-apps.md) | Container Apps |
| [functions.md](./reference/functions.md) | Functions |
| [app-service.md](./reference/app-service.md) | App Service |
| [aks.md](./reference/aks.md) | AKS details |