---
name: gcp-cloudrun-to-container-apps
description: "Migrate Cloud Run to Azure Container Apps with assessment and deployment. WHEN: migrate Cloud Run to Container Apps, Cloud Run to Azure, convert Cloud Run to ACA, Cloud Run migration. DO NOT USE FOR: general GCP migration (use azure-cloud-migrate), new Container Apps (use azure-prepare), Kubernetes (use k8s-to-container-apps)."
license: MIT
metadata:
  version: "1.0.0"
  author: Microsoft
---

# Google Cloud Run to Azure Container Apps

## Quick Reference

| Item | Details |
|------|---------|
| **Source/Target** | Cloud Run → Container Apps |
| **Steps** | Assess → Images → Config → Deploy |
| **Tools** | `gcloud`, `az acr`, `az containerapp` |
| **Docs** | [assessment-guide.md](references/assessment-guide.md), [deployment-guide.md](references/deployment-guide.md) |

## When to Use This Skill

Migrate Cloud Run serverless containers to Azure Container Apps.

## Rules

1. Follow: assessment → images → config → deployment
2. Create assessment report; output to `<source>-azure/`
3. Never modify source GCP files

## Inputs

Cloud Run location, target sub/RG/region, VNet (yes/no), scaling (min/max)

## Migration Workflow

**Phase 1: Assessment** — Analyze config ([assessment-guide.md](references/assessment-guide.md))

**Phase 2: Images** — GCR/Artifact Registry → ACR

**Phase 3: Config** — Convert YAML, secrets → Key Vault, IaC

**Phase 4: Deploy** — Container Apps, ingress/scaling ([deployment-guide.md](references/deployment-guide.md))

## MCP Tools

- `mcp_azure_mcp_documentation({resource: "container-apps"})`
- `mcp_azure_mcp_get_bestpractices({resource: "container-apps"})`

## Error Handling

| Error | Fix |
|-------|-----|
| ACR unauthorized | `az acr login` |
| Key Vault forbidden | Grant managed identity access |
| Env exists | Use existing or rename |

## Done

Ask: **"Test or optimize costs?"**
