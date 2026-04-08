# Capacity Reservation Overview

Reference material for Azure Capacity Reservation Groups and Capacity Reservations.

## What Is a Capacity Reservation Group?

A Capacity Reservation Group (CRG) is a logical container for one or more capacity reservations. It acts as the association point for VMs and VMSS — you associate a VM or scale set with the **group**, and Azure matches the VM to a suitable reservation within that group.

## Constraints

| Constraint                     | Detail                                                                          |
|--------------------------------|---------------------------------------------------------------------------------|
| **Region-scoped**              | A CRG and all its reservations must be in the same Azure region                 |
| **Zone-specific**              | Each reservation targets a specific Availability Zone (or is non-zonal)         |
| **Subscription-bound**         | CRGs cannot span subscriptions                                                  |
| **VM size per reservation**    | Each capacity reservation covers exactly one VM size                            |
| **Billing starts immediately** | You are charged for reserved capacity whether or not VMs are running against it |

## Association Model

```text
Capacity Reservation Group (CRG)
├── Capacity Reservation: Standard_D4s_v5 × 5 (Zone 1)
├── Capacity Reservation: Standard_D4s_v5 × 3 (Zone 2)
└── Capacity Reservation: Standard_E8s_v5 × 2 (Zone 1)

VM / VMSS
└── capacityReservationGroup.id = <CRG resource ID>
    └── Azure auto-matches to a reservation with the right VM size + zone
```

### Associating VMs

When creating or updating a VM, set the `capacityReservationGroup` property:

```bash
az vm create \
  --resource-group <rg> \
  --name <vm-name> \
  --image <image> \
  --size Standard_D4s_v5 \
  --zone 1 \
  --capacity-reservation-group <crg-id>
```

### Associating VMSS

```bash
az vmss create \
  --resource-group <rg> \
  --name <vmss-name> \
  --image <image> \
  --vm-sku Standard_D4s_v5 \
  --instance-count 5 \
  --zones 1 \
  --capacity-reservation-group <crg-id>
```

## Disassociating from a Capacity Reservation Group

Both the VM/VMSS and the underlying capacity reservation logically occupy capacity. Azure imposes constraints to avoid ambiguous allocation states, so you cannot simply remove the association while resources are running against it.

There are three ways to disassociate. The commands below use `az vm` — for VMSS, substitute `az vmss` and add `az vmss update-instances --instance-ids "*"` as a final step when using a **Manual** upgrade policy.

### Option 1: Deallocate, then remove association

Best when the VM/VMSS can tolerate downtime.

```bash
az vm deallocate --resource-group <rg> --name <vm-name>
az vm update --resource-group <rg> --name <vm-name> --capacity-reservation-group None
az vm start --resource-group <rg> --name <vm-name>   # optional
```

### Option 2: Set reserved quantity to zero, then remove association

Best when the VM/VMSS cannot be deallocated and the reservation is no longer needed.

```bash
az capacity reservation update \
  --resource-group <rg> --capacity-reservation-group <crg> \
  --name <reservation-name> --capacity 0
az vm update --resource-group <rg> --name <vm-name> --capacity-reservation-group None
```

### Option 3: Delete the VM/VMSS

Deleting the resource automatically removes the association. Some latency may occur before the capacity reservation allocation state updates.

### VMSS Upgrade Policy Behavior

| Policy        | Behavior                                                               |
|---------------|------------------------------------------------------------------------|
| **Automatic** | Instances update automatically — no further action needed              |
| **Rolling**   | Instances update in batches with an optional pause between them        |
| **Manual**    | You must run `az vmss update-instances --instance-ids "*"` per update  |

## Common CLI Commands

| Action                      | Command                                                                                                                       |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| List CRGs                   | `az capacity reservation group list --resource-group <rg>`                                                                    |
| Show CRG                    | `az capacity reservation group show --resource-group <rg> --name <crg>`                                                       |
| Delete CRG                  | `az capacity reservation group delete --resource-group <rg> --name <crg>`                                                     |
| List reservations           | `az capacity reservation list --resource-group <rg> --capacity-reservation-group <crg>`                                       |
| Update reservation quantity | `az capacity reservation update --resource-group <rg> --capacity-reservation-group <crg> --name <res> --capacity <new-count>` |
| Delete reservation          | `az capacity reservation delete --resource-group <rg> --capacity-reservation-group <crg> --name <res>`                        |

## Finding Valid CRGs for a VM

To associate a VM with a CRG, the CRG must contain a capacity reservation that matches the VM's **size**, **region**, and **zone** (if zonal). Since CRGs are listed per-resource-group via CLI, discovering the right one across multiple resource groups requires querying at the subscription level.

### Option 1: Azure Resource Graph (recommended)

ARG can query all capacity reservations across resource groups in a single call, filtering by location, VM size, and zone. This is the most efficient approach.

**MCP tool:**

```yaml
azure_resources-query_azure_resource_graph
  arg_intent: "find all capacity reservations matching VM size <size> in location <region>"
  useDefaultSubscriptionFilter: true
```

**CLI fallback:**

```bash
az graph query -q "
  Resources
  | where type =~ 'Microsoft.Compute/capacityReservationGroups/capacityReservations'
  | where location =~ '<region>'
  | where properties.provisioningState =~ 'Succeeded'
  | where sku.name =~ '<vm-size>'
  | project id,
            crgId = extract('(.*)/capacityReservations', 1, id),
            resourceGroup,
            zones,
            size = sku.name,
            capacity = coalesce(sku.capacity, 0),
            associationCount = coalesce(array_length(properties.virtualMachinesAssociated), 0),
            location
" -o table
```

> ⚠️ **Prerequisite:** `az extension add --name resource-graph`

The `crgId` in the output is the parent Capacity Reservation Group resource ID — this is the value to use when associating a VM or VMSS.

To further narrow results for zonal VMs, add a zone filter:

```kql
| where zones has '<zone>'
```

### Option 2: CLI enumeration

If ARG is unavailable, list CRGs per resource group and inspect their reservations:

```bash
# List all CRGs in a resource group
az capacity reservation group list --resource-group <rg> -o table

# List reservations within a CRG and check for matching size/capacity
az capacity reservation list \
  --resource-group <rg> \
  --capacity-reservation-group <crg-name> \
  --query "[?sku.name=='<vm-size>'].{name:name, size:sku.name, capacity:sku.capacity, zones:zones}" \
  -o table
```

> This approach requires knowing (or iterating over) the resource groups that contain CRGs.

## Estimating Reservation Cost

Capacity reservations are billed at the same pay-as-you-go rate as the underlying VM size, whether or not VMs are running against them. Use the [Retail Prices API guide](../azure-compute/references/retail-prices-api.md) (unauthenticated) to look up hourly rates.

**Estimated monthly cost:** `quantity × hourly rate × 730`

> ⚠️ Prices returned are **estimates based on current retail pay-as-you-go rates**, not a final cost or contractual commitment. Actual charges may vary due to taxes, discounts (Reserved Instances, Savings Plans), or price changes.

## Important Notes

- **Deletion is blocked until prerequisites are met:** Azure rejects a CRG delete unless all VMs/VMSS are disassociated and all capacity reservations are deleted. Order: disassociate VMs/VMSS → delete reservations → delete group.
- **Quota required:** Capacity reservations consume vCPU quota just like running VMs.

## Learn More

- [Azure Capacity Reservations documentation](https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-overview)
- [Create a Capacity Reservation](https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-create)
- [Associate a VM to a Capacity Reservation Group](https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-associate-vm)
- [Remove/disassociate a VM from a Capacity Reservation Group](https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-remove-vm)
- [Remove/disassociate a VMSS from a Capacity Reservation Group](https://learn.microsoft.com/en-us/azure/virtual-machines/capacity-reservation-remove-virtual-machine-scale-set)
