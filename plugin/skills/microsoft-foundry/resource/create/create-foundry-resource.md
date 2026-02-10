---
name: microsoft-foundry:resource/create
description: |
  Create Azure AI Services multi-service resource (Foundry resource) using Azure CLI.
  USE FOR: create Foundry resource, new AI Services resource, create multi-service resource, provision Azure AI Services, AIServices kind resource.
  DO NOT USE FOR: creating ML workspace hubs (use microsoft-foundry:project/create), deploying models (use microsoft-foundry:models/deploy), managing permissions (use microsoft-foundry:rbac).
---

# Create Foundry Resource

This sub-skill orchestrates creation of Azure AI Services multi-service resources using Azure CLI.

> **Important:** All resource creation operations are **control plane (management)** operations. Use **Azure CLI commands** as the primary method.

## Quick Reference

| Property | Value |
|----------|-------|
| **Classification** | WORKFLOW SKILL |
| **Operation Type** | Control Plane (Management) |
| **Primary Method** | Azure CLI: `az cognitiveservices account create` |
| **Resource Type** | `Microsoft.CognitiveServices/accounts` (kind: `AIServices`) |
| **Resource Kind** | `AIServices` (multi-service) |

## When to Use

Use this sub-skill when you need to:

- **Create Foundry resource** - Provision new Azure AI Services multi-service account
- **Create resource group** - Set up resource group before creating resources
- **Monitor usage** - Check resource usage and quotas
- **Manual resource creation** - CLI-based resource provisioning

**Do NOT use for:**
- Creating ML workspace hubs/projects (use `microsoft-foundry:project/create`)
- Deploying AI models (use `microsoft-foundry:models/deploy`)
- Managing RBAC permissions (use `microsoft-foundry:rbac`)

## Prerequisites

- **Azure subscription** - Active subscription ([create free account](https://azure.microsoft.com/pricing/purchase-options/azure-account))
- **Azure CLI** - Version 2.0 or later installed
- **Authentication** - Run `az login` before commands
- **RBAC roles** - One of:
  - Contributor
  - Owner
  - Custom role with `Microsoft.CognitiveServices/accounts/write`
- **Resource provider** - `Microsoft.CognitiveServices` registered

> **Need RBAC help?** See [microsoft-foundry:rbac](../../rbac/rbac.md) for permission management.

## Core Workflows

### 1. Create Resource Group

**Command Pattern:** "Create a resource group for my Foundry resources"

**Quick Start:**
```bash
az group create \
  --name <resource-group-name> \
  --location <location>
```

**See:** [references/workflows.md#1-create-resource-group](references/workflows.md#1-create-resource-group)

### 2. Create Foundry Resource

**Command Pattern:** "Create a new Azure AI Services resource"

**Quick Start:**
```bash
az cognitiveservices account create \
  --name <resource-name> \
  --resource-group <rg> \
  --kind AIServices \
  --sku S0 \
  --location <location> \
  --yes
```

**See:** [references/workflows.md#2-create-foundry-resource](references/workflows.md#2-create-foundry-resource)

### 3. Monitor Resource Usage

**Command Pattern:** "Check usage for my Foundry resource"

**Quick Start:**
```bash
az cognitiveservices account list-usage \
  --name <resource-name> \
  --resource-group <rg>
```

**See:** [references/workflows.md#3-monitor-resource-usage](references/workflows.md#3-monitor-resource-usage)

### 4. Register Resource Provider

**Command Pattern:** "Register Cognitive Services provider"

**Quick Start:**
```bash
az provider register --namespace Microsoft.CognitiveServices
```

**See:** [references/workflows.md#4-register-resource-provider](references/workflows.md#4-register-resource-provider)

## Important Notes

### Resource Kind

- **Must use `--kind AIServices`** for multi-service Foundry resources
- Other kinds (e.g., OpenAI, ComputerVision) create single-service resources
- AIServices provides access to multiple AI services with single endpoint

### SKU Selection

Common SKUs:
- **S0** - Standard tier (most common)
- **F0** - Free tier (limited features)

### Regional Availability

- Different regions may have different service availability
- Check [Azure products by region](https://azure.microsoft.com/global-infrastructure/services/?products=cognitive-services)
- Regional selection affects latency but not runtime availability

## Quick Commands

```bash
# List available regions
az account list-locations --query "[].{Region:name}" --out table

# Create resource group
az group create --name rg-ai-services --location westus2

# Create Foundry resource
az cognitiveservices account create \
  --name my-foundry-resource \
  --resource-group rg-ai-services \
  --kind AIServices \
  --sku S0 \
  --location westus2 \
  --yes

# List resources in group
az cognitiveservices account list --resource-group rg-ai-services

# Get resource details
az cognitiveservices account show \
  --name my-foundry-resource \
  --resource-group rg-ai-services

# Check usage
az cognitiveservices account list-usage \
  --name my-foundry-resource \
  --resource-group rg-ai-services

# Delete resource
az cognitiveservices account delete \
  --name my-foundry-resource \
  --resource-group rg-ai-services
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `InsufficientPermissions` | Missing RBAC role | Use `microsoft-foundry:rbac` to check permissions |
| `ResourceProviderNotRegistered` | Provider not registered | Run workflow #4 to register provider |
| `LocationNotAvailableForResourceType` | Region doesn't support service | Choose different region |
| `ResourceNameNotAvailable` | Name already taken | Use different resource name |

## External Resources

- [Create multi-service resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource?pivots=azcli)
- [Azure AI Services documentation](https://learn.microsoft.com/en-us/azure/ai-services/)
- [Azure regions with AI Services](https://azure.microsoft.com/global-infrastructure/services/?products=cognitive-services)
