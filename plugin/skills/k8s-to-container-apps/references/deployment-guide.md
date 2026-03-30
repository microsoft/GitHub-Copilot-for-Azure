# Kubernetes to Azure Container Apps - Deployment Guide

## Prerequisites

Azure CLI 2.53.0+, kubectl, Docker, Azure subscription, ACR, Key Vault, Log Analytics

## Phase 1: Export Kubernetes Resources

```bash
kubectl get deployments,services,ingress -n <namespace> -o wide
kubectl get configmaps,secrets -n <namespace>
```

### Export Scripts

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
NAMESPACE="${K8S_NAMESPACE:-<namespace>}"
OUTPUT_DIR="${OUTPUT_DIR:-k8s-export}"
mkdir -p "$OUTPUT_DIR"
kubectl get deploy,svc,ingress,configmap,secret -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/all-resources.yaml"
for deploy in $(kubectl get deploy -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}'); do
  kubectl get deployment "$deploy" -n "$NAMESPACE" -o yaml > "$OUTPUT_DIR/deploy-${deploy}.yaml"
done
```

**PowerShell:**
```powershell
$NAMESPACE = if ($env:K8S_NAMESPACE) { $env:K8S_NAMESPACE } else { "<namespace>" }
$OUTPUT_DIR = if ($env:OUTPUT_DIR) { $env:OUTPUT_DIR } else { "k8s-export" }
New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
kubectl get deploy,svc,ingress,configmap,secret -n $NAMESPACE -o yaml | Out-File "$OUTPUT_DIR/all-resources.yaml"
```

## Phase 2: Assess Compatibility

Load [assessment-guide.md](assessment-guide.md). Check: StatefulSets, DaemonSets, CRDs, resource limits (>4 vCPU/>8 GiB), PVCs, NetworkPolicies.

## Phase 3: Migrate Images

```bash
#!/bin/bash
set -euo pipefail
ACR_NAME="${ACR_NAME:-<acr>}"
SOURCE_REGISTRY="${SOURCE_REGISTRY:-<registry>}"
az acr login --name "$ACR_NAME"
az acr import --name "$ACR_NAME" --source "${SOURCE_REGISTRY}/app:v1.0" --image app:v1.0
```

## Phase 4: Infrastructure

```bash
az group create --name myapp-rg --location eastus
az monitor log-analytics workspace create --resource-group myapp-rg --workspace-name myapp-logs --location eastus
LOG_ID=$(az monitor log-analytics workspace show --resource-group myapp-rg --workspace-name myapp-logs --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group myapp-rg --workspace-name myapp-logs --query primarySharedKey -o tsv)
az containerapp env create --name myapp-env --resource-group myapp-rg --location eastus --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY
```

**VNet:** Skip basic env if using VNet. Create VNet, get subnet ID, then create env with `--infrastructure-subnet-resource-id`.

## Phase 5: Secrets

**Bash:**
```bash
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus
SECRET_FILE=$(mktemp)
kubectl get secret mysecret -n <namespace> -o jsonpath='{.data.password}' | base64 -d > "$SECRET_FILE"
az keyvault secret set --vault-name myapp-kv --name password --file "$SECRET_FILE"
shred -u "$SECRET_FILE" 2>/dev/null || rm -f "$SECRET_FILE"
az identity create --name myapp-id --resource-group myapp-rg --location eastus
IDENTITY_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query id -o tsv)
PRINCIPAL_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query principalId -o tsv)
az keyvault set-policy --name myapp-kv --object-id $PRINCIPAL_ID --secret-permissions get list
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create --assignee $PRINCIPAL_ID --role AcrPull --scope $ACR_ID
```

**PowerShell:**
```powershell
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus
$secretFile = New-TemporaryFile
try {
  kubectl get secret mysecret -n <namespace> -o jsonpath='{.data.password}' | ForEach-Object {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))
  } | Out-File $secretFile.FullName -Encoding utf8 -NoNewline
  az keyvault secret set --vault-name myapp-kv --name password --file $secretFile.FullName
} finally { Remove-Item $secretFile.FullName -Force -ErrorAction SilentlyContinue }
```

## Phase 6: Deploy

**Mapping:** `spec.containers[].image` → `template.containers[].image`; `spec.containers[].ports[].containerPort` → `ingress.targetPort`; `spec.replicas` → `scale.minReplicas`. Service types: ClusterIP → `external: false`; LoadBalancer/NodePort → `external: true`.

```bash
SECRET_URI=$(az keyvault secret show --vault-name myapp-kv --name password --query id -o tsv)
az containerapp create --name my-app --resource-group myapp-rg --environment myapp-env \
  --image $ACR_NAME.azurecr.io/app:v1.0 --target-port 8080 --ingress external \
  --cpu 1.0 --memory 2Gi --min-replicas 2 --max-replicas 10 \
  --user-assigned $IDENTITY_ID --registry-identity $IDENTITY_ID --registry-server $ACR_NAME.azurecr.io \
  --secrets password=keyvaultref:$SECRET_URI,identityref:$IDENTITY_ID \
  --env-vars ENV=prod DB_PASSWORD=secretref:password --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 80
```

## Phase 7: Validation

```bash
FQDN=$(az containerapp show --name my-app --resource-group myapp-rg --query properties.configuration.ingress.fqdn -o tsv)
curl https://$FQDN/health
az containerapp logs show --name my-app --resource-group myapp-rg --follow
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull | Verify ACR: `az acr check-health --name $ACR_NAME`; check ACRPull role |
| Port mismatch | Verify `targetPort` matches app port |
| OOM | Reduce to ≤4 vCPU, ≤8 GiB |
| DNS | Use `APP.internal.ENV.REGION.azurecontainerapps.io` |
