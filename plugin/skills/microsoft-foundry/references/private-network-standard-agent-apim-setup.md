```markdown
# Private Network Standard Agent Setup with APIM (Preview)

> **MANDATORY:** Read [Standard Agent Setup with Network Isolation docs](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project) before proceeding. This template is a **preview** feature — code-first experience only, no Foundry UI support.

## Overview

Extends [Private Network Standard Agent Setup](private-network-standard-agent-setup.md) with **Azure API Management (APIM)** integration behind a private endpoint. All other resources and networking are identical to template 15. Use this when agents need to call APIs managed by APIM within the private VNet boundary.

## Key Difference from Template 15

| Feature | Template 15 | Template 16 (this) |
|---------|-------------|---------------------|
| APIM integration | ❌ | ✅ Optional — provide existing APIM resource ID |
| APIM private endpoint | ❌ | ✅ Gateway PE + DNS zone (`privatelink.azure-api.net`) |
| Status | GA | **Preview** |

Everything else — VNet layout, BYO resources (Cosmos DB, Storage, AI Search), RBAC, subnet delegation, capability host — is the same as the standard private network template.

## Networking

Two subnets required (same as template 15):

| Subnet | CIDR | Purpose | Delegation |
|--------|------|---------|------------|
| Agent Subnet | /24 (e.g., 192.168.0.0/24) | Agent workloads | `Microsoft.App/environments` (exclusive) |
| PE Subnet | /24 (e.g., 192.168.1.0/24) | Private endpoints | None |

Private endpoints are created for AI Foundry, AI Search, Storage, Cosmos DB, **and APIM (if provided)**.

## When to Use

- User needs private network agent setup **and** wants agents to call APIs through APIM within the VNet
- Enterprise API gateway pattern with private agent workloads

## When NOT to Use

- No APIM requirement → use [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
- User-assigned identity needed → use [Private Network UAI Agent Setup](private-network-uai-agent-setup.md)

## Deployment

**Always use the official Bicep template:**
[Private Network Standard Agent APIM Setup Bicep](https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/16-private-network-standard-agent-apim-setup-preview)

To integrate APIM, pass the existing APIM resource ID:
```
param apiManagementResourceId string = '/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{name}'
```

> ⚠️ **Warning:** Capability host provisioning is **asynchronous** (10–20 minutes). Poll deployment status until success before proceeding.

## Post-Deployment

1. **Deploy a model** to the new AI Services account (e.g., `gpt-4o`). Fall back to `Standard` SKU if `GlobalStandard` quota is exhausted.
2. **Create the agent** using MCP tools (`agent_update`) or the Python SDK.

## References

- [Azure AI Foundry Networking](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project)
- [Azure API Management Private Endpoints](https://learn.microsoft.com/en-us/azure/api-management/private-endpoint)
- [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
```
