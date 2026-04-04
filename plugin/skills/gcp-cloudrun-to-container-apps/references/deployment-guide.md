# Cloud Run to Container Apps Deployment

## Prerequisites

Azure CLI 2.53+, gcloud, Docker, ACR, Key Vault, Log Analytics

## Phase 1: Image Migration

### Bash

```bash
GCP_PROJECT="${GCP_PROJECT:-<project>}"
GCP_REGION="${GCP_REGION:-<region>}"
ACR_NAME="${ACR_NAME:-<acr>}"

gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev
az acr login --name $ACR_NAME
for img in "app:v1" "worker:v1"; do
  docker pull ${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/<repo>/$img
  docker tag ${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/<repo>/$img $ACR_NAME.azurecr.io/$img
  docker push $ACR_NAME.azurecr.io/$img
done
```

### PowerShell

```powershell
$GCP_PROJECT = if ($env:GCP_PROJECT) { $env:GCP_PROJECT } else { "<project>" }
$GCP_REGION = if ($env:GCP_REGION) { $env:GCP_REGION } else { "<region>" }
$ACR_NAME = if ($env:ACR_NAME) { $env:ACR_NAME } else { "<acr>" }

gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev"
az acr login --name $ACR_NAME
@("app:v1", "worker:v1") | ForEach-Object {
  docker pull "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/<repo>/$_"
  docker tag "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/<repo>/$_" "${ACR_NAME}.azurecr.io/$_"
  docker push "${ACR_NAME}.azurecr.io/$_"
}
```

## Phase 2: Infrastructure

### Bash

```bash
az group create --name myapp-rg --location eastus
az monitor log-analytics workspace create \
  --resource-group myapp-rg --workspace-name myapp-logs --location eastus

LOG_ID=$(az monitor log-analytics workspace show --resource-group myapp-rg \
  --workspace-name myapp-logs --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group myapp-rg \
  --workspace-name myapp-logs --query primarySharedKey -o tsv)

# Container Apps Environment
az containerapp env create \
  --name myapp-env --resource-group myapp-rg --location eastus \
  --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY
```

### PowerShell

```powershell
az group create --name myapp-rg --location eastus
az monitor log-analytics workspace create `
  --resource-group myapp-rg --workspace-name myapp-logs --location eastus

$workspace = az monitor log-analytics workspace show `
  --resource-group myapp-rg --workspace-name myapp-logs | ConvertFrom-Json
$keys = az monitor log-analytics workspace get-shared-keys `
  --resource-group myapp-rg --workspace-name myapp-logs | ConvertFrom-Json

az containerapp env create `
  --name myapp-env --resource-group myapp-rg --location eastus `
  --logs-workspace-id $workspace.customerId --logs-workspace-key $keys.primarySharedKey
```

### VNet Integration

#### Bash

```bash
az network vnet create --resource-group myapp-rg --name myapp-vnet \
  --address-prefix 10.0.0.0/16 --subnet-name aca-subnet --subnet-prefix 10.0.0.0/23

SUBNET_ID=$(az network vnet subnet show --resource-group myapp-rg \
  --vnet-name myapp-vnet --name aca-subnet --query id -o tsv)

az containerapp env create --name myapp-env --resource-group myapp-rg --location eastus \
  --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY \
  --infrastructure-subnet-resource-id $SUBNET_ID
```

#### PowerShell

```powershell
az network vnet create `
  --resource-group myapp-rg --name myapp-vnet --address-prefix 10.0.0.0/16 `
  --subnet-name aca-subnet --subnet-prefix 10.0.0.0/23

$subnet = az network vnet subnet show --resource-group myapp-rg `
  --vnet-name myapp-vnet --name aca-subnet | ConvertFrom-Json

az containerapp env create `
  --name myapp-env --resource-group myapp-rg --location eastus `
  --logs-workspace-id $workspace.customerId --logs-workspace-key $keys.primarySharedKey `
  --infrastructure-subnet-resource-id $subnet.id
```

## Phase 3: Secrets

### Bash

```bash
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus

SECRET_FILE=$(mktemp)
gcloud secrets versions access latest --secret=db-pw --project=$GCP_PROJECT > "$SECRET_FILE"
az keyvault secret set --vault-name myapp-kv --name db-pw --file "$SECRET_FILE"
rm -f "$SECRET_FILE"
```

### PowerShell

```powershell
az keyvault create --name myapp-kv --resource-group myapp-rg --location eastus

$secretFile = New-TemporaryFile
gcloud secrets versions access latest --secret=db-pw --project=$env:GCP_PROJECT | Out-File -FilePath $secretFile.FullName -Encoding utf8
az keyvault secret set --vault-name myapp-kv --name db-pw --file $secretFile.FullName
Remove-Item $secretFile.FullName -Force
```

### Managed Identity

#### Bash

```bash
az identity create --name myapp-id --resource-group myapp-rg --location eastus
IDENTITY_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query id -o tsv)
PRINCIPAL_ID=$(az identity show --name myapp-id --resource-group myapp-rg --query principalId -o tsv)

az keyvault set-policy --name myapp-kv --object-id $PRINCIPAL_ID --secret-permissions get list
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create --assignee $PRINCIPAL_ID --role AcrPull --scope $ACR_ID
```

#### PowerShell

```powershell
az identity create --name myapp-id --resource-group myapp-rg --location eastus

$identity = az identity show --name myapp-id --resource-group myapp-rg | ConvertFrom-Json

az keyvault set-policy --name myapp-kv --object-id $identity.principalId --secret-permissions get list

$acr = az acr show --name $ACR_NAME | ConvertFrom-Json
az role assignment create --assignee $identity.principalId --role AcrPull --scope $acr.id
```

## Phase 4: Deploy Container App

### Basic Deployment

#### Bash

```bash
SECRET_URI=$(az keyvault secret show --vault-name myapp-kv --name db-pw --query id -o tsv)

az containerapp create \
  --name my-app --resource-group myapp-rg --environment myapp-env \
  --image $ACR_NAME.azurecr.io/app:v1 --target-port 8080 --ingress external \
  --cpu 1.0 --memory 1Gi --min-replicas 0 --max-replicas 10 \
  --user-assigned $IDENTITY_ID --registry-identity $IDENTITY_ID \
  --registry-server $ACR_NAME.azurecr.io \
  --secrets db-pw=keyvaultref:$SECRET_URI,identityref:$IDENTITY_ID \
  --env-vars ENV=prod DB_PASSWORD=secretref:db-pw \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 80
```

#### PowerShell

```powershell
$secret = az keyvault secret show --vault-name myapp-kv --name db-pw | ConvertFrom-Json

az containerapp create `
  --name my-app --resource-group myapp-rg --environment myapp-env `
  --image "$ACR_NAME.azurecr.io/app:v1" --target-port 8080 --ingress external `
  --cpu 1.0 --memory 1Gi --min-replicas 0 --max-replicas 10 `
  --user-assigned $identity.id --registry-identity $identity.id `
  --registry-server "$ACR_NAME.azurecr.io" `
  --secrets "db-pw=keyvaultref:$($secret.id),identityref:$($identity.id)" `
  --env-vars "ENV=prod" "DB_PASSWORD=secretref:db-pw" `
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 80
```

###Configuration Mapping

| Cloud Run | Container Apps |
|-----------|----------------|
| `--min-instances 0` | `--min-replicas 0` |
| `--max-instances 10` | `--max-replicas 10` |
| `--concurrency 80` | `--scale-rule-http-concurrency 80` |
| `--cpu 1` | `--cpu 1.0` |
| `--memory 512Mi` | `--memory 1Gi` |

## Phase 5: Validation

### Bash

```bash
FQDN=$(az containerapp show --name my-app --resource-group myapp-rg \
  --query properties.configuration.ingress.fqdn -o tsv)
curl https://$FQDN/
az containerapp logs show --name my-app --resource-group myapp-rg --follow
```

### PowerShell

```powershell
$app = az containerapp show --name my-app --resource-group myapp-rg | ConvertFrom-Json
Invoke-WebRequest -Uri "https://$($app.properties.configuration.ingress.fqdn)/"
az containerapp logs show --name my-app --resource-group myapp-rg --follow
```

## Troubleshooting

- **Image pull fails**: Verify ACR health and managed identity ACRPull role
- **Container won't start**: Check logs with `--tail 100`
- **Secrets not accessible**: Verify Key Vault policy
- **Scaling not working**: Review `az containerapp show --name <app> --query properties.template.scale`
