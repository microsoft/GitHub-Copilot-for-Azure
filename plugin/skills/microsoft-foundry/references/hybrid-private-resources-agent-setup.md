```markdown
# Hybrid Private Resources Agent Setup

> **MANDATORY:** Read [Configure private link for Azure AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project) before proceeding.

## Overview

Deploys backend resources (AI Search, Cosmos DB, Storage) behind private endpoints while keeping the Foundry account **optionally public**. By default the Foundry account has public access disabled, but it can be switched to public for portal-based development. Also includes a **dedicated MCP subnet** for deploying MCP servers on the VNet.

## Key Differences from Template 15

| Feature | Template 15 (fully private) | Template 19 (this — hybrid) |
|---------|----------------------------|------------------------------|
| Foundry public access | ❌ Always disabled | **Configurable** (disabled by default, toggle-able) |
| MCP server subnet | ❌ | ✅ Dedicated `mcp-subnet` for Container Apps |
| Portal access | VPN/ExpressRoute/Bastion only | Optional direct portal access when public enabled |
| Backend resources | 🔒 Private | 🔒 Private (always) |

## Networking

Three subnets:

| Subnet | Default CIDR | Purpose | Delegation |
|--------|-------------|---------|------------|
| Agent Subnet | agent-subnet | AI Foundry agent workloads | `Microsoft.App/environments` |
| PE Subnet | pe-subnet | Private endpoints for backend resources | None |
| MCP Subnet | mcp-subnet | MCP servers via Container Apps | None |

## When to Use

- User wants **private backend resources** but may need occasional public Foundry portal access
- User wants to deploy **MCP servers on the VNet** that agents access via Data Proxy
- Hybrid security model: private data plane, optionally public control plane

## When NOT to Use

- Fully private with no public access option → use [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
- No MCP server integration needed and fully private required → use template 15
- Managed VNet preferred → use [Managed Virtual Network Agent Setup](managed-virtual-network-agent-setup.md)

## Switching Public/Private Access

In `modules-network-secured/ai-account-identity.bicep`:
- **Enable public:** Set `publicNetworkAccess: 'Enabled'` and `defaultAction: 'Allow'`
- **Disable (default):** Set `publicNetworkAccess: 'Disabled'` and `defaultAction: 'Deny'`

When public access is disabled, connect via VPN Gateway, ExpressRoute, or Azure Bastion.

## Deployment

**Always use the official Bicep template:**
[Hybrid Private Resources Agent Setup Bicep](https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/19-hybrid-private-resources-agent-setup)

```bash
az group create --name "rg-hybrid-agent" --location "westus2"
az deployment group create --resource-group "rg-hybrid-agent" --template-file main.bicep --parameters location="westus2"
```

## MCP Server Deployment

Deploy MCP servers on the dedicated `mcp-subnet` using Container Apps:
1. Create Container Apps environment on `mcp-subnet` with `--internal-only true`
2. Deploy MCP server container
3. Configure private DNS zone for Container Apps

See `tests/TESTING-GUIDE.md` in the template folder for details.

> ⚠️ **Warning:** Capability host provisioning is **asynchronous** (10–20 minutes). Poll deployment status until success before proceeding.

## Post-Deployment

1. **Deploy a model** to the AI Services account (e.g., `gpt-5.3`).
2. **Create the agent** using MCP tools (`agent_update`) or the Python SDK.

## References

- [Azure AI Foundry Networking](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project)
- [Securely Connect to AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?view=foundry#securely-connect-to-foundry)
- [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
```
