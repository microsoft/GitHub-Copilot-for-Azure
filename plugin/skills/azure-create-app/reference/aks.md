# Azure Kubernetes Service (AKS) Deployment Guide

Complete reference for deploying and managing containerized workloads on Azure Kubernetes Service requiring full Kubernetes control.

---

## Overview

Azure Kubernetes Service (AKS) is a managed Kubernetes container orchestration service that simplifies deploying and managing containerized applications. AKS provides enterprise-grade Kubernetes with integrated Azure services.

**Key Benefits:**
- **Managed Kubernetes** - Azure handles control plane management
- **Enterprise features** - RBAC, Azure AD integration, network policies
- **Scalability** - Automatic node scaling and pod autoscaling
- **Integrated monitoring** - Azure Monitor and Container Insights
- **Security** - Private clusters, workload identity, policy enforcement
- **Flexible networking** - Azure CNI, Kubenet, Calico network policies

**When to use AKS:**
- Need full Kubernetes capabilities and control
- Have Kubernetes expertise in your team
- Complex multi-service microservices architectures
- Require custom controllers, operators, or CRDs
- Need specific Kubernetes features (StatefulSets, DaemonSets, service mesh)
- Running existing Kubernetes workloads

**For simpler scenarios, consider Azure Container Apps.**

---

## Always Use azd for Deployments

> **Always use `azd` (Azure Developer CLI) for Azure provisioning and AKS deployments.**
> The `azd` tool provides a complete, reproducible deployment workflow for all AKS scenarios.

```bash
# Deploy everything - THIS IS THE REQUIRED APPROACH
azd up --no-prompt

# Or step-by-step:
azd provision --no-prompt   # Create AKS cluster, ACR, networking
azd deploy --no-prompt      # Deploy application to cluster

# Preview changes before deployment
azd provision --preview

# Clean up test environments
azd down --force --purge
```

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** including:
> - AKS cluster with all workloads and persistent volumes
> - Container Registry with all images
> - Key Vault with all secrets (use `--purge` to bypass soft-delete)
> - Storage accounts and databases
>
> Always back up important data before running `azd down`.

**Why azd is required:**
- **Parallel provisioning** - Deploys in seconds, not minutes
- **Automatic ACR integration** - No image pull failures or manual credential setup
- **Single command** - `azd up` replaces 5+ commands
- **Reproducible** - Infrastructure as Code with Bicep
- **Environment management** - Easy dev/staging/prod separation
- **Consistent workflow** - Same commands work across all Azure services

---

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| MCP tools | `azure__aks` (commands: `aks_cluster_list`, `aks_nodepool_list`) |
| Best for | Complex microservices, full K8s control |
| Prerequisites | Docker, kubectl, azd |

---

## Prerequisites

### Required Tools

**Azure Developer CLI (azd):**
```bash
# macOS
brew tap azure/azure-dev && brew install azd

# Windows
winget install Microsoft.Azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash
```

**kubectl:**
```bash
# macOS
brew install kubectl

# Windows
winget install Kubernetes.kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

**Docker Desktop:**
```bash
# Download from https://www.docker.com/products/docker-desktop
# Verify installation
docker version
```

### Authentication

```bash
# Login to Azure with azd
azd auth login

# Verify login status
azd auth login --check-status

# Set environment and subscription
azd env new <environment-name>
azd env set AZURE_SUBSCRIPTION_ID "<subscription-id>"
```

---

## Pre-flight Check

**Run `/azure:preflight` before deploying** to verify:
- Tools installed (azd, docker, kubectl)
- Authentication valid
- Quotas sufficient
- Docker running
- Subscription has capacity

---

## Quick Deploy with azd

### MCP Tools for AKS

Use the Azure MCP server's azd tools (`azure__azd`) for validation:

| Command | Description |
|---------|-------------|
| `validate_azure_yaml` | Validate azure.yaml before deployment |
| `docker_generation` | Generate Dockerfiles for AKS containers |
| `infrastructure_generation` | Generate Bicep templates for AKS |
| `project_validation` | Comprehensive validation before deployment |
| `error_troubleshooting` | Diagnose azd errors |

**Validate before deployment:**
```javascript
const validation = await azure__azd({
  command: "validate_azure_yaml",
  parameters: { path: "./azure.yaml" }
});
```

### Using AZD Template

```bash
# 1. Initialize from template
azd init --template azure-samples/aks-store-quickstart

# 2. Deploy (provisions cluster + deploys workloads in parallel)
# Use --no-prompt for automation/agent scenarios
azd up --no-prompt

# 3. Get cluster credentials
azd env get-value AZURE_AKS_CLUSTER_NAME | xargs -I {} az aks get-credentials --name {} --resource-group $(azd env get-value AZURE_RESOURCE_GROUP)

# 4. Verify deployment
kubectl get pods --all-namespaces

# 5. Iterate on code changes
azd deploy --no-prompt

# 6. Clean up test environment (WARNING: deletes all resources)
azd down --force --purge
```

### Custom Bicep for AKS

Create `infra/main.bicep`:
```bicep
param location string = resourceGroup().location
param clusterName string = 'aks-${uniqueString(resourceGroup().id)}'

resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: clusterName
    enableRBAC: true
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
    }
    agentPoolProfiles: [
      {
        name: 'systempool'
        count: 3
        vmSize: 'Standard_DS2_v2'
        mode: 'System'
        osType: 'Linux'
        enableAutoScaling: true
        minCount: 1
        maxCount: 5
      }
    ]
  }
}

output clusterName string = aks.name
output resourceGroupName string = resourceGroup().name
```

---

## Cluster Creation (Legacy Reference)

> **⚠️ Do not use these commands.** Always use `azd up --no-prompt` for AKS deployments.
> The commands below are legacy reference only for troubleshooting or when azd absolutely cannot be used.

```bash
# Set variables
RESOURCE_GROUP="myResourceGroup"
CLUSTER_NAME="myAKSCluster"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create AKS cluster with managed identity
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --node-count 3 \
    --node-vm-size Standard_DS2_v2 \
    --enable-managed-identity \
    --generate-ssh-keys \
    --network-plugin azure \
    --network-policy azure \
    --enable-addons monitoring

# Get cluster credentials
az aks get-credentials \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP
```

### Cluster Configuration Options

```bash
# Create with availability zones
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --zones 1 2 3 \
    --node-count 3

# Create with Azure CNI and network policy
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --network-plugin azure \
    --network-policy azure

# Create with Azure AD integration
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --enable-aad \
    --aad-admin-group-object-ids <group-id>

# Create private cluster
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --enable-private-cluster
```

---

## Node Pools

AKS supports multiple node pools with different VM sizes and configurations.

### Node Pool Types

| Pool Type | Mode | Use Case |
|-----------|------|----------|
| **System** | System | Core cluster services (CoreDNS, metrics-server) |
| **User (General)** | User | Standard application workloads |
| **User (Spot)** | User | Batch processing, interruptible workloads |
| **User (GPU)** | User | Machine learning, graphics processing |

### Managing Node Pools

```bash
# Add user node pool
az aks nodepool add \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name userpool \
    --node-count 3 \
    --node-vm-size Standard_DS3_v2 \
    --mode User

# Add spot node pool (for cost savings)
az aks nodepool add \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name spotpool \
    --priority Spot \
    --eviction-policy Delete \
    --spot-max-price -1 \
    --node-count 3 \
    --node-vm-size Standard_DS2_v2

# Add GPU node pool
az aks nodepool add \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name gpupool \
    --node-count 1 \
    --node-vm-size Standard_NC6 \
    --node-taints sku=gpu:NoSchedule

# Scale node pool
az aks nodepool scale \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name userpool \
    --node-count 5

# Enable autoscaler on node pool
az aks nodepool update \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name userpool \
    --enable-cluster-autoscaler \
    --min-count 1 \
    --max-count 10

# List node pools
az aks nodepool list \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --output table

# Delete node pool
az aks nodepool delete \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name spotpool
```

---

## Workload Identity (Recommended)

Workload Identity is the recommended way for pods to access Azure resources. It replaces pod-managed identity.

```bash
# Enable OIDC issuer and workload identity
az aks update \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --enable-oidc-issuer \
    --enable-workload-identity

# Get OIDC issuer URL
OIDC_ISSUER=$(az aks show \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "oidcIssuerProfile.issuerUrl" -o tsv)

# Create managed identity
az identity create \
    --name myworkloadidentity \
    --resource-group $RESOURCE_GROUP

# Get identity client ID
IDENTITY_CLIENT_ID=$(az identity show \
    --name myworkloadidentity \
    --resource-group $RESOURCE_GROUP \
    --query clientId -o tsv)

# Create federated identity credential
az identity federated-credential create \
    --name myfc \
    --identity-name myworkloadidentity \
    --resource-group $RESOURCE_GROUP \
    --issuer $OIDC_ISSUER \
    --subject system:serviceaccount:default:myserviceaccount
```

**Kubernetes manifest with workload identity:**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: myserviceaccount
  namespace: default
  annotations:
    azure.workload.identity/client-id: <IDENTITY_CLIENT_ID>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: myserviceaccount
      containers:
      - name: app
        image: myapp:latest
```

---

## Deployment Strategies

### Rolling Update (Default)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max pods above desired count
      maxUnavailable: 1   # Max pods unavailable during update
  template:
    spec:
      containers:
      - name: app
        image: myapp:v2
```

### Blue-Green Deployment

```bash
# Deploy green version
kubectl apply -f deployment-green.yaml

# Wait for green to be ready
kubectl wait --for=condition=available --timeout=300s deployment/myapp-green

# Switch service to green
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'

# Delete blue version
kubectl delete deployment myapp-blue
```

### Canary Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1  # 10% traffic to canary
```

---

## Networking

### Network Plugins

| Plugin | Description | Use Case |
|--------|-------------|----------|
| **Azure CNI** | Each pod gets Azure VNET IP | Enterprise, network policies |
| **Kubenet** | Pods use private IPs | Cost-effective, simpler |

### Network Policies

```bash
# Enable Azure Network Policy
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --network-plugin azure \
    --network-policy azure

# Or use Calico
az aks create \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --network-plugin azure \
    --network-policy calico
```

**Example network policy:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-from-other-namespaces
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}
```

### Ingress Controllers

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Or use Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx
```

**Ingress resource:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp
            port:
              number: 80
```

---

## Scaling

### Horizontal Pod Autoscaler (HPA)

```bash
# Create HPA
kubectl autoscale deployment myapp \
    --cpu-percent=50 \
    --min=2 \
    --max=10

# Or use manifest
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
EOF
```

### Cluster Autoscaler

```bash
# Enable on node pool
az aks nodepool update \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name userpool \
    --enable-cluster-autoscaler \
    --min-count 1 \
    --max-count 10

# Update autoscaler settings
az aks nodepool update \
    --cluster-name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --name userpool \
    --update-cluster-autoscaler \
    --min-count 2 \
    --max-count 20
```

---

## Cluster Management

### Cluster Operations

```bash
# List clusters
az aks list --output table

# Get cluster info
az aks show \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP

# Upgrade cluster
az aks get-upgrades \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP

az aks upgrade \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --kubernetes-version 1.29.0

# Start/stop cluster (dev/test only)
az aks stop --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP
az aks start --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP

# Enable/disable addons
az aks enable-addons \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --addons monitoring,azure-policy

az aks disable-addons \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --addons http_application_routing
```

### Cluster Configuration

```bash
# Enable Azure Policy
az aks enable-addons \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --addons azure-policy

# Enable monitoring with Container Insights
az aks enable-addons \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --addons monitoring \
    --workspace-resource-id <log-analytics-workspace-id>

# Update to private cluster
az aks update \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --enable-private-cluster

# Rotate cluster certificates
az aks rotate-certs \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP
```

---

## MCP Tools (For Queries Only)

Use MCP tools to **query** existing AKS resources, not deploy:

| Command | Description | Parameters |
|---------|-------------|------------|
| `aks_cluster_list` | List AKS clusters in subscription | `subscription`, `resource-group` (optional) |
| `aks_nodepool_list` | List node pools in a cluster | `cluster-name`, `resource-group` |

**Example usage:**
```javascript
// List all AKS clusters
const clusters = await azure__aks({
  intent: "List AKS clusters",
  command: "aks_cluster_list",
  parameters: {
    subscription: "my-subscription-id"
  }
});

// List node pools
const nodePools = await azure__aks({
  intent: "List node pools",
  command: "aks_nodepool_list",
  parameters: {
    "cluster-name": "myAKSCluster",
    "resource-group": "myResourceGroup"
  }
});
```

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

---

## Monitoring and Logging

### Container Insights

```bash
# Enable Container Insights
az aks enable-addons \
    --name $CLUSTER_NAME \
    --resource-group $RESOURCE_GROUP \
    --addons monitoring

# Query logs with kubectl
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container-name>
kubectl logs -f <pod-name>  # Follow logs

# View logs for all pods in deployment
kubectl logs -l app=myapp --all-containers=true
```

### Azure Monitor Queries

```kusto
// Pod performance
let startTime = ago(1h);
Perf
| where TimeGenerated > startTime
| where ObjectName == "K8SContainer"
| where CounterName == "cpuUsageNanoCores"
| summarize AvgCPU = avg(CounterValue) by bin(TimeGenerated, 5m), InstanceName

// Container logs
ContainerLog
| where TimeGenerated > ago(1h)
| where LogEntry contains "error"
| project TimeGenerated, LogEntry, Name
| order by TimeGenerated desc
```

---

## Security Best Practices

| Practice | Description |
|----------|-------------|
| **Use managed identity** | Enable system-assigned managed identity for cluster |
| **Enable Azure Policy** | Enforce governance and compliance policies |
| **Configure network policy** | Restrict pod-to-pod communication |
| **Use private clusters** | No public endpoint for production workloads |
| **Enable workload identity** | Secure pod access to Azure resources |
| **Use availability zones** | Deploy across zones for high availability |
| **Minimum 3 nodes** | For production clusters |
| **Set resource quotas** | Limit resource usage per namespace |
| **Enable RBAC** | Role-based access control for cluster resources |
| **Scan images** | Use Azure Container Registry with vulnerability scanning |

---

## Best Practices

1. **Use managed identity** for cluster authentication
2. **Enable Azure Policy** for governance
3. **Configure network policy** (Calico or Azure)
4. **Use private clusters** for production
5. **Enable Container Insights** for monitoring
6. **Use availability zones** for HA
7. **Minimum 3 nodes** for production
8. **Set resource quotas** per namespace
9. **Implement pod security** standards
10. **Use workload identity** for Azure resource access
11. **Enable autoscaling** (HPA and cluster autoscaler)
12. **Regular cluster upgrades** for security patches

---

## Choosing the Right Compute

| If your app is... | Use | Why |
|-------------------|-----|-----|
| HTTP APIs, microservices | **Container Apps** | Serverless, auto-scale, Dapr, simpler |
| Event-driven | **Functions** | Pay-per-execution, lightweight |
| Traditional web apps | **App Service** | Managed platform, easy deployment |
| Complex K8s workloads | **AKS** | Full control, custom operators, CRDs |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Cluster creation fails** | Check subscription quotas: `az vm list-usage --location eastus` |
| **Pods pending** | Check node resources, add/scale node pools |
| **Image pull errors** | Attach ACR: `az aks update --name CLUSTER -g RG --attach-acr ACR_NAME` |
| **Network connectivity** | Verify network policies and security groups |
| **DNS issues** | Check CoreDNS pods: `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
| **Node not ready** | Check node logs: `kubectl describe node <node-name>` |

---

## Additional Resources

- [AKS Documentation](https://learn.microsoft.com/azure/aks/)
- [AKS Best Practices](https://learn.microsoft.com/azure/aks/best-practices)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Azure Verified Modules](https://aka.ms/avm)
