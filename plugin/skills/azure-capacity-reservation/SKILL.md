---
name: azure-capacity-reservation
description: "Create and manage Azure Capacity Reservation Groups (CRGs) to guarantee compute capacity in a region. WHEN: capacity reservation, reserve VMs, guarantee capacity, capacity reservation group, CRG, reserve compute, ensure VM availability, pre-provision capacity, capacity planning, reserved instances capacity, associate VM with CRG, attach VM to capacity reservation, disassociate VM from CRG, remove VM from capacity reservation, find CRG for VM."
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
| **Quantity**             | Yes      | **Always ask — do not infer.**                                                                                                                                                                         |
| **Availability Zone(s)** | No       | CRGs can be created without zones. Only include zones if the user explicitly requests a zonal reservation. **Do not pick a zone on the user's behalf** unless they explicitly ask for any/random zone  |
| **Resource group**       | Yes      | Existing or new resource group name                                                                                                                                                                    |

### Step 2: Create Capacity Reservation Group and Reservation

```bash
# Create the CRG
az capacity reservation group create \
  -g <resource-group> \
  -n <crg-name> \
  -l <region> \
  --zones <zone>           # optional — omit if non-zonal

# Create the reservation
az capacity reservation create \
  -g <resource-group> \
  -c <crg-name> \
  -n <reservation-name> \
  --sku <vm-size> \
  --capacity <quantity> \
  --zone <zone>
```

### Step 3: Verify Reservation

```bash
az capacity reservation show \
  -g <resource-group> \
  -c <crg-name> \
  -n <reservation-name> \
  --query "{name:name, sku:sku, capacity:sku.capacity, provisioningState:provisioningState}"
```

### Step 4: Offer Next Steps

- Associate VMs or VMSS with the Capacity Reservation Group at deployment time
- Estimate monthly cost — **quantity × hourly rate × 730 hours/month** (estimate only, not a contractual commitment):
  ```bash
  curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName%20eq%20'Virtual%20Machines'%20and%20armRegionName%20eq%20'<region>'%20and%20armSkuName%20eq%20'<vm-size>'%20and%20priceType%20eq%20'Consumption'" \
    | jq '.Items[] | {sku: .armSkuName, hourly: .retailPrice, meter: .meterName}'
  ```
- See [Capacity Reservation Overview](references/capacity-reservation-overview.md) for detailed guidance

## Managing Existing Reservations

For operations beyond creation, see the relevant section in the [Capacity Reservation Overview](references/capacity-reservation-overview.md):

- **Associate a VM or VMSS** with a CRG — see [Association Model](references/capacity-reservation-overview.md#association-model)
- **Disassociate a VM or VMSS** from a CRG — see [Disassociating from a CRG](references/capacity-reservation-overview.md#disassociating-from-a-capacity-reservation-group)
- **Find a matching CRG** for a VM — see [Finding Valid CRGs](references/capacity-reservation-overview.md#finding-valid-crgs-for-a-vm)
- **Estimate cost** — see [Estimating Reservation Cost](references/capacity-reservation-overview.md#estimating-reservation-cost)

## Error Handling

| Scenario                             | Action                                                                                                                                                                                        |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SKU not available in region/zone     | Run `az vm list-skus --location <region> --size <vm-size> --resource-type virtualMachines -o table`. Suggest alternatives from output                                                         |
| Quota exceeded                       | Use the [azure-quotas](../azure-quotas/SKILL.md) skill to check usage and request an increase                                                                                                 |
| Insufficient platform capacity       | Azure lacks physical hardware in the region/zone. Suggest a different zone, region, or VM size                                                                                                |
| Duplicate SKU + zone in CRG          | Only one reservation per VM size per zone (or per size if non-zonal) is allowed in a CRG. Update the existing reservation's capacity instead                                                  |

## References

- [Capacity Reservation Overview](references/capacity-reservation-overview.md) — Concepts, constraints, and association patterns
