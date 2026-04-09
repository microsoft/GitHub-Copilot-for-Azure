# Deployment: Fargate to Container Apps

## Phase 1: Container Registry Migration

```bash
set -euo pipefail
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
az acr login --name "$ACR_NAME"
docker pull "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE}"
docker tag "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${IMAGE}" "${ACR_NAME}.azurecr.io/${IMAGE}"
docker push "${ACR_NAME}.azurecr.io/${IMAGE}"
```

```powershell
$ErrorActionPreference = 'Stop'
$ecrPassword = aws ecr get-login-password --region $env:AWS_REGION
$ecrPassword | docker login --username AWS --password-stdin "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com"
az acr login --name $env:ACR_NAME
docker pull "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:IMAGE)"
docker tag "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:IMAGE)" "$($env:ACR_NAME).azurecr.io/$($env:IMAGE)"
docker push "$($env:ACR_NAME).azurecr.io/$($env:IMAGE)"
```

## Phase 2: Infrastructure

```bash
set -euo pipefail
az group create --name "$RG" --location "$LOCATION"
# WARNING: The shared key below is sensitive. Avoid logging or echoing it.
az monitor log-analytics workspace create -g "$RG" -n "${RG}-logs" -l "$LOCATION"
LOG_ID=$(az monitor log-analytics workspace show -g "$RG" -n "${RG}-logs" --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "${RG}-logs" --query primarySharedKey -o tsv)
az containerapp env create -n "${RG}-env" -g "$RG" -l "$LOCATION" \
  --logs-workspace-id "$LOG_ID" --logs-workspace-key "$LOG_KEY"
# Alternative: use --logs-destination azure-monitor to avoid fetching the workspace key:
# az containerapp env create -n "${RG}-env" -g "$RG" -l "$LOCATION" \
#   --logs-destination azure-monitor --logs-workspace-id "$LOG_ID"
```

```powershell
$ErrorActionPreference = 'Stop'
az group create --name $env:RG --location $env:LOCATION
# WARNING: The shared key below is sensitive. Avoid logging or echoing it.
az monitor log-analytics workspace create -g $env:RG -n "$($env:RG)-logs" -l $env:LOCATION
$logId = az monitor log-analytics workspace show -g $env:RG -n "$($env:RG)-logs" --query customerId -o tsv
$logKey = az monitor log-analytics workspace get-shared-keys -g $env:RG -n "$($env:RG)-logs" --query primarySharedKey -o tsv
az containerapp env create -n "$($env:RG)-env" -g $env:RG -l $env:LOCATION `
  --logs-workspace-id $logId --logs-workspace-key $logKey
# Alternative: use --logs-destination azure-monitor to avoid fetching the workspace key:
# az containerapp env create -n "$($env:RG)-env" -g $env:RG -l $env:LOCATION `
#   --logs-destination azure-monitor --logs-workspace-id $logId
```

## Phase 3: Secrets & Identity

```bash
set -euo pipefail
az keyvault create --name "$KEY_VAULT" -g "$RG" -l "$LOCATION" \
  --enable-rbac-authorization true
IDENTITY_ID=$(az identity create -n "${RG}-id" -g "$RG" -l "$LOCATION" --query id -o tsv)
PRINCIPAL_ID=$(az identity show --ids "$IDENTITY_ID" --query principalId -o tsv)

# Grant Key Vault access — use RBAC (recommended) or access policies
# Option A: RBAC (enabled on the vault created above)
KV_ID=$(az keyvault show --name "$KEY_VAULT" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" \
  --role "Key Vault Secrets User" --scope "$KV_ID"
# Option B: Access policies (if vault uses access policy mode)
# az keyvault set-policy --name "$KEY_VAULT" --object-id "$PRINCIPAL_ID" --secret-permissions get list

# Migrate secrets without writing them to disk
# WARNING: Secret value is passed as a CLI argument, which may appear in shell
# history or process listings. Run in a secure environment with history disabled.
az keyvault secret set --vault-name "$KEY_VAULT" --name <secret-name> \
  --value "$(
    aws secretsmanager get-secret-value --secret-id <secret-id> --region <region> \
      --query SecretString --output text
  )"

# ACR pull access
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"
```

```powershell
$ErrorActionPreference = 'Stop'
az keyvault create --name $env:KEY_VAULT -g $env:RG -l $env:LOCATION --enable-rbac-authorization true
$identityId = az identity create -n "$($env:RG)-id" -g $env:RG -l $env:LOCATION --query id -o tsv
$principalId = az identity show --ids $identityId --query principalId -o tsv

# Grant Key Vault access — use RBAC (recommended) or access policies
# Option A: RBAC (enabled on the vault created above)
$kvId = az keyvault show --name $env:KEY_VAULT --query id -o tsv
az role assignment create --assignee $principalId `
  --role "Key Vault Secrets User" --scope $kvId
# Option B: Access policies (if vault uses access policy mode)
# az keyvault set-policy --name $env:KEY_VAULT --object-id $principalId --secret-permissions get list

# Migrate secrets without writing them to disk
# WARNING: Secret value is passed as a CLI argument, which may appear in
# transcripts, history, or CI/CD logs. Run in a secure environment.
# Wrapped in a script block so $secretValue does not persist in session scope.
& {
    $secretValue = aws secretsmanager get-secret-value --secret-id <secret-id> --region <region> `
      --query SecretString --output text
    az keyvault secret set --vault-name $env:KEY_VAULT --name <secret-name> --value $secretValue
}

# ACR pull access
$acrId = az acr show --name $env:ACR_NAME --query id -o tsv
az role assignment create --assignee $principalId --role AcrPull --scope $acrId
```

## Phase 4: Deploy

```bash
set -euo pipefail
SECRET_URI=$(az keyvault secret show --vault-name "$KEY_VAULT" --name db-password --query id -o tsv)
az containerapp create --name <app-name> -g "$RG" --environment "${RG}-env" \
  --image "${ACR_NAME}.azurecr.io/<image>:<tag>" --target-port 8080 --ingress external \
  --cpu 0.5 --memory 1Gi --min-replicas 1 --max-replicas 10 \
  --user-assigned "$IDENTITY_ID" --registry-identity "$IDENTITY_ID" \
  --registry-server "${ACR_NAME}.azurecr.io" \
  --secrets db-pass=keyvaultref:"${SECRET_URI}",identityref:"${IDENTITY_ID}" \
  --env-vars ENV=production DB_PASSWORD=secretref:db-pass
```

```powershell
$ErrorActionPreference = 'Stop'
$secretUri = az keyvault secret show --vault-name $env:KEY_VAULT --name db-password --query id -o tsv
az containerapp create --name <app-name> -g $env:RG --environment "$($env:RG)-env" `
  --image "$($env:ACR_NAME).azurecr.io/<image>:<tag>" --target-port 8080 --ingress external `
  --cpu 0.5 --memory 1Gi --min-replicas 1 --max-replicas 10 `
  --user-assigned $identityId --registry-identity $identityId `
  --registry-server "$($env:ACR_NAME).azurecr.io" `
  --secrets "db-pass=keyvaultref:$secretUri,identityref:$identityId" `
  --env-vars ENV=production DB_PASSWORD=secretref:db-pass
```

## Phase 5: Validate

```bash
FQDN=$(az containerapp show --name <app-name> -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
curl -I "https://$FQDN/health"
az containerapp logs show --name <app-name> -g "$RG" --tail 100
```

```powershell
$fqdn = az containerapp show --name <app-name> -g $env:RG --query properties.configuration.ingress.fqdn -o tsv
Invoke-WebRequest -Uri "https://$fqdn/health" -Method Head
az containerapp logs show --name <app-name> -g $env:RG --tail 100
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull fails | Verify ACR role: `az role assignment list --assignee $PRINCIPAL_ID --scope $ACR_ID -o table` |
| App won't start | Check logs: `az containerapp logs show --name <app> -g $RG --tail 100` |
| Secret not accessible | Verify access: `az role assignment list --assignee $PRINCIPAL_ID --scope $KV_ID -o table` or check access policies |
