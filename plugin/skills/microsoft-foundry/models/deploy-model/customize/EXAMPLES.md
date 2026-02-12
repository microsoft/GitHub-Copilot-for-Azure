# customize Examples

Deployment scenarios using the customize skill with different SKU, capacity, and feature configurations.

---

## Example 1: Basic Deployment with Defaults

**Scenario:** Deploy gpt-4o accepting all defaults for quick setup.

**Selections:** Model: gpt-4o → Version: 2024-11-20 (latest) → SKU: GlobalStandard → Capacity: 10K TPM → RAI: Microsoft.DefaultV2 → Dynamic Quota: enabled → Auto-upgrade: enabled

**Result:** Deployment `gpt-4o` created. ~2-3 min, ~6 interactions (mostly accepting defaults).

---

## Example 2: Production Deployment with Custom Capacity

**Scenario:** Deploy gpt-4o for production with 50K TPM and custom name.

**Selections:** Model: gpt-4o → Version: 2024-11-20 → SKU: GlobalStandard → Capacity: 50,000 TPM → RAI: Microsoft.DefaultV2 → Dynamic Quota: enabled → Name: `gpt-4o-production`

**Result:** Deployment `gpt-4o-production` with 50K TPM (500 req/10s). Use case: moderate-to-high traffic production app.

---

## Example 3: PTU Deployment for High-Volume Workload

**Scenario:** Deploy gpt-4o with reserved capacity (PTU) for predictable, high-volume workload.

**PTU Sizing:**
```
Input: 40K tokens/min, Output: 20K tokens/min, Requests: 200/min
Estimated: ~100 PTU → Recommended: 200 PTU (2x headroom)
```

**Selections:** Model: gpt-4o → Version: 2024-11-20 → SKU: ProvisionedManaged → Capacity: 200 PTU (min 50, max 1000) → RAI: Microsoft.DefaultV2 → Priority Processing: enabled

**Result:** Deployment with guaranteed throughput, fixed monthly cost. Use case: customer service bots, document processing pipelines.

---

## Example 4: Development Deployment with Standard SKU

**Scenario:** Deploy gpt-4o-mini for dev/testing with minimal cost.

**Selections:** Model: gpt-4o-mini → Version: 2024-07-18 → SKU: Standard (single region, lower cost) → Capacity: 1,000 TPM (minimum) → Name: `gpt-4o-mini-dev`

**Result:** Deployment with 1K TPM, 10 req/10s. Minimal pay-per-use cost. Use case: development, prototyping.

---

## Example 5: Deployment with Spillover Configuration

**Scenario:** Deploy gpt-4o with spillover to existing backup deployment for peak load handling.

**Prerequisites:** Existing deployment `gpt-4o-backup` already deployed.

**Selections:** Model: gpt-4o → SKU: GlobalStandard → Capacity: 20K TPM → Dynamic Quota: enabled → Spillover: enabled → target `gpt-4o-backup` → Name: `gpt-4o-primary`

**Spillover behavior:** Primary handles up to 20K TPM; overflow auto-redirects to `gpt-4o-backup`.

**Monitoring spillover:**
```bash
az cognitiveservices account deployment show \
  --name <account> --resource-group <rg> \
  --deployment-name gpt-4o-primary --query "properties.rateLimits"
```

**Use case:** Variable traffic patterns, peak load handling without over-provisioning.

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

### Dev → Staging → Production
| Stage | Model | SKU | Capacity | Extras |
|-------|-------|-----|----------|--------|
| Dev | gpt-4o-mini | Standard | 1K TPM | — |
| Staging | gpt-4o | GlobalStandard | 10K TPM | — |
| Production | gpt-4o | GlobalStandard | 50K TPM | Dynamic Quota + Spillover |

### Cost Optimization
- **High priority:** gpt-4o, ProvisionedManaged, 100 PTU, Priority Processing enabled
- **Low priority:** gpt-4o-mini, Standard, 5K TPM

---

## Tips and Best Practices

**Capacity:** Start conservative → monitor with Azure Monitor → scale gradually → use spillover for peaks.

**SKU Selection:** Standard for dev → GlobalStandard + dynamic quota for variable production → ProvisionedManaged (PTU) for predictable load.

**Cost:** Right-size capacity; use gpt-4o-mini where possible (80-90% accuracy at lower cost); enable dynamic quota; consider PTU for consistent high-volume.

**Versions:** Auto-upgrade recommended; test new versions in staging first; pin only if compatibility requires it.

**Content Filtering:** Start with DefaultV2; use custom policies only for specific needs; monitor filtered requests.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `QuotaExceeded` | Check usage with `az cognitiveservices usage list`, reduce capacity, try different SKU, or check other regions |
| Version not available for SKU | Check `az cognitiveservices account list-models --query "[?name=='gpt-4o'].version"`, use latest |
| Deployment name exists | Skill auto-generates unique name (e.g., `gpt-4o-2`), or specify custom name |

---

## Next Steps

After deployment: test with `curl` → monitor in Azure AI Foundry portal → set up alerts (`az monitor metrics alert create`) → integrate via Azure OpenAI SDK → scale as needed.
