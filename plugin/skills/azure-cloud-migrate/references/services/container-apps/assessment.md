# Assessment Phase — Container Apps

Generate a migration assessment report before any code or configuration changes.

## Prerequisites

- Workspace contains Dockerfiles, docker-compose files, ECS task definitions, Cloud Run service YAML, or equivalent container specs
- Prompt user to upload relevant files if not present

## Assessment Steps

1. **Identify Containers** — List all container services with images, ports, and resource limits
2. **Analyze Dockerfiles** — Check base images, build stages, exposed ports, entrypoints
3. **Map Cloud Services** — Map source services to Azure equivalents (see scenario references)
4. **Map Networking** — Map load balancers, service discovery, and ingress to Container Apps ingress
5. **Check Dependencies** — List external services (databases, caches, queues) and verify Azure equivalents
6. **Map Secrets** — Identify secrets/env vars and plan Key Vault migration
7. **Map Volumes** — Identify persistent storage needs and map to Azure Files or managed disks
8. **Analyze Multi-Container** — Identify sidecar patterns, init containers, and service mesh usage
9. **Map IAM** — Map task/service roles to Managed Identity + RBAC
10. **Map Monitoring** — Map logging/metrics to Application Insights + Log Analytics
11. **Review CI/CD** — Check pipeline compatibility with Azure DevOps or GitHub Actions

## Image Analysis

For each container image:

| Check | Details |
|-------|---------|
| **Base image** | OS, runtime, version — verify Azure compatibility |
| **Multi-stage build** | Identify build vs runtime stages |
| **Exposed ports** | Map to Container Apps ingress (HTTP/TCP) |
| **ENTRYPOINT/CMD** | Verify compatibility with Container Apps |
| **HEALTHCHECK** | Map to Container Apps health probes |
| **Volume mounts** | Map to Azure Files or ephemeral storage |
| **Build args / ENV** | Map to Container Apps env vars and secrets |
| **Image size** | Flag images > 1GB for optimization |

## Architecture Diagrams

Generate two diagrams:
1. **Current State** — Source architecture with containers, networking, and integrations
2. **Target State** — Azure Container Apps architecture showing equivalent structure

## Assessment Report Format

> ⚠️ **MANDATORY**: Use these exact section headings in every assessment report. Do NOT rename, reorder, or omit sections.

The report MUST be saved as `migration-assessment-report.md` inside the output directory (`<source-folder>-azure/`).

```markdown
# Migration Assessment Report

## 1. Executive Summary

| Property | Value |
|----------|-------|
| **Total Services** | <count> |
| **Source Platform** | <AWS ECS / GCP Cloud Run> |
| **Container Runtime** | <Docker / containerd> |
| **Target Platform** | Azure Container Apps |
| **Target Environment** | Consumption / Dedicated |
| **Migration Readiness** | <High / Medium / Low> |
| **Estimated Effort** | <Low / Medium / High> |
| **Assessment Date** | <date> |

## 2. Container Inventory

| # | Service Name | Image | Port | CPU | Memory | Replicas | Description |
|---|-------------|-------|------|-----|--------|----------|-------------|
| 1 | | | | | | | |

## 3. Service Mapping

| Source Service | Azure Equivalent | Migration Complexity | Notes |
|----------------|------------------|----------------------|-------|
| | | | |

## 4. Networking & Ingress Mapping

| # | Service Name | Source LB/Ingress | Azure Ingress | Protocol | External? | Notes |
|---|-------------|-------------------|---------------|----------|-----------|-------|
| 1 | | | | | | |

## 5. Environment Variables & Secrets

| # | Variable Name | Source | Purpose | Azure Equivalent | Auth Method | Notes |
|---|--------------|--------|---------|------------------|-------------|-------|
| 1 | | | | | Managed Identity / Key Vault | |

## 6. Volume & Storage Mapping

| # | Service | Source Mount | Type | Azure Equivalent | Notes |
|---|---------|------------|------|------------------|-------|
| 1 | | | | Azure Files / Ephemeral | |

## 7. IAM & Security Mapping

| Source Role/Policy | Azure RBAC Role | Scope | Notes |
|--------------------|-----------------|-------|-------|
| | | | |

## 8. Monitoring & Observability Mapping

| Source Service | Azure Equivalent | Migration Notes |
|----------------|------------------|-----------------|
| | | |

## 9. Scaling & Performance

| # | Service | Source Scaling | Azure Scale Rule | Min | Max | Notes |
|---|---------|---------------|------------------|-----|-----|-------|
| 1 | | | HTTP / Queue / Custom | | | |

## 10. Multi-Container Patterns

| # | Service | Pattern | Containers | Azure Approach | Notes |
|---|---------|---------|------------|----------------|-------|
| 1 | | Sidecar / Init | | Container Apps sidecar | |

## 11. Architecture Diagrams

### 11a. Current State (Source)

<!-- Mermaid or ASCII diagram -->

### 11b. Target State (Azure)

<!-- Mermaid or ASCII diagram -->

## 12. CI/CD & Deployment Mapping

| Source Tool | Azure Equivalent | Notes |
|-------------|------------------|-------|
| | | |

## 13. Recommendations

1. **Environment**: <Consumption / Dedicated workload profile>
2. **Registry**: <ACR Basic / Standard / Premium>
3. **IaC Strategy**: <Bicep with azd / Terraform>
4. **Auth Strategy**: <Managed Identity for all service-to-service>
5. **Monitoring**: <Application Insights + Log Analytics>
6. **Networking**: <External / VNet-integrated>

## 14. Next Steps

- [ ] Review and approve this assessment report
- [ ] Proceed to code migration (Phase 2)
- [ ] Hand off to azure-prepare for IaC generation
```

> 💡 **Tip:** Use `mcp_azure_mcp_get_bestpractices` tool to learn Container Apps best practices for the recommendations section.
