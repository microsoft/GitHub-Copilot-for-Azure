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

## Phase 2: Infrastructure

```bash
set -euo pipefail
az group create --name "$RG" --location "$LOCATION"
az monitor log-analytics workspace create -g "$RG" -n "${RG}-logs" -l "$LOCATION"
LOG_ID=$(az monitor log-analytics workspace show -g "$RG" -n "${RG}-logs" --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "${RG}-logs" --query primarySharedKey -o tsv)
az containerapp env create -n "${RG}-env" -g "$RG" -l "$LOCATION" \
  --logs-workspace-id "$LOG_ID" --logs-workspace-key "$LOG_KEY"
```

## Phase 3: Secrets & Identity

```bash
set -euo pipefail
az keyvault create --name "$KEY_VAULT" -g "$RG" -l "$LOCATION"
IDENTITY_ID=$(az identity create -n "${RG}-id" -g "$RG" -l "$LOCATION" --query id -o tsv)
PRINCIPAL_ID=$(az identity show --ids "$IDENTITY_ID" --query principalId -o tsv)

# Grant Key Vault access — use RBAC (recommended) or access policies
# Option A: RBAC (default for new vaults)
KV_ID=$(az keyvault show --name "$KEY_VAULT" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" \
  --role "Key Vault Secrets User" --scope "$KV_ID"
# Option B: Access policies (if vault uses access policy mode)
# az keyvault set-policy --name "$KEY_VAULT" --object-id "$PRINCIPAL_ID" --secret-permissions get list

# Migrate secrets securely via temp file
SECRET_FILE=$(mktemp)
trap 'shred -u "$SECRET_FILE" 2>/dev/null || rm -f "$SECRET_FILE"' EXIT
aws secretsmanager get-secret-value --secret-id <secret-id> --region <region> \
  --query SecretString --output text > "$SECRET_FILE"
az keyvault secret set --vault-name "$KEY_VAULT" --name <secret-name> --file "$SECRET_FILE"

# ACR pull access
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"
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

## Phase 5: Validate

```bash
FQDN=$(az containerapp show --name <app-name> -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
curl -I "https://$FQDN/health"
az containerapp logs show --name <app-name> -g "$RG" --tail 100
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull fails | Verify ACR role: `az role assignment list --assignee $PRINCIPAL_ID --scope $ACR_ID -o table` |
| App won't start | Check logs: `az containerapp logs show --name <app> -g $RG --tail 100` |
| Secret not accessible | Verify access: `az role assignment list --assignee $PRINCIPAL_ID --scope $KV_ID -o table` or check access policies |
