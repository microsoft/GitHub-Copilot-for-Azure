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
| **Source** | Self-hosted or managed Kubernetes (GKE, EKS, on-premises) |
| **Target** | Azure Container Apps |
| **Best for** | Stateless microservices, APIs, background workers, event-driven apps |
| **Key Steps** | Export k8s resources → Assess compatibility → Migrate images → Generate IaC → Deploy |
| **MCP Tools** | `mcp_azure_mcp_documentation`, `mcp_azure_mcp_get_bestpractices` |
| **CLI commands** | `kubectl`, `az containerapp`, `az acr` |
| **Docs** | [assessment-guide.md](references/assessment-guide.md), [deployment-guide.md](references/deployment-guide.md) |

## When to Use This Skill

- Migrating Kubernetes workloads from self-hosted clusters, GKE, EKS, or other cloud providers to Azure
- Reducing Kubernetes operational overhead and complexity for containerized applications
- Modernizing microservices, APIs, background workers, or event-driven applications
- Workloads that don't require custom CRDs, operators, hostPath volumes, or direct Kubernetes API access
- Teams seeking managed container hosting with built-in scaling, ingress, and observability

## Rules

1. Follow phases: export k8s resources → assess compatibility → migrate images → generate IaC → deploy
2. Generate compatibility assessment before migration; never modify source k8s cluster
3. Require user confirmation for destructive actions; create output `<cluster-name>-azure/`

## Required Inputs

kubectl access to source cluster, namespace(s) to migrate, target Azure subscription/resource group/region, ACR name

## Migration Workflow

**Phase 1: Export Resources** — Export Deployments, Services, Ingress, ConfigMaps, Secrets ([deployment-guide.md](references/deployment-guide.md))

**Phase 2: Assess Compatibility** — Map k8s resources to Container Apps equivalents; identify blockers ([assessment-guide.md](references/assessment-guide.md))

**Phase 3: Image Migration** — Push images to ACR or import from source registry

**Phase 4: Generate IaC** — Convert k8s YAML to Bicep with Deployment→ContainerApp, Service→Ingress mapping

**Phase 5: Deploy & Validate** — Deploy, verify endpoints, compare behavior, migrate traffic gradually

## MCP Tools

| Tool | Parameters | Required | Example |
|------|-----------|----------|---------|
| `mcp_azure_mcp_documentation` | `resource: "container-apps"` | Yes | `await mcp_azure_mcp_documentation({resource: "container-apps", topic: "ingress"})` |
| `mcp_azure_mcp_get_bestpractices` | `resource: "container-apps"`, `action: "deploy"` | Yes | `await mcp_azure_mcp_get_bestpractices({resource: "container-apps", action: "deploy"})` |

## Error Handling

| Error | Message Contains | Resolution |
|-------|------------------|------------|
| Image pull failure | "unauthorized" | Run `az containerapp registry set --server <acr>.azurecr.io --identity system` |
| Port mismatch | "502" / "503" | Verify `targetPort` matches app's listen port and Dockerfile EXPOSE |
| OOM / resource limits | "OutOfMemory" | Reduce to ≤4 vCPU and ≤8 GiB per container |
| DNS resolution | "name resolution failed" | Use `APP_NAME.internal.ENVIRONMENT.REGION.azurecontainerapps.io` for internal calls |

## Completion

Ask: **"Migration complete. Run validation tests or configure monitoring?"**
