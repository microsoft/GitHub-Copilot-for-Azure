# CLI Reference for AKS

```bash
# List AKS clusters
az aks list --output table

# Show cluster details
az aks show --name CLUSTER --resource-group RG

# Get available Kubernetes versions
az aks get-versions --location LOCATION --output table

# Create AKS Automatic cluster
az aks create --name CLUSTER --resource-group RG --sku automatic \
  --network-plugin azure --network-plugin-mode overlay \
  --enable-oidc-issuer --enable-workload-identity

# Create AKS Standard cluster
az aks create --name CLUSTER --resource-group RG \
  --node-count 3 --zones 1 2 3 \
  --network-plugin azure --network-plugin-mode overlay \
  --enable-cluster-autoscaler --min-count 1 --max-count 10

# Get credentials
az aks get-credentials --name CLUSTER --resource-group RG

# List node pools
az aks nodepool list --cluster-name CLUSTER --resource-group RG --output table

# Enable monitoring
az aks enable-addons --name CLUSTER --resource-group RG \
  --addons monitoring --workspace-resource-id WORKSPACE_ID
```