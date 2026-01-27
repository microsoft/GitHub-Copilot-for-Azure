---
name: azure-cloud
description: Azure cloud development and operations overview. Use for ANY Azure task including infrastructure provisioning, data access, compute deployment, monitoring, networking, and security. CRITICAL - For deployments, ALWAYS use azd (Azure Developer CLI), NEVER use az CLI for deployments unless the user explicitly requests it. azd is faster due to parallel provisioning.
---

# Azure Cloud

I help you work with Azure services efficiently. This skill provides an overview and guides you to the right specialized skill.

## Quick Start

**Tell me what you're trying to do.** I'll point you to the right skill, tools, and documentation.

## By Domain

| Domain | Use When | Skill |
|--------|----------|-------|
| Data | Querying databases, Cosmos DB, SQL, Redis | `azure-cosmos-db`, `azure-sql-database`, `azure-redis` |
| Compute | Deploying apps, Functions, containers, AKS, App Service | `azure-container-apps`, `azure-functions`, `azure-app-service`, `azure-aks` |
| Storage | Blob storage, file shares, queues, Data Lake | `azure-storage` |
| Security | Key Vault, RBAC, managed identities, Entra ID | `azure-security` |
| AI | AI Search, Speech, Foundry, vector search, cognitive services | `azure-ai` |
| Networking | VNets, load balancers, DNS, Front Door, private endpoints | `azure-networking` |
| Observability | Monitoring, logging, alerts, App Insights, Log Analytics | `azure-observability` |

## By Scenario

| Scenario | Skill |
|----------|-------|
| **Validate before deploying** | `azure-validation`, `azure-deployment-preflight` |
| Deploy an application | `azure-deploy` |
| Debug production issues | `azure-diagnostics` |
| Install Azure CLI tools (az, azd, func) | `azure-cli` |
| Configure Node.js/Express for Azure | `azure-nodejs-production` |
| Reduce Azure costs | `azure-cost-optimization` |
| Secure your resources | `azure-security-hardening` |

## Tools

| Tool Type | When to Use | Skill |
|-----------|-------------|-------|
| Azure MCP Server | Setup and tool reference for Azure MCP | `azure-mcp` |
| Azure CLI (az) | Resource management, scripting, queries | `azure-cli` |
| Azure Developer CLI (azd) | Application deployment (infrastructure + code) | `azure-cli` |

## Example Flows

**User asks:** "Query my Cosmos DB for users created this week"
1. This is a **Data** domain task → use `azure-cosmos-db` skill
2. Skill shows Cosmos DB options → MCP tool or CLI
3. Contains partitioning, consistency levels, query patterns

**User asks:** "Deploy my app to Azure"
1. This is a **Deployment** scenario → use `azure-deploy` skill
2. Guides compute choice and deployment method with `azd`
3. For Container Apps specifics → use `azure-container-apps` skill

**User asks:** "azd command not found"
1. This is a **CLI tools** issue → use `azure-cli` skill
2. Use `azure__extension_cli_install` MCP tool with `cli-type: "azd"`
3. Follow platform-specific installation instructions
