# NAP Evidence Collection

Prefer fitting Azure MCP AKS reads. Use these fallbacks only with approved shell and Azure CLI access. `kubectl` also requires an authorized, target-bound context.

## Cluster and Pools

```bash
az aks show \
  --name "<CLUSTER_NAME>" --resource-group "<RESOURCE_GROUP>" \
  --query "{id:id,location:location,mode:nodeProvisioningProfile.mode,identityType:identity.type,ipFamilies:networkProfile.ipFamilies,loadBalancerSku:networkProfile.loadBalancerSku,agentPools:agentPoolProfiles[].{name:name,mode:mode,os:osType,sku:vmSize,cas:enableAutoScaling,max:maxCount,count:count,zones:availabilityZones,subnet:vnetSubnetId,labels:nodeLabels,taints:nodeTaints}}" -o json
```

## Scheduling State

```bash
kubectl get events --all-namespaces \
  --field-selector reason=FailedScheduling -o json
kubectl get pods --all-namespaces \
  --field-selector=status.phase=Pending -o json
kubectl get nodes -o json
```

## Scheduling History

Discover the available metric and its aggregation before querying:

```bash
az monitor metrics list-definitions --resource "<AKS_RESOURCE_ID>" \
  --query "[].{name:name.value,aggregation:primaryAggregationType}" -o json

az monitor metrics list --resource "<AKS_RESOURCE_ID>" \
  --metrics "<DISCOVERED_UNSCHEDULABLE_METRIC>" \
  --start-time "<START_TIME>" --end-time "<END_TIME>" \
  --interval PT1H --aggregation "<PRIMARY_AGGREGATION>" -o json
```

## Conditional Readiness

Run only checks triggered by an unresolved readiness question:

| Question | Minimal read and use |
|---|---|
| VM compatibility | `az vm list-skus --location "<LOCATION>" --resource-type virtualMachines --all -o json`; compare requirements with capabilities and restrictions. Filter by size only after narrowing the candidate |
| Quota headroom | `az vm list-usage --location "<LOCATION>" -o json`; check regional and family vCPU quota, plus Spot when proposed |
| Subnet capacity or access | `az network vnet subnet show --ids "<SUBNET_ID>" -o json`; verify planned growth and inspect identity access only when unresolved |
| Policy restriction | Inspect only the relevant definition and parameters at the affected scope |
| Volume topology | Read only referenced PVCs, StorageClasses, and bound PVs; exclude failures that another node cannot resolve |

SKU eligibility does not guarantee supply. Missing or inaccessible evidence remains unknown.
