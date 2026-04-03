---
name: gcp-cloudrun-to-container-apps
description: "Migrate containerized workloads from Google Cloud Run to Azure Container Apps with assessment reports and deployment guidance. WHEN: migrate Cloud Run to Container Apps, migrate Cloud Run to Azure, convert Cloud Run services to ACA, move from Cloud Run to Azure Container Apps, Cloud Run to ACA migration assessment, migrate GCP Cloud Run workloads to Azure, assess Cloud Run to Container Apps migration, Cloud Run migration planning. DO NOT USE FOR: general GCP-to-Azure migration (use azure-cloud-migrate), new Container Apps deployments without migration (use azure-prepare), GKE or Kubernetes migration (use k8s-to-container-apps)."
license: MIT
metadata:
  version: "1.0.0"
  author: Microsoft
---

# Google Cloud Run to Azure Container Apps Migration

## Quick Reference

| Item | Details |
|------|---------|
| **Best for** | Migrating existing Cloud Run services to Azure Container Apps |
| **Source** | Google Cloud Run services |
| **Target** | Azure Container Apps |
| **Key Steps** | Assess → Migrate images → Configure → Deploy |
| **MCP Tools** | `mcp_azure_mcp_documentation`, `mcp_azure_mcp_get_bestpractices` |
| **CLI Commands** | `gcloud run services list`, `az acr import`, `az containerapp create` |
| **Docs** | [assessment-guide.md](references/assessment-guide.md), [deployment-guide.md](references/deployment-guide.md) |

## When to Use This Skill

Migrate serverless container workloads from GCP Cloud Run to Azure Container Apps. Use when moving GCP projects to Azure or consolidating multi-cloud deployments.

## Rules

1. Follow phases: assessment → image migration → configuration → deployment
2. Generate assessment report before changes; create `<source-folder>-azure/` output
3. Never modify source GCP files; require confirmation for destructive actions

## Required Inputs

Cloud Run config location, target subscription/resource group/region, networking (VNet yes/no), scaling (min/max replicas)

## Migration Workflow

**Phase 1: Assessment** — Analyze config, dependencies ([assessment-guide.md](references/assessment-guide.md))

**Phase 2: Image Migration** — Pull from GCR/Artifact Registry → push to ACR

**Phase 3: Configuration** — Convert YAML, map secrets to Key Vault, create IaC

**Phase 4: Deployment** — Deploy Container Apps, configure ingress/scaling ([deployment-guide.md](references/deployment-guide.md))

## MCP Tools

| Tool | Parameters | Required | Example |
|------|-----------|----------|---------|
| `mcp_azure_mcp_documentation` | `resource: "container-apps"` | Yes | `await mcp_azure_mcp_documentation({resource: "container-apps", topic: "ingress"})` |
| `mcp_azure_mcp_get_bestpractices` | `resource: "container-apps"`, `action: "deploy"` | Yes | `await mcp_azure_mcp_get_bestpractices({resource: "container-apps", action: "deploy"})` |

## Error Handling

| Error | Message Contains | Resolution |
|-------|------------------|------------|
| ACR auth | "unauthorized" | Run `az acr login --name <acr>` |
| Key Vault access | "forbidden" | Grant managed identity Key Vault secrets permissions |
| Env creation | "already exists" | Use existing env or choose new name |
| Image pull | "manifest unknown" | Verify image tag and ACR credentials |

## Completion

Ask: **"Migration complete. Test or optimize costs?"**
