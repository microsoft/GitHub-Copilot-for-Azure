```markdown
# Managed Virtual Network Agent Setup (Preview)

> **MANDATORY:** Read [Configure private link for Azure AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project) before proceeding. This template is a **preview** feature requiring feature flag registration.

## Overview

Deploys a network-secured agent environment using a **Managed Virtual Network** instead of BYO VNet. Azure manages the VNet, subnets, and outbound rules automatically. Only one PE subnet is required (no agent subnet with delegation). Use this when the customer wants network isolation without managing VNet infrastructure.

## Key Differences from BYO VNet Templates (15/16/17)

| Feature | BYO VNet (templates 15-17) | Managed VNet (this) |
|---------|----------------------------|---------------------|
| VNet management | Customer-managed | **Azure-managed** |
| Subnet delegation | Required (`Microsoft.App/environments`) | **Not required** |
| Agent subnet | Required (/24) | **Not required** |
| PE subnet | Required (/24) | Required (/24) |
| Outbound rules | Customer controls NSGs | **Azure CLI `az rest` commands** |
| Status | GA | **Preview** |

## Prerequisites

1. **Register for preview:** Enable feature flag `AI.ManagedVnetPreview` under **Preview Features** in the Azure Portal.
2. Same RBAC requirements as standard setup (Owner/UAA on resource group).
3. Azure CLI required for outbound rule management (`az rest` commands).

## Limitations

- Deployable **only** via the `main.bicep` template in folder `18-managed-virtual-network-preview`.
- FQDN outbound rules (Allow Only Approved Outbound mode) create a managed Azure Firewall with associated costs. FQDN rules support ports 80/443 only.
- **No upgrade path** from custom VNet to managed VNet — requires resource redeployment.
- Outbound rules must be created via Azure CLI (not Bicep).
- Currently supports only Standard BYO resources Agents v1 and Foundry classic experience. Basic Agents do not require network isolation.
- E2E network isolation for Agent MCP tools with managed VNet is **not supported** — use public MCP tools.

## When to Use

- User wants network isolation **without managing VNet infrastructure**
- Subscription is registered for the `AI.ManagedVnetPreview` feature flag
- No requirement for MCP tool network isolation

## When NOT to Use

- User needs full control over VNet topology → use [Private Network Standard Agent Setup](private-network-standard-agent-setup.md)
- User needs MCP servers on the VNet → use [Hybrid Private Resources Agent Setup](hybrid-private-resources-agent-setup.md)
- Preview limitations are unacceptable for production

## Deployment

**Always use the official Bicep template:**
[Managed Virtual Network Bicep](https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/18-managed-virtual-network-preview)

> ⚠️ **Warning:** Capability host provisioning is **asynchronous** (10–20 minutes). Poll deployment status until success before proceeding.

## Post-Deployment

1. **Deploy a model** to the new AI Services account (e.g., `gpt-5.3`). Fall back to `Standard` SKU if `GlobalStandard` quota is exhausted.
2. **Configure outbound rules** via Azure CLI if needed (see `update-outbound-rules-cli/` in the template folder).
3. **Create the agent** using MCP tools (`agent_update`) or the Python SDK.

## References

- [Azure AI Foundry Networking](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project)
- [Private Network Standard Agent Setup (BYO VNet)](private-network-standard-agent-setup.md)
```
