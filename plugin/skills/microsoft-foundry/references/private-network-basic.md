```markdown
# Private Network Basic Setup

> **MANDATORY:** Read [Configure private link for Azure AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project) before proceeding.

## Overview

Simplest private networking template. Deploys an AI Foundry account with **public network access disabled** and a private endpoint — no BYO resources, no capability host, no agent-specific setup. Use this when you only need a private Foundry account to host projects and models behind a VNet.

## What It Creates

| Resource | Details |
|----------|---------|
| AI Foundry account | `AIServices` kind, S0 SKU, `publicNetworkAccess: Disabled` |
| VNet + PE subnet | `192.168.0.0/16` with one `/24` subnet for private endpoints |
| Private endpoint | For the AI Services account (`account` group) |
| Private DNS zones | `privatelink.services.ai.azure.com`, `privatelink.openai.azure.com`, `privatelink.cognitiveservices.azure.com` |
| Model deployment | `gpt-4o-mini` (GlobalStandard) |
| Project | One default project |

No Cosmos DB, Storage, AI Search, or capability host is provisioned. This template does **not** enable agent workloads — it only provides a private Foundry resource for model hosting and project management.

## When to Use

- User needs a private Foundry account **without** agent capabilities
- No requirement for BYO storage, search, or thread storage
- Simplest possible VNet isolation for AI Services

## When NOT to Use

- User needs agent workloads → use [Private Network Standard Agent Setup](private-network-standard-agent-setup.md) or another standard template
- User needs BYO resources (Cosmos DB, Storage, AI Search) → use a standard setup template

## Deployment

**Always use the official Bicep template:**
[Private Network Basic Bicep](https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/10-private-network-basic)

```bash
az group create --name <rg-name> --location <region>
az deployment group create --resource-group <rg-name> --template-file main.bicep
```

> ⚠️ **Access:** To reach the private Foundry resource, use a VM, VPN, or ExpressRoute on the VNet.

## References

- [Configure Private Link for AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/configure-private-link?tabs=azure-portal&pivots=fdp-project)
- [Standard Agent Setup (public network)](standard-agent-setup.md)
```
