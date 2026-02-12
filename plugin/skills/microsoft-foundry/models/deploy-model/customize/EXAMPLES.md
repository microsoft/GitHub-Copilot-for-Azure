# customize Examples

This document provides walkthrough examples for common deployment scenarios using the customize skill.

## Table of Contents

1. [Example 1: Basic Deployment with Defaults](#example-1-basic-deployment-with-defaults)
2. [Example 2: Production Deployment with Custom Capacity](#example-2-production-deployment-with-custom-capacity)
3. [Example 3: PTU Deployment for High-Volume Workload](#example-3-ptu-deployment-for-high-volume-workload)
4. [Example 4: Development Deployment with Standard SKU](#example-4-development-deployment-with-standard-sku)
5. [Example 5: Deployment with Spillover Configuration](#example-5-deployment-with-spillover-configuration)

---

## Example 1: Basic Deployment with Defaults

**Scenario:** Deploy gpt-4o with all default settings for quick setup.

### User Input:
- Model: `gpt-4o`
- Version: Latest (accept default)
- SKU: GlobalStandard (accept default)
- Capacity: 10K TPM (accept default)
- RAI Policy: Microsoft.DefaultV2 (accept default)
- Advanced options: Defaults

### Walkthrough:

```
Agent: "Select model to deploy:"
User: "gpt-4o"

Agent: "Available versions:
  1. 2024-11-20 (Recommended - Latest)
  2. 2024-08-06
  3. 2024-05-13"
User: [Press Enter for default]

Agent: "Available SKUs:
  1. GlobalStandard (Recommended)
  2. Standard
  3. ProvisionedManaged"
User: [Press Enter for default]

Agent: "Capacity Configuration:
  Recommended: 10,000 TPM"
User: [Press Enter for default]

Agent: "Content Filters:
  1. Microsoft.DefaultV2 (Recommended)"
User: [Press Enter for default]

Agent: "Enable dynamic quota? (Y/n)"
User: [Press Enter for default]

Agent: "Version upgrade policy:
  1. OnceNewDefaultVersionAvailable (Recommended)"
User: [Press Enter for default]

Agent: "Deployment name: gpt-4o"
User: [Press Enter for default]

Agent: [Shows review]
User: "Y" [Confirm]

Agent: "✓ Deployment successful!"
```

### Result:
```
Deployment Name: gpt-4o
Model: gpt-4o
Version: 2024-11-20
SKU: GlobalStandard
Capacity: 10,000 TPM
RAI Policy: Microsoft.DefaultV2
Dynamic Quota: Enabled
```

**Time:** ~2-3 minutes (mostly deployment time)
**Interactions:** ~6 (mostly accepting defaults)

---

## Example 2: Production Deployment with Custom Capacity

**Scenario:** Deploy gpt-4o for production with 50K TPM capacity.

### Requirements:
- Model: gpt-4o
- Version: Latest stable
- SKU: GlobalStandard (high availability)
- Capacity: 50,000 TPM (high volume)
- RAI Policy: Microsoft.DefaultV2
- Dynamic Quota: Enabled
- Custom name: `gpt-4o-production`

### Walkthrough:

```
Agent: "Select model:"
User: "1" (gpt-4o)

Agent: "Select version:"
User: "1" (Latest)

Agent: "Select SKU:"
User: "1" (GlobalStandard)

Agent: "Capacity Configuration:
  Available: 150,000 TPM
  Recommended: 10,000 TPM
  
  Enter capacity:"
User: "50000"

Agent: "Deployment capacity: 50,000 TPM"

Agent: "Select RAI policy:"
User: "1" (Microsoft.DefaultV2)

Agent: "Enable dynamic quota?"
User: "Y"

Agent: "Version upgrade policy:"
User: "1" (OnceNewDefaultVersionAvailable)

Agent: "Generated name: gpt-4o
  Use this or specify custom?"
User: "gpt-4o-production"

Agent: [Shows review with all selections]

Configuration Review:
  Model: gpt-4o
  Version: 2024-11-20
  Deployment Name: gpt-4o-production
  SKU: GlobalStandard
  Capacity: 50,000 TPM
  RAI Policy: Microsoft.DefaultV2
  Dynamic Quota: Enabled

User: "Y" [Confirm]

Agent: "✓ Deployment successful!"
```

### Result:
```
Deployment Name: gpt-4o-production
Model: gpt-4o
Version: 2024-11-20
SKU: GlobalStandard
Capacity: 50,000 TPM (50K tokens per minute)
Region: eastus2

Rate Limits:
  • Requests: 500 per 10 seconds
  • Tokens: 50,000 per minute

Status: Succeeded
```

**Use Case:** Production application with moderate to high traffic

---

## Example 3: PTU Deployment for High-Volume Workload

**Scenario:** Deploy gpt-4o with reserved capacity (PTU) for predictable, high-volume workload.

### Requirements:
- Model: gpt-4o
- Version: Latest
- SKU: ProvisionedManaged (PTU)
- Capacity: 200 PTU
- RAI Policy: Microsoft.DefaultV2
- Priority Processing: Enabled

### PTU Calculation:
```
Expected load:
- Input: 40,000 tokens/min
- Output: 20,000 tokens/min
- Requests: 200/min

Estimated PTU = (40,000 × 0.001) + (20,000 × 0.002) + (200 × 0.1)
              = 40 + 40 + 20
              = 100 PTU

Recommended: 200 PTU (2x for headroom)
```

### Walkthrough:

```
Agent: "Select model:"
User: "1" (gpt-4o)

Agent: "Select version:"
User: "1" (Latest - 2024-11-20)

Agent: "Select SKU:
  1. GlobalStandard
  2. Standard
  3. ProvisionedManaged (Reserved PTU)"
User: "3"

Agent: "Capacity Configuration:
  Note: Provisioned capacity measured in PTU
  Minimum: 50 PTU
  Maximum: 1,000 PTU
  Recommended: 100 PTU
  
  Enter capacity (PTU):"
User: "200"

Agent: "Deployment capacity: 200 PTU"

Agent: "Select RAI policy:"
User: "1" (Microsoft.DefaultV2)

Agent: "Enable priority processing?
  • Prioritizes requests during high load
  • Additional charges apply
  
  Enable? (y/N)"
User: "Y"

Agent: "✓ Priority processing enabled"

Agent: "Version upgrade policy:"
User: "1" (OnceNewDefaultVersionAvailable)

Agent: "Deployment name: gpt-4o"
User: [Press Enter]

Agent: [Shows review]

Configuration Review:
  Model: gpt-4o
  Version: 2024-11-20
  Deployment Name: gpt-4o
  SKU: ProvisionedManaged
  Capacity: 200 PTU
  RAI Policy: Microsoft.DefaultV2
  Priority Processing: Enabled

User: "Y" [Confirm]

Agent: "Creating deployment... (this may take longer for PTU deployments)"
Agent: "✓ Deployment successful!"
```

### Result:
```
Deployment Name: gpt-4o
Model: gpt-4o
Version: 2024-11-20
SKU: ProvisionedManaged
Capacity: 200 PTU
Priority Processing: Enabled
Status: Succeeded

Note: PTU deployments have guaranteed throughput
Monthly cost is fixed regardless of usage
```

**Use Case:** High-volume production application with predictable load (e.g., customer service bot, document processing pipeline)

---

## Example 4: Development Deployment with Standard SKU

**Scenario:** Deploy gpt-4o-mini for development/testing with minimal cost.

### Requirements:
- Model: gpt-4o-mini (cost-effective)
- Version: Latest
- SKU: Standard (single region, lower cost)
- Capacity: 1,000 TPM (minimum)
- RAI Policy: Microsoft.DefaultV2
- No advanced features

### Walkthrough:

```
Agent: "Select model:
  1. gpt-4o
  2. gpt-4o-mini (Cost-effective, faster)
  3. gpt-4-turbo"
User: "2"

Agent: "Available versions for gpt-4o-mini:
  1. 2024-07-18 (Latest)
  2. 2024-05-13"
User: "1"

Agent: "Select SKU:
  1. GlobalStandard
  2. Standard (Single region, lower cost)
  3. ProvisionedManaged"
User: "2"

Agent: "Capacity Configuration:
  Available: 50,000 TPM
  Minimum: 1,000 TPM
  Recommended: 5,000 TPM
  
  Enter capacity:"
User: "1000"

Agent: "Deployment capacity: 1,000 TPM"

Agent: "Select RAI policy:"
User: "1" (Microsoft.DefaultV2)

Agent: "Version upgrade policy:"
User: "1"

Agent: "Deployment name: gpt-4o-mini"
User: "gpt-4o-mini-dev"

Agent: [Shows review]
User: "Y" [Confirm]

Agent: "✓ Deployment successful!"
```

### Result:
```
Deployment Name: gpt-4o-mini-dev
Model: gpt-4o-mini
Version: 2024-07-18
SKU: Standard
Capacity: 1,000 TPM
Region: eastus2
Status: Succeeded

Rate Limits:
  • Requests: 10 per 10 seconds
  • Tokens: 1,000 per minute

Cost: Minimal (pay-per-use, low rate)
```

**Use Case:** Development environment, testing, prototyping, low-traffic applications

---

## Example 5: Deployment with Spillover Configuration

**Scenario:** Deploy gpt-4o with spillover to backup deployment for handling peak loads.

### Prerequisites:
- Existing backup deployment: `gpt-4o-backup` (already deployed)

### Requirements:
- Model: gpt-4o
- Version: Latest
- SKU: GlobalStandard
- Capacity: 20,000 TPM
- Spillover: Enabled → gpt-4o-backup

### Walkthrough:

```
Agent: "Select model:"
User: "1" (gpt-4o)

Agent: "Select version:"
User: "1" (Latest)

Agent: "Select SKU:"
User: "1" (GlobalStandard)

Agent: "Capacity:"
User: "20000"

Agent: "RAI policy:"
User: "1" (Microsoft.DefaultV2)

Agent: "Enable dynamic quota?"
User: "Y"

Agent: "Configure spillover deployment?
  • Redirects requests when capacity reached
  
  Enable spillover? (y/N)"
User: "Y"

Agent: "Available deployments:
  1. gpt-4o-backup
  2. gpt-4o-mini-fallback
  3. o3-mini
  
  Select spillover target:"
User: "1"

Agent: "✓ Spillover enabled to: gpt-4o-backup"

Agent: "Version upgrade policy:"
User: "1"

Agent: "Deployment name: gpt-4o"
User: "gpt-4o-primary"

Agent: [Shows review]

Configuration Review:
  Model: gpt-4o
  Deployment Name: gpt-4o-primary
  SKU: GlobalStandard
  Capacity: 20,000 TPM
  Dynamic Quota: Enabled
  Spillover: Enabled → gpt-4o-backup

User: "Y" [Confirm]

Agent: "✓ Deployment successful!"
```

### Result:
```
Deployment Name: gpt-4o-primary
Model: gpt-4o
SKU: GlobalStandard
Capacity: 20,000 TPM
Spillover Target: gpt-4o-backup
Status: Succeeded

Spillover Behavior:
  • Primary handles requests up to 20K TPM
  • Overflow redirects to gpt-4o-backup
  • Automatic failover when capacity reached
```

### Testing Spillover:

```bash
# Generate high load to trigger spillover
for i in {1..1000}; do
  curl -X POST https://<endpoint>/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-primary","messages":[{"role":"user","content":"test"}]}'
done

# Monitor both deployments
az cognitiveservices account deployment show \
  --name <account> \
  --resource-group <rg> \
  --deployment-name gpt-4o-primary \
  --query "properties.rateLimits"

az cognitiveservices account deployment show \
  --name <account> \
  --resource-group <rg> \
  --deployment-name gpt-4o-backup \
  --query "properties.rateLimits"
```

**Use Case:** Applications with variable traffic patterns, need for peak load handling without over-provisioning primary deployment

---

## Comparison Matrix

| Scenario | Model | SKU | Capacity | Dynamic Quota | Priority Processing | Spillover | Use Case |
|----------|-------|-----|----------|---------------|-------------------|-----------|----------|
| Example 1 | gpt-4o | GlobalStandard | 10K TPM | ✓ | - | - | Quick setup |
| Example 2 | gpt-4o | GlobalStandard | 50K TPM | ✓ | - | - | Production (high volume) |
| Example 3 | gpt-4o | ProvisionedManaged | 200 PTU | - | ✓ | - | Predictable workload |
| Example 4 | gpt-4o-mini | Standard | 1K TPM | - | - | - | Development/testing |
| Example 5 | gpt-4o | GlobalStandard | 20K TPM | ✓ | - | ✓ | Peak load handling |

---

## Common Patterns

### Pattern 1: Development → Staging → Production

**Development:**
```
Model: gpt-4o-mini
SKU: Standard
Capacity: 1K TPM
Name: gpt-4o-mini-dev
```

**Staging:**
```
Model: gpt-4o
SKU: GlobalStandard
Capacity: 10K TPM
Name: gpt-4o-staging
```

**Production:**
```
Model: gpt-4o
SKU: GlobalStandard
Capacity: 50K TPM
Dynamic Quota: Enabled
Spillover: gpt-4o-backup
Name: gpt-4o-production
```

### Pattern 2: Multi-Region Deployment

**Primary (East US 2):**
```
Model: gpt-4o
SKU: GlobalStandard
Capacity: 50K TPM
Name: gpt-4o-eastus2
```

**Secondary (West Europe):**
```
Model: gpt-4o
SKU: GlobalStandard
Capacity: 30K TPM
Name: gpt-4o-westeurope
```

### Pattern 3: Cost Optimization

**High Priority Requests:**
```
Model: gpt-4o
SKU: ProvisionedManaged (PTU)
Capacity: 100 PTU
Priority Processing: Enabled
Name: gpt-4o-priority
```

**Low Priority Requests:**
```
Model: gpt-4o-mini
SKU: Standard
Capacity: 5K TPM
Name: gpt-4o-mini-batch
```

---

## Tips and Best Practices

### Capacity Planning
1. **Start conservative** - Begin with recommended capacity
2. **Monitor usage** - Use Azure Monitor to track actual usage
3. **Scale gradually** - Increase capacity based on demand
4. **Use spillover** - Handle peaks without over-provisioning

### SKU Selection
1. **Development** - Standard SKU, minimal capacity
2. **Production (variable load)** - GlobalStandard + dynamic quota
3. **Production (predictable load)** - ProvisionedManaged (PTU)
4. **Multi-region** - GlobalStandard for automatic failover

### Cost Optimization
1. **Right-size capacity** - Don't over-provision
2. **Use gpt-4o-mini** - Where appropriate (80-90% accuracy of gpt-4o at lower cost)
3. **Enable dynamic quota** - Pay for what you use
4. **Consider PTU** - For consistent high-volume workloads (predictable cost)

### Version Management
1. **Auto-upgrade recommended** - Get latest improvements automatically
2. **Test before production** - Use staging deployment for new versions
3. **Pin version** - Only if specific version required for compatibility

### Content Filtering
1. **Start with DefaultV2** - Balanced filtering for most use cases
2. **Custom policies** - Only for specific requirements
3. **Test filtering** - Ensure it doesn't block legitimate content
4. **Monitor rejections** - Track filtered requests

---

## Troubleshooting Scenarios

### Scenario: Deployment Fails with "Insufficient Quota"

**Problem:**
```
❌ Deployment failed
Error: QuotaExceeded - Insufficient quota for requested capacity
```

**Solution:**
```
1. Check current quota usage:
   az cognitiveservices usage list \
     --name <account> \
     --resource-group <rg>

2. Reduce requested capacity or request quota increase

3. Try different SKU (e.g., Standard instead of GlobalStandard)

4. Check other regions with preset skill
```

### Scenario: Can't Select Specific Version

**Problem:**
```
Selected version not available for chosen SKU
```

**Solution:**
```
1. Check version availability:
   az cognitiveservices account list-models \
     --name <account> \
     --resource-group <rg> \
     --query "[?name=='gpt-4o'].version"

2. Select different version or SKU

3. Use latest version (always available)
```

### Scenario: Deployment Name Already Exists

**Problem:**
```
Deployment name 'gpt-4o' already exists
```

**Solution:**
```
Skill auto-generates unique name: gpt-4o-2, gpt-4o-3, etc.

Or specify custom name:
- gpt-4o-production
- gpt-4o-v2
- gpt-4o-eastus2
```

---

## Next Steps

After successful deployment:

1. **Test the deployment:**
   ```bash
   curl https://<endpoint>/chat/completions \
     -H "Content-Type: application/json" \
     -H "api-key: <key>" \
     -d '{"model":"<deployment-name>","messages":[{"role":"user","content":"Hello!"}]}'
   ```

2. **Monitor in Azure Portal:**
   - Navigate to Azure AI Foundry portal
   - View deployments → Select your deployment
   - Monitor metrics, usage, rate limits

3. **Set up alerts:**
   ```bash
   az monitor metrics alert create \
     --name "high-usage-alert" \
     --resource <deployment-id> \
     --condition "avg ProcessedPromptTokens > 40000"
   ```

4. **Integrate into application:**
   - Get endpoint and keys
   - Configure Azure OpenAI SDK
   - Implement error handling and retries

5. **Scale as needed:**
   - Monitor actual usage
   - Adjust capacity if needed
   - Consider additional deployments for redundancy
