---
name: k8s-to-container-apps
description: "Migrate containerized workloads from existing Kubernetes clusters (self-hosted, GKE, EKS, on-premises) to Azure Container Apps with compatibility assessment and deployment automation. WHEN: migrate Kubernetes to Container Apps, convert k8s manifests to ACA, move from GKE to Azure Container Apps, move from EKS to Azure Container Apps, migrate k8s deployments to Azure, reduce Kubernetes operational overhead, k8s to ACA migration assessment. DO NOT USE FOR: new Container Apps deployments without migration (use azure-prepare), AKS cluster management (use azure-kubernetes), general cross-cloud migration (use azure-cloud-migrate)."
license: MIT
metadata:
  version: "1.0.0"
  author: Microsoft
---

# Kubernetes to Azure Container Apps Migration

## Quick Reference

| Item | Details |
|------|---------|
| **Best for** | Migrating existing k8s workloads (GKE, EKS, self-hosted) to Azure Container Apps |
| **Source** | Kubernetes (GKE, EKS, AKS, on-premises) |
| **Target** | Azure Container Apps |
| **Steps** | Export k8s resources → Assess compatibility → Migrate images to ACR → Generate IaC → Deploy & verify |
| **MCP Tools** | `mcp_azure_mcp_documentation`, `mcp_azure_mcp_get_bestpractices` |
| **CLI Commands** | `kubectl get`, `az acr import`, `az containerapp create` |
| **Docs** | [assessment-guide.md](references/assessment-guide.md), [deployment-guide.md](references/deployment-guide.md) |

## When to Use This Skill

Use this skill when:
- Migrating existing Kubernetes workloads from GKE, EKS, or self-hosted clusters to Azure Container Apps
- Converting k8s manifests (Deployment, Service, ConfigMap, Secret) to Container Apps configuration
- Reducing Kubernetes operational overhead for stateless workloads
- Moving containerized microservices, APIs, or background workers from k8s to managed container platform
- Assessing k8s compatibility with Container Apps platform constraints

**Do NOT use for:**
- New Container Apps deployments without an existing k8s source (use **azure-prepare**)
- AKS cluster management or AKS workload operations (use **azure-kubernetes**)
- General cross-cloud migration planning (use **azure-cloud-migrate**)

## Rules

1. Follow sequential workflow: Export → Assess → Migrate → Deploy
2. Never modify source Kubernetes cluster during migration
3. Create assessment report before making infrastructure changes
4. Use managed identity for ACR and Key Vault access
5. Validate each phase before proceeding to next

## Migration Workflow

Follow these numbered phases in sequence:

**Phase 1: Export Kubernetes Resources**
- Export Deployments, Services, Ingress, ConfigMaps, Secrets using `kubectl get` commands
- Save manifests to local directory for analysis
- Document current cluster configuration

**Phase 2: Assess Compatibility**
- Map k8s concepts to Container Apps equivalents
- Identify blockers (StatefulSets, DaemonSets, custom CRDs)
- Check resource limits (max 4 vCPU, 8 GiB per container)
- Review [assessment-guide.md](references/assessment-guide.md)

**Phase 3: Migrate Container Images**
- Import images from source registry to Azure Container Registry
- Use `az acr import` for efficient cross-registry transfer
- Tag images appropriately

**Phase 4: Generate Infrastructure as Code**
- Convert k8s YAML to Azure Bicep templates
- Map Deployment → Container App, Service → Ingress, ConfigMap/Secret → Key Vault
- Create Container Apps Environment with Log Analytics

**Phase 5: Deploy and Verify**
- Deploy Container Apps with managed identity
- Configure ingress, scaling rules, and environment variables
- Validate deployment and test endpoints
- Follow [deployment-guide.md](references/deployment-guide.md)

**Phase 6: Testing and Validation**
- Run health checks and smoke tests
- Verify application functionality matches k8s behavior
- Monitor logs and metrics in Azure Monitor

## MCP Tools

| Tool | Parameters (Required/Optional) | Example |
|------|-------------------------------|---------|
| `mcp_azure_mcp_documentation` | `resource` (Required): "container-apps" | `mcp_azure_mcp_documentation({resource: "container-apps"})` |
| `mcp_azure_mcp_get_bestpractices` | `resource` (Required): "container-apps"<br>`action` (Required): "deploy", "networking", "security" | `mcp_azure_mcp_get_bestpractices({resource: "container-apps", action: "deploy"})` |

## Error Handling

| Error | Message/Pattern | Resolution |
|-------|----------------|------------|
| Image pull failure | `Failed to pull image`, `ErrImagePull` | Verify ACR access with `az acr check-health --name <acr-name>`. Ensure managed identity has AcrPull role: `az role assignment create --assignee <principal-id> --role AcrPull --scope <acr-id>` |
| Port mismatch (502/503) | `Bad Gateway`, `Service Unavailable` | Verify `--target-port` matches the port your app listens on. Check Dockerfile EXPOSE directive and app configuration |
| OOM / Memory exceeded | `OOMKilled`, Container restart loop | Reduce container resources to ≤4 vCPU and ≤8 GiB. Consider splitting into multiple containers or optimizing app memory usage |
| Key Vault access denied | `Forbidden`, `Key Vault operation failed` | Ensure managed identity has "Key Vault Secrets User" role on Key Vault: `az role assignment create --assignee <principal-id> --role "Key Vault Secrets User" --scope <kv-id>` |
| DNS resolution fails | Internal service unavailable | Use internal FQDN format: `<app-name>.internal.<env-name>.<region>.azurecontainerapps.io` for app-to-app calls within same environment |

## Completion

Ask: **"Migration complete. Would you like to configure monitoring, set up CI/CD pipelines, or run performance validation?"**
