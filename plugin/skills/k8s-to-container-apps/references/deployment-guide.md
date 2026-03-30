# Kubernetes to Azure Container Apps - Deployment Guide

## Prerequisites

- Azure CLI 2.53.0+, kubectl, Docker
- Azure subscription, resource group, ACR, Key Vault, Log Analytics
- kubectl access to source Kubernetes cluster

## Phase 1: Export Kubernetes Resources

### Identify Target Workloads

```bash
# List deployments in the target namespace
kubectl get deployments -n <namespace> -o wide

# List services
kubectl get services -n <namespace> -o wide

# List ingress resources
kubectl get ingress -n <namespace>

# List config and secrets
kubectl get configmaps,secrets -n <namespace>
```

### Export Resource Definitions

### Bash

```bash
#!/bin/bash
set -euo pipefail

NAMESPACE="${K8S_NAMESPACE:-<namespace>}"
OUTPUT_DIR="${OUTPUT_DIR:-k8s-export}"

mkdir -p "$OUTPUT_DIR"

# Export all resources
kubectl get deploy,svc,ingress,configmap,secret -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/all-resources.yaml"

# Export individual deployments
for deploy in $(kubectl get deploy -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}'); do
  kubectl get deployment "$deploy" -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/deploy-${deploy}.yaml"
done

# Export services
for svc in $(kubectl get svc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}'); do
  kubectl get service "$svc" -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/svc-${svc}.yaml"
done

echo "Resources exported to $OUTPUT_DIR/"
```

### PowerShell

```powershell
$ErrorActionPreference = 'Stop'

$NAMESPACE = if ($env:K8S_NAMESPACE) { $env:K8S_NAMESPACE } else { "<namespace>" }
$OUTPUT_DIR = if ($env:OUTPUT_DIR) { $env:OUTPUT_DIR } else { "k8s-export" }

New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null

# Export all resources
kubectl get deploy,svc,ingress,configmap,secret -n $NAMESPACE -o yaml | Out-File -FilePath "$OUTPUT_DIR/all-resources.yaml"

# Export individual deployments
$deploys = kubectl get deploy -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}'
$deploys -split '\s+' | Where-Object { $_ } | ForEach-Object {
  kubectl get deployment $_ -n $NAMESPACE -o yaml | Out-File -FilePath "$OUTPUT_DIR/deploy-$_.yaml"
}

# Export services
$services = kubectl get svc -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}'
$services -split '\s+' | Where-Object { $_ } | ForEach-Object {
  kubectl get service $_ -n $NAMESPACE -o yaml | Out-File -FilePath "$OUTPUT_DIR/svc-$_.yaml"
}

Write-Host "Resources exported to $OUTPUT_DIR/"
```

## Phase 2: Assess Compatibility

Load [assessment-guide.md](assessment-guide.md) and generate `k8s-migration-assessment.md`. Key checks:

- **Blockers**: StatefulSets, DaemonSets, Custom CRDs
- **Resource Limits**: Containers >4 vCPU or >8 GiB memory
- **Storage**: PersistentVolumeClaims (map to Azure Files or external state)
- **Networking**: NetworkPolicies (map to NSG rules)

## Phase 3: Migrate Container Images

### Bash

```bash
#!/bin/bash
set -euo pipefail

ACR_NAME="${ACR_NAME:-<acr>}"
SOURCE_REGISTRY="${SOURCE_REGISTRY:-<source-registry>}"

# Login to ACR
az acr login --name "$ACR_NAME"

# Option 1: Import from another registry
az acr import --name "$ACR_NAME" \
  --source "${SOURCE_REGISTRY}/app:v1.0" \
  --image app:v1.0

# Option 2: Tag and push from local Docker
# docker pull "${SOURCE_REGISTRY}/app:v1.0"
# docker tag "${SOURCE_REGISTRY}/app:v1.0" "${ACR_NAME}.azurecr.io/app:v1.0"
# docker push "${ACR_NAME}.azurecr.io/app:v1.0"
```

### PowerShell

```powershell
$ErrorActionPreference = 'Stop'

$ACR_NAME = if ($env:ACR_NAME) { $env:ACR_NAME } else { "<acr>" }
$SOURCE_REGISTRY = if ($env:SOURCE_REGISTRY) { $env:SOURCE_REGISTRY } else { "<source-registry>" }

# Login to ACR
az acr login --name $ACR_NAME

# Option 1: Import from another registry
az acr import --name $ACR_NAME `
  --source "${SOURCE_REGISTRY}/app:v1.0" `
  --image app:v1.0

# Option 2: Tag and push from local Docker
# docker pull "${SOURCE_REGISTRY}/app:v1.0"
# docker tag "${SOURCE_REGISTRY}/app:v1.0" "${ACR_NAME}.azurecr.io/app:v1.0"
# docker push "${ACR_NAME}.azurecr.io/app:v1.0"
```

## Phase 4: Infrastructure Setup

```bash
# Resource group
az group create --name myapp-rg --location eastus

# Log Analytics
az monitor log-analytics workspace create \
  --resource-group myapp-rg \
  --workspace-name myapp-logs \
  --location eastus

LOG_ID=$(az monitor log-analytics workspace show \
  --resource-group myapp-rg --workspace-name myapp-logs \
  --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group myapp-rg --workspace-name myapp-logs \
  --query primarySharedKey -o tsv)

# Container Apps Environment
az containerapp env create \
  --name myapp-env --resource-group myapp-rg --location eastus \
  --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY
```

### VNet Integration (if using NetworkPolicies)

> **Note**: Skip basic environment creation if using VNet. Choose one path.

```bash
# Create VNet
az network vnet create \
  --resource-group myapp-rg --name myapp-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name aca-subnet --subnet-prefix 10.0.0.0/23

SUBNET_ID=$(az network vnet subnet show --resource-group myapp-rg \
  --vnet-name myapp-vnet --name aca-subnet --query id -o tsv)

# Environment with VNet (replaces basic env creation above)
az containerapp env create \
  --name myapp-env --resource-group myapp-rg --location eastus \
  --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY \
  --infrastructure-subnet-resource-id $SUBNET_ID
```

## Phase 5: Migrate Secrets

### Bash

```bash
# Key Vault
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus

# Extract secret from Kubernetes and migrate to Key Vault
SECRET_FILE=$(mktemp)
kubectl get secret mysecret -n <namespace> -o jsonpath='{.data.password}' | base64 -d > "$SECRET_FILE"
az keyvault secret set --vault-name myapp-kv --name password --file "$SECRET_FILE"
shred -u "$SECRET_FILE" 2>/dev/null || rm -f "$SECRET_FILE"
```

### PowerShell

```powershell
# Key Vault
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus

# Extract secret from Kubernetes and migrate to Key Vault
$secretFile = New-TemporaryFile
try {
  kubectl get secret mysecret -n <namespace> -o jsonpath='{.data.password}' | ForEach-Object {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))
  } | Out-File -FilePath $secretFile.FullName -Encoding utf8 -NoNewline
  az keyvault secret set --vault-name myapp-kv --name password --file $secretFile.FullName
} finally {
  Remove-Item $secretFile.FullName -Force -ErrorAction SilentlyContinue
}
```

### Managed Identity

```bash
# Managed Identity
az identity create --name myapp-id --resource-group myapp-rg --location eastus
IDENTITY_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query id -o tsv)
PRINCIPAL_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query principalId -o tsv)

# Grant permissions
az keyvault set-policy --name myapp-kv --object-id $PRINCIPAL_ID --secret-permissions get list
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create --assignee $PRINCIPAL_ID --role AcrPull --scope $ACR_ID
```

## Phase 6: Generate and Deploy Container App

### Kubernetes Deployment → Container App Mapping

| Kubernetes Field | Container Apps Field | Example |
|-----------------|---------------------|---------|
| `spec.containers[].image` | `template.containers[].image` | `myacr.azurecr.io/app:v1` |
| `spec.containers[].ports[].containerPort` | `ingress.targetPort` | `8080` |
| `spec.containers[].env` | `template.containers[].env` | `[{name: 'VAR', value: 'val'}]` |
| `spec.containers[].resources.requests.cpu` | `template.containers[].resources.cpu` | `1.0` |
| `spec.containers[].resources.requests.memory` | `template.containers[].resources.memory` | `2Gi` |
| `spec.replicas` | `scale.minReplicas` | `2` |
| N/A | `scale.maxReplicas` | `10` |

### Service Type → Ingress Mapping

| Kubernetes Service Type | Container Apps Ingress |
|------------------------|----------------------|
| ClusterIP | `external: false`, `targetPort: PORT` |
| LoadBalancer | `external: true`, `targetPort: PORT` |
| NodePort | `external: true`, `targetPort: PORT` |

### Deploy Container App

```bash
SECRET_URI=$(az keyvault secret show --vault-name myapp-kv --name password --query id -o tsv)

az containerapp create \
  --name my-app --resource-group myapp-rg --environment myapp-env \
  --image $ACR_NAME.azurecr.io/app:v1.0 \
  --target-port 8080 --ingress external \
  --cpu 1.0 --memory 2Gi \
  --min-replicas 2 --max-replicas 10 \
  --user-assigned $IDENTITY_ID --registry-identity $IDENTITY_ID \
  --registry-server $ACR_NAME.azurecr.io \
  --secrets password=keyvaultref:$SECRET_URI,identityref:$IDENTITY_ID \
  --env-vars ENV=prod DB_PASSWORD=secretref:password \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 80
```

## Phase 7: Validation

```bash
# Get app URL
FQDN=$(az containerapp show --name my-app --resource-group myapp-rg \
  --query properties.configuration.ingress.fqdn -o tsv)

# Test endpoint
curl https://$FQDN/health

# View logs
az containerapp logs show --name my-app --resource-group myapp-rg --follow

# Monitor replicas
az containerapp replica list --name my-app --resource-group myapp-rg --revision latest
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull fails | Verify ACR access: `az acr check-health --name $ACR_NAME` and managed identity ACRPull role |
| Port mismatch (502/503) | Check `targetPort` matches app listen port and Dockerfile EXPOSE |
| OOM / resource limits | Reduce to ≤4 vCPU and ≤8 GiB per container |
| DNS resolution between apps | Use `APP_NAME.internal.ENVIRONMENT.REGION.azurecontainerapps.io` |
| Secrets not accessible | Verify Key Vault policy: `az keyvault set-policy --name <kv> --object-id <principal> --secret-permissions get list` |
| Startup timeout | Optimize container startup time to <240s or adjust probe settings |
