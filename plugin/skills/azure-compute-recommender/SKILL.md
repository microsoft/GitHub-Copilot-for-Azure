---
name: azure-compute-recommender
description: >-
  Recommend Azure VM sizes and configurations based on workload requirements, performance needs, and budget constraints.
  No Azure account required — uses public documentation and the unauthenticated Azure Retail Prices API.
  USE FOR: recommend VM size, which VM should I use, choose Azure VM, VM for web server, VM for database,
  VM for machine learning, GPU VM, compare VM sizes, cheapest VM, best VM for my workload, Azure VM pricing,
  VM cost estimate, burstable VM, compute optimized VM, memory optimized VM, storage optimized VM,
  high performance computing VM, confidential computing VM, VM trade-offs, VM families explained.
  DO NOT USE FOR: deploying VMs (use azure-deploy), managing existing VMs (use azure-resource-lookup),
  cost optimization of running VMs (use azure-cost-optimization), non-VM services like App Service or AKS.
---

# Azure Compute Recommender

Recommend Azure VM sizes and configurations by analyzing workload type, performance requirements, and budget. No Azure subscription required — all data comes from public Microsoft documentation and the unauthenticated Retail Prices API.

## When to Use This Skill

- User asks which Azure VM to choose for a workload
- User needs VM size recommendations for web, database, ML, batch, HPC, or other workloads
- User wants to compare VM families, sizes, or pricing tiers
- User asks about trade-offs between VM options (cost vs performance)
- User needs a cost estimate for Azure VMs without an Azure account

## Quick Reference

| Property          | Value                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Pricing API**   | `https://prices.azure.com/api/retail/prices` (unauthenticated)                                     |
| **Auth Required** | None — public API and docs only                                                                    |
| **VM Docs**       | [Azure VM sizes overview](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/overview) |
| **Best For**      | Pre-purchase guidance, architecture planning, cost estimation                                      |

## Workflow

### Step 1: Gather Requirements

Ask the user for (infer when possible):

| Requirement          | Examples                                                           |
| -------------------- | ------------------------------------------------------------------ |
| **Workload type**    | Web server, relational DB, ML training, batch processing, dev/test |
| **vCPU / RAM needs** | "4 cores, 16 GB RAM" or "lightweight" / "heavy"                    |
| **GPU needed?**      | Yes → GPU families; No → general/compute/memory                    |
| **Storage needs**    | High IOPS, large temp disk, premium SSD                            |
| **Budget priority**  | Cost-sensitive, performance-first, balanced                        |
| **OS**               | Linux or Windows (affects pricing)                                 |
| **Region**           | Affects availability and price                                     |

### Step 2: Select VM Family

Match requirements to a VM family — [VM Family Guide](references/vm-families.md)

### Step 3: Look Up Pricing

Query the Azure Retail Prices API — [Retail Prices API Guide](references/retail-prices-api.md)

### Step 4: Present Recommendations

Provide **2–3 options** with trade-offs:

| Column         | Purpose                                |
| -------------- | -------------------------------------- |
| VM Size        | ARM SKU name (e.g., `Standard_D4s_v5`) |
| vCPUs / RAM    | Core specs                             |
| Estimated $/hr | Pay-as-you-go from API                 |
| Why            | Fit for the workload                   |
| Trade-off      | What the user gives up                 |

> **Tip:** Always explain *why* a family fits and what the user trades off (cost vs cores, burstable vs dedicated, etc.).

### Step 5: Offer Next Steps

- Compare reservation / savings plan pricing (query API with `priceType eq 'Reservation'`)
- Link to deploy skill if user wants to provision: invoke **azure-deploy**
- Suggest [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for full estimates

## Error Handling

| Scenario                     | Action                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- |
| API returns empty results    | Broaden filters — check `armRegionName`, `serviceName`, `armSkuName` spelling |
| User unsure of workload type | Ask clarifying questions; default to General Purpose D-series                 |
| Region not specified         | Use `eastus` as default; note prices vary by region                           |

## References

- [VM Family Guide](references/vm-families.md) — Family-to-workload mapping and selection
- [Retail Prices API Guide](references/retail-prices-api.md) — Query patterns, filters, and examples
