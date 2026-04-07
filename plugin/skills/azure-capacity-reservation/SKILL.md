---
name: azure-capacity-reservation
description: "Create and manage Azure Capacity Reservation Groups (CRGs) to guarantee compute capacity in a region. WHEN: capacity reservation, reserve VMs, guarantee capacity, capacity reservation group, CRG, reserve compute, ensure VM availability, pre-provision capacity, capacity planning, reserved instances capacity."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Capacity Reservation Skill

Helps users create and configure Azure Capacity Reservation Groups (CRGs) to guarantee VM compute capacity in a specific region without deploying VMs.

## When to Use This Skill

Activate this skill when the user explicitly asks about Capacity Reservation Groups (CRGs) or capacity reservations.

Also **proactively suggest** CRG when the user's scenario matches any of these patterns:

- **Deployment failure is unacceptable** — disaster recovery, customer-facing services, or mission-critical workloads where capacity unavailability would cause an outage
- **Known scale-out events** — product launches, seasonal traffic spikes, or planned migrations where capacity must be guaranteed ahead of time
- **In-demand SKUs** — GPU, high-memory, or new/popular VM sizes that are frequently capacity-constrained
- **Specific SKU + zone + region required** — the workload cannot fall back to a different size, zone, or region
- **Centralized capacity pooling** — capacity is being managed centrally across multiple subscriptions (CRGs support cross-subscription sharing)

> **Note:** CRGs are typically used for critical workloads only, not all deployments. They are SLA-backed but billed at pay-as-you-go rates whether capacity is consumed or not.

## Key Concepts

| Concept                           | Description                                                                                                      |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Capacity Reservation Group**    | A logical container that holds one or more capacity reservations; must be associated with VMs at deployment time |
| **Capacity Reservation**          | A reservation for a specific VM size and quantity in a specific Availability Zone                                |
| **Scope**                         | CRGs are scoped to a single Azure region and subscription                                                        |
| **Billing**                       | Charges begin as soon as the reservation is created, whether or not VMs are deployed against it                  |

## Workflow

### Step 1: Gather Requirements

Ask the user for (infer when possible, except where noted):

| Requirement              | Required | Notes                                                                                                                                                                                                  |
|--------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Region**               | Yes      | Infer from context if possible (e.g., eastus, westeurope)                                                                                                                                              |
| **VM size(s)**           | Yes      | e.g., Standard_D4s_v5, Standard_E8s_v5                                                                                                                                                                 |
| **Quantity**             | Yes      | **Always ask — do not infer.** Users rarely want a quantity of 1, even when creating a reservation for a single VM, since they may plan to add more VMs later                                          |
| **Availability Zone(s)** | No       | CRGs can be created without zones. Only include zones if the user explicitly requests a zonal reservation. **Do not pick a zone on the user's behalf** unless they explicitly ask for any/random zone  |
| **Resource group**       | Yes      | Existing or new resource group name                                                                                                                                                                    |

### Step 2: Verify SKU Availability

**MCP tool:** `mcp_azure_mcp_quota` with `quota_region_availability_list` to check region/zone availability for the VM size.

**CLI fallback:**

```bash
az vm list-skus --location <region> --size <vm-size> --query "[?restrictions[]==null].{name:name, zones:locationInfo[0].zones}" -o table
```

- If the SKU is **not available** (or restricted) in the requested location/zone, suggest alternative VM sizes or zones from the output and ask the user to choose.
- If the user requested a zonal reservation, confirm the SKU is available in that specific zone.

### Step 3: Verify Quota

Use the [azure-quotas](../azure-quotas/SKILL.md) skill workflow. Capacity reservations consume vCPU quota the same as running VMs.

**CLI** (requires `az extension add --name quota`):

```bash
# Check current vCPU usage for the VM family
az quota usage show \
  --resource-name "<vm-family>" \
  --scope "/subscriptions/<sub-id>/providers/Microsoft.Compute/locations/<region>"
```

**Fallback:**

```bash
az vm list-usage --location <region> -o table --query "[?contains(localName, '<vm-family>')]"
```

- If quota is insufficient, guide the user to request an increase via `az quota create` or the [Azure portal quota blade](https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas).

### Step 4: Create Capacity Reservation Group and Reservation

Before creating, look up the VM's pay-as-you-go hourly rate and inform the user of the estimated monthly cost.

**Pricing lookup** (unauthenticated — see [Retail Prices API](../azure-compute/references/retail-prices-api.md)):

```bash
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Virtual%20Machines'%20and%20armRegionName%20eq%20'<region>'%20and%20armSkuName%20eq%20'<vm-size>'%20and%20priceType%20eq%20'Consumption'" \
  | jq '.Items[] | {skuName: .armSkuName, hourly: .retailPrice, meter: .meterName}'
```

> ⚠️ **Warning:** Billing starts immediately upon reservation creation. Present the estimated monthly cost to the user before proceeding: **quantity × hourly rate × 730 hours/month**. Clearly state that this is an **estimate based on current retail pay-as-you-go rates**, not a final cost or contractual commitment — actual charges may vary due to taxes, discounts (Reserved Instances, Savings Plans), or price changes. Get confirmation before creating.

**Create the resources:**

```bash
# Create the CRG
az capacity reservation group create \
  --resource-group <resource-group> \
  --name <crg-name> \
  --location <region> \
  --zones <zone>           # optional — omit if non-zonal

# Create the reservation
az capacity reservation create \
  --resource-group <resource-group> \
  --capacity-reservation-group <crg-name> \
  --name <reservation-name> \
  --sku <vm-size> \
  --capacity <quantity> \
  --zone <zone>
```

### Step 5: Verify Reservation

```bash
az capacity reservation show \
  --resource-group <resource-group> \
  --capacity-reservation-group <crg-name> \
  --name <reservation-name> \
  --query "{name:name, sku:sku, capacity:sku.capacity, provisioningState:provisioningState}"
```

### Step 6: Offer Next Steps

- Associate VMs or VMSS with the Capacity Reservation Group at deployment time
- Review billing implications (charges apply immediately upon creation)
- Consider combining with Reserved Instances or Savings Plans for cost optimization
- See [Capacity Reservation Overview](references/capacity-reservation-overview.md) for detailed guidance

## Error Handling

| Scenario                             | Action                                                                                                                                       |
|--------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Insufficient platform capacity       | Azure lacks physical hardware in the region/zone. Suggest a different zone, region, or VM size                                               |
| Duplicate SKU + zone in CRG          | Only one reservation per VM size per zone (or per size if non-zonal) is allowed in a CRG. Update the existing reservation's capacity instead |

## Best Practices

- Always specify an Availability Zone for production workloads
- Name CRGs descriptively (e.g., `crg-prod-eastus-z1`)
- Monitor reserved vs. consumed capacity to avoid paying for unused reservations
- Use tags for cost tracking and governance

## References

- [Capacity Reservation Overview](references/capacity-reservation-overview.md) — Concepts, constraints, and association patterns
