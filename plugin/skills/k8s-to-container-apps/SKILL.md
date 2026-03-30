---
name: k8s-to-container-apps
description: "Migrate containerized workloads from Kubernetes clusters (self-hosted, GKE, EKS, on-premises) to Azure Container Apps with compatibility assessment and deployment automation. WHEN: migrate Kubernetes to Azure, move k8s workloads to Container Apps, reduce Kubernetes operational overhead, convert k8s deployments to ACA, migrate from GKE/EKS to Azure, simplify container orchestration."
license: MIT
metadata:
  version: "1.0.0"
  author: Microsoft
---

# Kubernetes to Azure Container Apps Migration

## Quick Reference

| Item | Details |
|------|---------|
| **Source** | k8s (GKE, EKS, self-hosted) |
| **Target** | Azure Container Apps |
| **Steps** | Export → Assess → Migrate images → Deploy |

## When to Use This Skill

- Migrate k8s from GKE/EKS/on-premises to Azure
- Reduce k8s operational overhead
- Workloads without custom CRDs/operators

## Rules

1. Export → assess → migrate → deploy
2. Never modify source cluster

## Migration Workflow

**Export** — Export Deployments, Services, ConfigMaps, Secrets

**Assess** — Map to Container Apps ([assessment-guide.md](references/assessment-guide.md))

**Images** — Push to ACR

**IaC** — Convert to Bicep

**Deploy** — Deploy & verify ([deployment-guide.md](references/deployment-guide.md))

## MCP Tools

| Tool | Parameters |
|------|-----------|
| `mcp_azure_mcp_documentation` | `resource: "container-apps"` |
| `mcp_azure_mcp_get_bestpractices` | `resource: "container-apps"`, `action: "deploy"` |

## Error Handling

| Error | Resolution |
|-------|------------|
| Image pull | `az containerapp registry set --identity system` |
| Port mismatch | Verify `targetPort` matches app port |
| OOM | Reduce to ≤4 vCPU, ≤8 GiB |

## Completion

Ask: **"Migration complete. Run validation or configure monitoring?"**
