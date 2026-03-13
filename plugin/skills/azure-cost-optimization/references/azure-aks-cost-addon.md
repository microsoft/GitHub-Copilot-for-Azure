# AKS Cost Analysis Add-on

Enable namespace-level cost visibility using the built-in AKS cost monitoring add-on.

## Check Status

```powershell
# Check if add-on is enabled
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "addonProfiles.costAnalysis" -o json

# Check cluster tier (add-on requires Standard or Premium)
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "{tier:sku.tier, name:name}" -o table
```

## Enable Add-on

```powershell
# Requires Standard or Premium tier
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --enable-cost-analysis
```

## If Cluster is Free Tier

Warn user: upgrading to Standard costs ~$0.10/cluster/hour. Wait for confirmation, then:

```powershell
az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --tier standard

az aks update \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --enable-cost-analysis
```

## After Enabling

Namespace-level cost data is available in:
- Azure Portal: AKS cluster -> Cost Analysis blade
- Azure Cost Management: filter by cluster resource ID + `kubernetes namespace` dimension

> Risk: Low for enabling the add-on. Upgrading tier (Free -> Standard) has a cost — always confirm with user first.
