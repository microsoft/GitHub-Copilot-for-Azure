# Configure Zone Redundancy

## Overview

This reference covers enabling zone redundancy on existing compute resources. Always ensure storage is ZRS/GZRS before enabling zone-redundant compute.

## Prerequisites Check

Before enabling zone redundancy, verify:
1. Region supports availability zones
2. Plan/SKU supports zone redundancy
3. Storage account is ZRS or GZRS (if not, upgrade storage FIRST)

## Azure Functions

### Flex Consumption Plan

Flex Consumption plans support zone redundancy as a property update:

```bash
# Check if region supports zone-redundant Flex Consumption
az functionapp list-flexconsumption-locations --zone-redundant true -o table

# Enable zone redundancy on existing Flex Consumption plan
az resource update \
  --resource-group <rg> \
  --name <plan-name> \
  --resource-type "Microsoft.Web/serverfarms" \
  --set properties.zoneRedundant=true
```

⚠️ If the above in-place update is not supported, create a new zone-redundant plan and migrate:

```bash
# Create new zone-redundant Flex Consumption plan
az functionapp plan create \
  --name <new-plan-name> \
  --resource-group <rg> \
  --location <location> \
  --sku FC1 \
  --zone-redundant true

# Move function app to new plan
az functionapp update \
  --name <app-name> \
  --resource-group <rg> \
  --plan <new-plan-name>
```

### Premium (Elastic Premium) Plan

For **existing** Premium plans:
```bash
# Enable zone redundancy on existing plan
az resource update \
  --resource-group <rg> \
  --name <plan-name> \
  --resource-type "Microsoft.Web/serverfarms" \
  --set properties.zoneRedundant=true sku.capacity=2

# Update each function app on this plan to require minimum elastic instances
az functionapp update \
  --name <app-name> \
  --resource-group <rg> \
  --set siteConfig.minimumElasticInstanceCount=2
```

For **new** Premium plans:
```bash
az functionapp plan create \
  --name <plan-name> \
  --resource-group <rg> \
  --location <location> \
  --sku EP1 \
  --zone-redundant true \
  --min-instances 2
```

⚠️ Premium plans require minimum 2 always-ready instances for zone redundancy. Each function app on the plan must also set `minimumElasticInstanceCount >= 2`.

### Consumption Plan → Upgrade Path

Consumption plans do NOT support zone redundancy. User must upgrade:
- **Recommended:** Upgrade to Flex Consumption (similar serverless model, supports ZR)
- **Alternative:** Upgrade to Premium (more control, higher base cost)

Inform user of cost implications before proceeding.

## Azure Container Apps

### ⛔ IMPORTANT: Environment must be recreated (blue/green workflow)

Zone redundancy for Container Apps is set at **environment creation time only**. It cannot be enabled on an existing environment.

**Blue/green migration workflow:**

```bash
# 1. Create new zone-redundant environment
az containerapp env create \
  --name <new-env-name> \
  --resource-group <rg> \
  --location <location> \
  --zone-redundant true

# 2. Export existing app configuration for reference
az containerapp show \
  --name <app-name> \
  --resource-group <rg> \
  -o json > old-app-config.json

# 3. Deploy app with a NEW NAME into the new environment
#    Extract the container image, env vars, secrets, scaling rules from old-app-config.json
#    Then create using CLI flags or a validated YAML spec:
az containerapp create \
  --name <app-name>-new \
  --resource-group <rg> \
  --environment <new-env-name> \
  --image <container-image> \
  --target-port <port> \
  --ingress external

# 4. Migrate additional settings:
#    - Environment variables and secrets
#    - Dapr configuration (if used)
#    - Custom domains and certificates
#    - Managed identity assignments
#    - Scaling rules

# 5. Verify new app is running and healthy
az containerapp show \
  --name <app-name>-new \
  --resource-group <rg> \
  --query "properties.runningStatus"

# Test the new app endpoint directly:
curl https://<new-app-fqdn>/health

# 6. Switch traffic — update DNS/Front Door/Traffic Manager to point to new app
#    OR swap custom domain from old app to new app

# 7. Only after confirming new app is serving traffic correctly:
#    Delete old app, then old environment
az containerapp delete --name <app-name> --resource-group <rg> --yes
az containerapp env delete --name <old-env-name> --resource-group <rg> --yes
```

⚠️ **Warnings:**
- Use a new app name to avoid conflicts (rename after old is deleted if needed)
- **Check the old environment for other apps/jobs first** — don't delete a shared environment
- Migrate all secrets, identity, Dapr, and custom domain settings before switching traffic
- This involves a DNS/traffic switch — plan for brief propagation delay

## Azure App Service

```bash
# Create zone-redundant App Service plan
az appservice plan create \
  --name <plan-name> \
  --resource-group <rg> \
  --location <location> \
  --sku P1V3 \
  --zone-redundant true \
  --number-of-workers 2

# Move app to new plan (if needed)
az webapp update \
  --name <app-name> \
  --resource-group <rg> \
  --set serverFarmId=/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/serverfarms/<plan-name>
```

**Plan requirements:**
- PremiumV2, PremiumV3, PremiumV4, or Isolated V2
- Minimum 2 workers

## Verification

After enabling zone redundancy, verify:

```bash
az graph query -q "
Resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms' or type =~ 'microsoft.app/managedenvironments'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, type, zoneRedundant
" -o table
```

All resources should show `zoneRedundant = true`.
