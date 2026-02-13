# Scaling Strategies for Rate Limiting

Choose appropriate scaling strategy based on diagnosis.

## Option A: Scale Deployment Capacity (Within Existing Quota)

If you have available regional quota, scale your deployment directly.

**Note:** Currently, there is no direct Azure CLI command or MCP tool to update deployment capacity. Use the REST API as shown below. An MCP tool for deployment updates may be added in the future.

**Via REST API:**
```bash
# Update deployment capacity (requires SKU name and new capacity)
az rest --method PUT \
  --url "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/<resource-group>/providers/Microsoft.CognitiveServices/accounts/<resource-name>/deployments/<deployment-name>?api-version=2023-05-01" \
  --body '{
    "sku": {
      "name": "<SKU-type>",
      "capacity": <new-capacity>
    },
    "properties": {
      "model": {
        "format": "OpenAI",
        "name": "<model-name>",
        "version": "<model-version>"
      },
      "versionUpgradeOption": "OnceNewDefaultVersionAvailable"
    }
  }'
```

**Example: Scale gpt-5.1 from 1K to 2K TPM:**
```bash
# First, get current deployment details
az cognitiveservices account deployment show \
  --name alfredo-eastus2-resource \
  --resource-group rg-alfredo \
  --deployment-name gpt-5.1 \
  --query "{sku:sku.name, version:properties.model.version}"

# Then scale (capacity: 1 → 2 = 1K TPM → 2K TPM)
az rest --method PUT \
  --url "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-alfredo/providers/Microsoft.CognitiveServices/accounts/alfredo-eastus2-resource/deployments/gpt-5.1?api-version=2023-05-01" \
  --body '{
    "sku": {
      "name": "DataZoneStandard",
      "capacity": 2
    },
    "properties": {
      "model": {
        "format": "OpenAI",
        "name": "gpt-5.1",
        "version": "2025-11-13"
      },
      "versionUpgradeOption": "OnceNewDefaultVersionAvailable"
    }
  }'
```

**Common Errors:**
- `InsufficientQuota` → Need to request quota increase (see Option B)
- `InvalidResourceProperties - SKU not supported` → Wrong SKU type, check deployment's current SKU
- `The sku of model deployment is not provided` → Must include `sku` in request body

**Verification:**
```bash
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "{capacity:sku.capacity, rateLimits:properties.rateLimits}"
```

## Option B: Request Quota Increase

For sustained high usage:

1. **Check current limits:**

   **Using MCP Tools (Preferred):**

   Use `mcp__plugin_azure_azure__quota` MCP tool with command `quota_usage_check`:

   | Parameter | Required | Description |
   |-----------|----------|-------------|
   | `region` | Yes | Azure region (e.g., "eastus2") |
   | `resource-types` | Yes | `"Microsoft.CognitiveServices/accounts"` |
   | `subscription` | Yes | Subscription ID or name (omit only if `AZURE_SUBSCRIPTION_ID` env var is set) |

   - Filter results for specific model (e.g., "gpt-5.1")

   **If Azure MCP is not enabled:** Run `/mcp add azure` or enable via `/mcp`.

   **CLI Fallback:**
   ```bash
   # Check regional quota for specific model
   az cognitiveservices usage list \
     --location <region> \
     --query "[?name.value=='OpenAI.GlobalStandard.<model-name>'].{Name:name.value, Current:currentValue, Limit:limit, Unit:unit}" \
     --output table

   # Example: Check gpt-5.1 quota in East US 2
   az cognitiveservices usage list \
     --location eastus2 \
     --query "[?contains(name.value, 'gpt-5.1')].{Name:name.value, Current:currentValue, Limit:limit}" \
     --output table
   ```

2. **Submit request** via Azure Portal → Resource → Quotas → Request increase

**Quota Recommendations:**

| Scenario | Recommended TPM |
|----------|----------------|
| Development/Testing | 10K TPM |
| Production (Low Traffic) | 50K-100K TPM |
| Production (Medium Traffic) | 100K-500K TPM |
| Production (High Traffic) | 500K+ TPM, consider multi-region |

## Option C: Multi-Region Deployment

For burst workloads or geographic distribution:

**Deploy to multiple regions:**
```bash
# Deploy to primary region
az cognitiveservices account deployment create \
  --name foundry-eastus --resource-group rg-eastus \
  --deployment-name gpt-4o-eastus \
  --model-name gpt-4o --model-version "2024-05-13" \
  --sku-capacity 30

# Deploy to secondary region
az cognitiveservices account deployment create \
  --name foundry-westeurope --resource-group rg-westeurope \
  --deployment-name gpt-4o-westeurope \
  --model-name gpt-4o --model-version "2024-05-13" \
  --sku-capacity 30
```

**Benefits:**
- Increased total capacity (quota per region)
- Geographic redundancy and failover
- Reduced latency for global users

**For load balancing patterns**, see [RETRY_EXAMPLES.md](RETRY_EXAMPLES.md#multi-region-load-balancing).
