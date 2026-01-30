# Azure Kubernetes Service (AKS)

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| MCP tools | `azure__aks` (`aks_cluster_list`, `aks_nodepool_list`) |
| Best for | Complex microservices, full K8s control |
| Prerequisites | Docker, kubectl, azd |

## Deploy with azd (Required)

```bash
azd up --no-prompt                    # Deploy everything
azd provision --no-prompt             # Create cluster only
azd deploy --no-prompt                # Deploy workloads
azd down --force --purge              # Clean up (WARNING: deletes all)
```

> ⚠️ `azd down` permanently deletes ALL resources including persistent volumes.

## Prerequisites

```bash
# Install azd
brew tap azure/azure-dev && brew install azd  # macOS
winget install Microsoft.Azd                   # Windows

# Auth
azd auth login && azd env new <env-name>
```

**Run `/azure:preflight` before deploying.**

## Bicep Template

```bicep
resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: 'aks-${uniqueString(resourceGroup().id)}'
  location: resourceGroup().location
  identity: { type: 'SystemAssigned' }
  properties: {
    enableRBAC: true
    agentPoolProfiles: [{ name: 'systempool', count: 3, vmSize: 'Standard_DS2_v2', mode: 'System' }]
  }
}
```

## Node Pools

| Pool Type | Use Case |
|-----------|----------|
| System | Core services (CoreDNS, metrics-server) |
| User | Application workloads |
| Spot | Batch processing, interruptible |
| GPU | Machine learning |

```bash
az aks nodepool add -n userpool --cluster-name $CLUSTER -g $RG --node-count 3 --mode User
az aks nodepool update -n userpool --cluster-name $CLUSTER -g $RG --enable-cluster-autoscaler --min-count 1 --max-count 10
```

## Workload Identity

```bash
az aks update -n $CLUSTER -g $RG --enable-oidc-issuer --enable-workload-identity
OIDC=$(az aks show -n $CLUSTER -g $RG --query "oidcIssuerProfile.issuerUrl" -o tsv)
az identity create --name myidentity -g $RG
az identity federated-credential create --name myfc --identity-name myidentity -g $RG --issuer $OIDC --subject system:serviceaccount:default:mysa
```

## Networking

| Plugin | Use Case |
|--------|----------|
| Azure CNI | Enterprise, network policies |
| Kubenet | Cost-effective, simpler |

```bash
# Install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml
```

## Scaling

```bash
# HPA
kubectl autoscale deployment myapp --cpu-percent=50 --min=2 --max=10

# Cluster autoscaler
az aks nodepool update -n userpool --cluster-name $CLUSTER -g $RG --enable-cluster-autoscaler --min-count 1 --max-count 10
```

## Management

```bash
az aks list -o table                              # List clusters
az aks get-upgrades -n $CLUSTER -g $RG            # Check upgrades
az aks upgrade -n $CLUSTER -g $RG --kubernetes-version 1.29.0
az aks enable-addons -n $CLUSTER -g $RG --addons monitoring
```

## MCP Tools

```javascript
await azure__aks({ command: "aks_cluster_list", parameters: { subscription: "sub" } });
await azure__aks({ command: "aks_nodepool_list", parameters: { "cluster-name": "myCluster", "resource-group": "RG" } });
```

## Best Practices

- Use managed identity for cluster auth
- Enable Azure Policy and network policy
- Use private clusters for production
- Enable Container Insights monitoring
- Use availability zones for HA
- Minimum 3 nodes for production
- Enable autoscaling (HPA + cluster)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cluster creation fails | Check quotas: `az vm list-usage --location eastus` |
| Pods pending | Check node resources, scale node pools |
| Image pull errors | Attach ACR: `az aks update -n CLUSTER -g RG --attach-acr ACR_NAME` |
| DNS issues | Check CoreDNS: `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
