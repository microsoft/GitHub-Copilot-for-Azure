```markdown
# Private Network Standard Agent Setup with User-Assigned Identity (UAI)

> **MANDATORY:** Read [Standard Agent Setup with Network Isolation docs](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project) before proceeding.

## Overview

Extends [Private Network Standard Agent Setup](private-network-standard-agent-setup.md) by using a **User-Assigned Managed Identity (UAI)** instead of a System-Assigned Managed Identity for the AI Services resource. All other resources and networking are identical to template 15.

## Key Difference from Template 15

| Feature | Template 15 | Template 17 (this) |
|---------|-------------|---------------------|
| Identity type | System-assigned | **User-assigned** |
| Identity lifecycle | Tied to the resource | Independent — survives resource recreation |
| Cross-resource identity | Each resource has its own | Single identity shared across resources |

Use UAI when enterprise policy requires pre-provisioned identities, when the identity must survive resource teardown/recreation, or when a single identity must be shared across multiple Foundry resources.

## Networking

Two subnets required (same as template 15):

| Subnet | CIDR | Purpose | Delegation |
|--------|------|---------|------------|
| Agent Subnet | /24 (e.g., 192.168.0.0/24) | Agent workloads | `Microsoft.App/environments` (exclusive) |
| PE Subnet | /24 (e.g., 192.168.1.0/24) | Private endpoints | None |

All resources communicate over private network only via private endpoints.

## When to Use

- User needs private network agent setup **with a pre-provisioned or shared user-assigned managed identity**
- Enterprise policy prohibits system-assigned identities
- Identity must persist independently of the AI Services resource lifecycle

## When NOT to Use

- System-assigned identity is acceptable → use [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
- APIM integration needed → use [Private Network APIM Agent Setup](private-network-standard-agent-apim-setup.md)

## Deployment

**Always use the official Bicep template:**
[Private Network UAI Agent Setup Bicep](https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/17-private-network-standard-user-assigned-identity-agent-setup)

Supports the same BYO parameters as template 15 (existing VNet, Cosmos DB, AI Search, Storage) plus it creates a User-Assigned Managed Identity automatically.

> ⚠️ **Warning:** Capability host provisioning is **asynchronous** (10–20 minutes). Poll deployment status until success before proceeding.

## Post-Deployment

1. **Deploy a model** to the new AI Services account (e.g., `gpt-4o`). Fall back to `Standard` SKU if `GlobalStandard` quota is exhausted.
2. **Create the agent** using MCP tools (`agent_update`) or the Python SDK.

## References

- [Azure AI Foundry Networking](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project)
- [Managed Identities for Azure Resources](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
- [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
```
