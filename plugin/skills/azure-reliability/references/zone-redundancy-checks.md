# Zone Redundancy Checks

## Overview

Zone redundancy distributes compute instances across availability zones within a region. If one zone fails, instances in other zones continue serving traffic automatically.

## Resource Graph Queries

> **⚠️ Output format:** Use `-o json` (default) when running these queries from the agent. `az graph query -o table` only renders summary columns (`Count`, `Total_records`) and does not show projected fields. If you need a human-readable table, pipe JSON through `jq` or use `--query "data[]" -o table`.

### Check Function Apps for Zone Redundancy

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.web/serverfarms'
| where kind contains 'functionapp' or kind contains 'elastic'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, resourceGroup, location, sku=sku.name, zoneRedundant
" --query "data[]" -o json
```

**Interpretation:**
- `zoneRedundant = true` → ✅ Zone redundant
- `zoneRedundant = false` or null → ⚠️ Not zone redundant

**Requirements for zone redundancy:**
- Flex Consumption plan: supported in select regions (check with `az functionapp list-flexconsumption-locations --zone-redundant=true`)
- Premium (Elastic Premium): EP1, EP2, EP3 plans support zone redundancy. Minimum 2 always-ready instances.
- Dedicated (App Service) plan: Functions hosted on App Service plans follow App Service zone redundancy rules (see below)
- Consumption plan: ❌ Does NOT support zone redundancy

### Check Container Apps Environments for Zone Redundancy

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.app/managedenvironments'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, resourceGroup, location, zoneRedundant
" --query "data[]" -o json
```

**Interpretation:**
- `zoneRedundant = true` → ✅ Zone redundant
- `zoneRedundant = false` → ⚠️ Not zone redundant

**Important:** Zone redundancy for Container Apps environments must be set at creation time. It cannot be enabled on an existing environment — the environment must be recreated.

### Check App Service Plans for Zone Redundancy

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.web/serverfarms'
| where kind !contains 'functionapp' and kind !contains 'elastic'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, resourceGroup, location, sku=sku.name, tier=sku.tier, zoneRedundant
" --query "data[]" -o json
```

**Requirements for zone redundancy:**
- PremiumV2 (P1v2, P2v2, P3v2): ✅ Supported
- PremiumV3 (P1v3, P2v3, P3v3, P0v3): ✅ Supported
- PremiumV4: ✅ Supported
- Isolated V2 (ASE v3): ✅ Supported
- Standard, Basic, Free, Shared: ❌ Not supported
- Minimum instance count: 2 (platform distributes across zones)

### All-in-One: Find All Non-Zone-Redundant Compute

```bash
az graph query -q "
Resources
| where type in~ ('microsoft.web/serverfarms', 'microsoft.app/managedenvironments')
| extend zoneRedundant = tobool(properties.zoneRedundant)
| where zoneRedundant == false or isnull(zoneRedundant)
| project name, type, resourceGroup, location, sku=sku.name
| order by type asc
" --query "data[]" -o json
```

## Regions Supporting Availability Zones

Check current list:
```bash
az functionapp list-flexconsumption-locations --zone-redundant=true
```

Common regions with AZ support:
- East US, East US 2, West US 2, West US 3
- Central US, South Central US
- North Europe, West Europe, UK South
- France Central, Germany West Central, Sweden Central
- Southeast Asia, Japan East, Australia East

## Minimum Instance/Replica Validation

Zone redundancy alone isn't sufficient — the platform needs enough instances to distribute across zones.

### Check App Service / Functions Premium Instance Count

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.web/serverfarms'
| where tobool(properties.zoneRedundant) == true
| extend currentWorkers = toint(properties.numberOfWorkers)
| extend minRequired = 2
| extend hasSufficientInstances = currentWorkers >= minRequired
| project name, resourceGroup, sku=sku.name, currentWorkers, minRequired, hasSufficientInstances
" --query "data[]" -o json
```

### Check Container Apps Minimum Replicas

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.app/containerapps'
| extend minReplicas = toint(properties.template.scale.minReplicas)
| extend maxReplicas = toint(properties.template.scale.maxReplicas)
| project name, resourceGroup, minReplicas, maxReplicas
| where minReplicas < 2
" --query "data[]" -o json
```

**Interpretation:**
- Zone-redundant compute with < 2 instances/replicas → ⚠️ Insufficient for zone distribution
- Recommend: ≥ 2 minimum instances for zone-redundant plans

## Remediation

### Enable Zone Redundancy on Function App (Premium Plan)

```bash
# Create a new zone-redundant premium plan
az functionapp plan create \
  --name <plan-name> \
  --resource-group <rg> \
  --location <location> \
  --sku EP1 \
  --zone-redundant true

# Move function app to the new plan (or create new app on this plan)
az functionapp create \
  --name <app-name> \
  --resource-group <rg> \
  --plan <plan-name> \
  --storage-account <zrs-storage-account>
```

### Enable Zone Redundancy on Container Apps Environment

```bash
# Must create a new environment with zone redundancy
az containerapp env create \
  --name <env-name> \
  --resource-group <rg> \
  --location <location> \
  --zone-redundant true
```

⚠️ Existing apps must be migrated to the new environment.

### Enable Zone Redundancy on App Service Plan

```bash
# Create zone-redundant App Service plan
az appservice plan create \
  --name <plan-name> \
  --resource-group <rg> \
  --location <location> \
  --sku P1V3 \
  --zone-redundant true \
  --number-of-workers 3
```
