# Bicep ↔ Azure What-If Workflow

Compare Bicep templates against live Azure state without using ARM what-if. Parses Bicep into an expected resource model, queries Azure for actual state, and compares.

---

## Steps

| # | Action | Details |
|---|--------|---------|
| 1 | **Authenticate** | Verify Azure session — see [azure-authentication.md](procedures/azure-authentication.md). **HARD GATE**. |
| 2 | **Accept Inputs** | Get: (a) Bicep project folder, (b) Azure scope (resource group). |
| 3 | **Parse Bicep** | Apply [bicep-parsing.md](procedures/bicep-parsing.md) at Standard depth. Resolve parameter values from `.bicepparam`. Build expected resource model. |
| 4 | **Discover Azure Resources** | Query live resources in the target resource group. Apply [resource-filtering.md](procedures/resource-filtering.md) "Exclude for Bicep" column. |
| 5 | **Check Resource Provider Registration** | For each resource type in Bicep, verify the provider is registered: `az provider show -n <namespace> --query registrationState -o tsv`. Report unregistered providers. |
| 6 | **Match Resources** | Apply [resource-matching.md](procedures/resource-matching.md). |
| 7 | **Categorize Changes** | For each resource, assign a category: |

### Change Categories

| Category | Meaning |
|---|---|
| **Create** | In Bicep but not in Azure — will be created |
| **Modify** | In both but properties differ — will be updated |
| **Delete** | In Azure but not in Bicep — may be orphaned (not auto-deleted by Bicep) |
| **No Change** | In both and properties match |

### Step 8: Present What-If Report

```
## Bicep What-If Report

| # | Resource | Type | Change |
|---|----------|------|--------|
| 1 | vnet-web | Microsoft.Network/virtualNetworks | No Change |
| 2 | app-api | Microsoft.Web/sites | Modify (SKU: B1 → S1) |
| 3 | vm-01 | Microsoft.Compute/virtualMachines | Create |
| 4 | old-storage | Microsoft.Storage/storageAccounts | Delete (Azure only) |

Summary: 1 Create | 1 Modify | 1 Delete | 1 No Change
```

> ⚠️ **Note**: Bicep deployments do NOT auto-delete resources not in the template (unless using complete mode). "Delete" means the resource exists in Azure but is not managed by this Bicep — it may be intentionally out of scope.
