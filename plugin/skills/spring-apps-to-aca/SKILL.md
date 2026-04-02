---
name: spring-apps-to-aca
description: "Migrate Spring Boot apps from Azure Spring Apps or any deployment to Azure Container Apps. WHEN: migrate Spring Boot to Container Apps, Azure Spring Apps to ACA migration, Spring Boot ACA migration assessment, convert Spring Boot JAR to container on ACA, move Spring Boot from VM to Container Apps, migrate existing Spring Boot app, Spring Boot platform migration, replatform Spring Boot to ACA."
license: MIT
metadata:
  version: "1.0.0"
  author: Microsoft
---

# Spring Boot to Azure Container Apps Migration

## Quick Reference

| Item | Details |
|------|---------|
| **Source** | Spring Boot (Azure Spring Apps, on-prem, other cloud) |
| **Target** | Azure Container Apps |
| **Steps** | Assess → Containerize → Deploy → Optimize |

## When to Use This Skill

- Migrate **existing** Spring Boot apps from Azure Spring Apps to Container Apps
- Convert Spring Boot apps running on VMs or other platforms to Container Apps
- Assess migration readiness for Spring Boot workloads moving to Container Apps
- Replatform Spring Boot microservices to Azure Container Apps

## DO NOT USE FOR

- **New Spring Boot deployments** without migration → use `azure-prepare`
- **General application modernization** without platform migration → use `azure-prepare`
- **Cross-cloud migration assessment** (AWS/GCP to Azure) → use `azure-cloud-migrate`
- **Creating new Spring Boot projects** from scratch → use `azure-prepare`
- **AKS or Kubernetes deployments** → use `azure-kubernetes` or `k8s-to-container-apps`

## Rules

1. Complete pre-migration assessment before deployment
2. Never store secrets in application.properties; use Key Vault

## Migration Workflow

**Assess** — Check local state, file system, external resources, platform compatibility ([assessment-guide.md](references/assessment-guide.md))

**Containerize** — Create Dockerfile, build image, push to ACR

**Deploy** — Create environment, configure logging, deploy app ([deployment-guide.md](references/deployment-guide.md))

**Optimize** — Add Spring Cloud components (Eureka, Config Server, Gateway)

## MCP Tools

| Tool | Parameters |
|------|-----------|
| `mcp_azure_mcp_documentation` | `resource: "container-apps"` |
| `mcp_azure_mcp_get_bestpractices` | `resource: "container-apps"`, `action: "deploy"` |

## Error Handling

| Error | Resolution |
|-------|------------|
| Local state issues | Migrate to Azure Cache, Cosmos DB, or Azure SQL |
| File system writes | Use Azure Files storage mounts or Azure Blob Storage |
| Platform incompatibility | Upgrade to Java 17/21, Spring Boot 3.x |

## Completion

Ask: **"Migration complete. Configure Spring Cloud components or set up CI/CD?"**
