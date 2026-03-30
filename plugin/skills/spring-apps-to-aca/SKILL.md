---
name: spring-apps-to-aca
description: "Migrate Spring Boot applications from Azure Spring Apps or any Spring Boot deployment to Azure Container Apps with pre-migration assessment, deployment automation, and cloud-native optimization. WHEN: migrate Spring Boot to Container Apps, move Azure Spring Apps to ACA, modernize Spring applications, containerize Spring Boot, migrate microservices to Azure."
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

- Migrate Spring Boot from Azure Spring Apps to Container Apps
- Modernize Spring applications with cloud-native patterns
- Reduce operational overhead for Spring microservices

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
| Platform incompatibility | Upgrade to Java 8/11/17/21, Spring Boot 3.x |

## Completion

Ask: **"Migration complete. Configure Spring Cloud components or set up CI/CD?"**
