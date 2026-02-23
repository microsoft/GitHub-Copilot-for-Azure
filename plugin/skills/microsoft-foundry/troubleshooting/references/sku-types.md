# Understanding SKU Types

Azure OpenAI/Foundry deployments use different SKU types, each with separate quota pools:

| SKU Type | Description | Quota Pool | Use Case |
|----------|-------------|------------|----------|
| **GlobalStandard** | Global pay-as-you-go | Shared global quota | Multi-region, flexible workloads |
| **DataZoneStandard** | Data residency pay-as-you-go | Regional quota with data residency | Compliance requirements, data sovereignty |
| **Standard** | Regional standard (legacy) | Regional quota | Legacy deployments |
| **ProvisionedManaged** | Provisioned throughput | Dedicated capacity | Predictable, high-volume workloads |

> ⚠️ **Warning:** Different SKUs have separate quota pools! A deployment using `DataZoneStandard` will NOT consume `GlobalStandard` quota.

**How to check your deployment's SKU:**
```bash
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{name:name, sku:sku.name, capacity:sku.capacity}"
```

**When troubleshooting 429 errors:**
1. Identify your deployment's SKU type
2. Check quota for that specific SKU (e.g., `OpenAI.DataZoneStandard.gpt-5.1`)
3. Ensure you're requesting quota increase for the correct SKU type
