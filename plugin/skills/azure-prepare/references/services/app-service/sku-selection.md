# App Service SKU Selection

## SKU Comparison Matrix

| Feature | Free (F1) | Basic (B1-B3) | Standard (S1-S3) | Premium (P1v3-P3v3) | Isolated (I1v2-I3v2) |
|---------|:-:|:-:|:-:|:-:|:-:|
| **Custom domains** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **TLS/SSL bindings** | ❌ | ✅ (SNI) | ✅ (SNI + IP) | ✅ (SNI + IP) | ✅ (SNI + IP) |
| **Deployment slots** | ❌ | ❌ | 5 | 20 | 20 |
| **Auto-scale** | ❌ | ❌ | ✅ (10 inst.) | ✅ (30 inst.) | ✅ (100 inst.) |
| **VNet integration** | ❌ | ❌ | ✅ | ✅ | ✅ (ASE is in VNet) |
| **Private endpoints** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Always On** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Backup/Restore** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Hybrid Connections** | ❌ | ❌ | 25 | 200 | 200 |
| **Traffic Manager** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **SLA** | None | None | 99.95% | 99.95% | 99.95% |

## Pricing Overview

| SKU | vCPU | RAM | Storage | Approx. Monthly Cost |
|-----|------|-----|---------|---------------------|
| F1 | Shared | 1 GB | 1 GB | Free |
| B1 | 1 | 1.75 GB | 10 GB | ~$55 |
| B2 | 2 | 3.5 GB | 10 GB | ~$110 |
| S1 | 1 | 1.75 GB | 50 GB | ~$73 |
| S2 | 2 | 3.5 GB | 50 GB | ~$146 |
| P1v3 | 2 | 8 GB | 250 GB | ~$138 |
| P2v3 | 4 | 16 GB | 250 GB | ~$276 |
| P3v3 | 8 | 32 GB | 250 GB | ~$552 |
| I1v2 | 2 | 8 GB | 1 TB | ~$460 |

> 💡 **Tip:** Prices vary by region. Use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for exact figures.

## Decision Criteria

```
Production workload?
├─ No → Free (F1) or Basic (B1) for dev/test
└─ Yes
   Need deployment slots or auto-scale?
   ├─ No → Basic (B1-B3) if budget-constrained
   └─ Yes
      Need VNet integration or private endpoints?
      ├─ No → Standard (S1-S3)
      └─ Yes
         Need network isolation (dedicated ASE)?
         ├─ Yes → Isolated (I1v2+)
         └─ No
            Need private endpoints?
            ├─ Yes → Premium (P1v3+)
            └─ No → Standard (S1+) with VNet integration
```

## Feature Unlock Summary

Key features unlocked at each tier:

| Upgrade Path | Features Gained |
|-------------|-----------------|
| Free → Basic | Custom domains, TLS/SSL, Always On |
| Basic → Standard | Deployment slots, auto-scale, VNet integration, backups |
| Standard → Premium | Private endpoints, more slots (20), higher scale (30 inst.) |
| Premium → Isolated | Full network isolation (ASE), dedicated infrastructure |

## Bicep — App Service Plan with SKU

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: planName
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
    capacity: 2 // number of instances
  }
  kind: 'linux'
  properties: {
    reserved: true // required for Linux
  }
}
```

## Terraform — App Service Plan with SKU

```hcl
resource "azurerm_service_plan" "plan" {
  name                = var.plan_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = "P1v3"
}
```

## Scaling Within a Tier

Scale up (change SKU) vs scale out (add instances):

| Strategy | When to Use | How |
|----------|-------------|-----|
| Scale up | App needs more CPU/RAM | Change SKU (e.g., S1 → S2) |
| Scale out | Handle more concurrent load | Increase instance count or enable auto-scale |

> ⚠️ **Warning:** Scaling from one tier family to another (e.g., Standard to Premium) may cause a brief restart. Schedule changes during low-traffic windows.

## Recommendations by Workload

| Workload | Recommended SKU | Reason |
|----------|----------------|--------|
| Personal blog / prototype | F1 or B1 | Minimal cost, no SLA needed |
| Team dev/test | B1-B2 | Always On, custom domain |
| Production API | S1-S2 | Auto-scale, slots, VNet |
| Enterprise with compliance | P1v3+ | Private endpoints, 20 slots |
| Regulated / multi-tenant SaaS | I1v2+ | Full network isolation |
