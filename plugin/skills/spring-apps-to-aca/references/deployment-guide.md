# Deployment Guide: Spring Boot to Azure Container Apps

## Phase 1: Create Container Apps Environment

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
az group create --name spring-rg --location eastus
az monitor log-analytics workspace create --resource-group spring-rg --workspace-name spring-logs --location eastus
LOG_ID=$(az monitor log-analytics workspace show --resource-group spring-rg --workspace-name spring-logs --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group spring-rg --workspace-name spring-logs --query primarySharedKey -o tsv)
az containerapp env create --name spring-env --resource-group spring-rg --location eastus --logs-workspace-id "$LOG_ID" --logs-workspace-key "$LOG_KEY"
```

**PowerShell:**
```powershell
az group create --name spring-rg --location eastus
az monitor log-analytics workspace create --resource-group spring-rg --workspace-name spring-logs --location eastus
$workspace = az monitor log-analytics workspace show --resource-group spring-rg --workspace-name spring-logs | ConvertFrom-Json
$LOG_ID = $workspace.customerId
$keys = az monitor log-analytics workspace get-shared-keys --resource-group spring-rg --workspace-name spring-logs | ConvertFrom-Json
$LOG_KEY = $keys.primarySharedKey
az containerapp env create --name spring-env --resource-group spring-rg --location eastus --logs-workspace-id $LOG_ID --logs-workspace-key $LOG_KEY
```

## Phase 2: Configure Logging

**Update application.properties:**
```properties
# Route all logs to console (required for Container Apps)
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} - %msg%n
```

**Update application.yml:**
```yaml
logging:
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} - %msg%n"
```

**Configure diagnostic settings in Container Apps:**
- Azure Monitor Log Analytics (recommended)
- Azure Event Hubs
- Third-party monitoring solutions
- Disable storage (view logs at runtime only)

## Phase 3: Containerize Application

**Create Dockerfile:**
```dockerfile
FROM mcr.microsoft.com/openjdk/jdk:21-ubuntu
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Build and push to ACR:**

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
ACR_NAME="${ACR_NAME:-<acr>}"
az acr create --name "$ACR_NAME" --resource-group spring-rg --sku Basic --location eastus
az acr login --name "$ACR_NAME"
docker build -t "${ACR_NAME}.azurecr.io/spring-app:v1.0" .
docker push "${ACR_NAME}.azurecr.io/spring-app:v1.0"
```

**PowerShell:**
```powershell
$ACR_NAME = if ($env:ACR_NAME) { $env:ACR_NAME } else { "<acr>" }
az acr create --name $ACR_NAME --resource-group spring-rg --sku Basic --location eastus
az acr login --name $ACR_NAME
docker build -t "${ACR_NAME}.azurecr.io/spring-app:v1.0" .
docker push "${ACR_NAME}.azurecr.io/spring-app:v1.0"
```

## Phase 4: Configure Storage (if needed)

**Azure Files for persistent storage:**

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
az storage account create --name springstore --resource-group spring-rg --location eastus --sku Standard_LRS
STORAGE_KEY=$(az storage account keys list --account-name springstore --resource-group spring-rg --query "[0].value" -o tsv)
az storage share create --name spring-data --account-name springstore --account-key "$STORAGE_KEY"
az containerapp env storage set --name spring-env --resource-group spring-rg --storage-name spring-storage --azure-file-account-name springstore --azure-file-account-key "$STORAGE_KEY" --azure-file-share-name spring-data --access-mode ReadWrite
```

## Phase 5: Migrate Secrets to Key Vault

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
az keyvault create --name spring-kv --resource-group spring-rg --location eastus
IDENTITY_ID=$(az identity create --name spring-id --resource-group spring-rg --location eastus --query id -o tsv)
PRINCIPAL_ID=$(az identity show --ids "$IDENTITY_ID" --query principalId -o tsv)
az keyvault set-policy --name spring-kv --object-id "$PRINCIPAL_ID" --secret-permissions get list
SECRET_FILE=$(mktemp)
trap 'shred -u "$SECRET_FILE" 2>/dev/null || rm -f "$SECRET_FILE"' EXIT
echo -n "your-db-password" > "$SECRET_FILE"
az keyvault secret set --vault-name spring-kv --name db-password --file "$SECRET_FILE"
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"
```

**PowerShell:**
```powershell
az keyvault create --name spring-kv --resource-group spring-rg --location eastus
$identity = az identity create --name spring-id --resource-group spring-rg --location eastus | ConvertFrom-Json
$IDENTITY_ID = $identity.id
$PRINCIPAL_ID = $identity.principalId
az keyvault set-policy --name spring-kv --object-id $PRINCIPAL_ID --secret-permissions get list
$secretFile = New-TemporaryFile
try {
  "your-db-password" | Out-File $secretFile.FullName -Encoding utf8 -NoNewline
  az keyvault secret set --vault-name spring-kv --name db-password --file $secretFile.FullName
} finally {
  Remove-Item $secretFile.FullName -Force -ErrorAction SilentlyContinue
}
$acr = az acr show --name $ACR_NAME | ConvertFrom-Json
$ACR_ID = $acr.id
az role assignment create --assignee $PRINCIPAL_ID --role AcrPull --scope $ACR_ID
```

## Phase 6: Deploy Container App

**Bash:**
```bash
#!/bin/bash
set -euo pipefail
SECRET_URI=$(az keyvault secret show --vault-name spring-kv --name db-password --query id -o tsv)
az containerapp create --name spring-app --resource-group spring-rg --environment spring-env \
  --image "${ACR_NAME}.azurecr.io/spring-app:v1.0" --target-port 8080 --ingress external \
  --cpu 2.0 --memory 4Gi --min-replicas 2 --max-replicas 10 \
  --user-assigned "$IDENTITY_ID" --registry-identity "$IDENTITY_ID" --registry-server "${ACR_NAME}.azurecr.io" \
  --secrets db-password=keyvaultref:"${SECRET_URI}",identityref:"${IDENTITY_ID}" \
  --env-vars SPRING_DATASOURCE_PASSWORD=secretref:db-password SPRING_PROFILES_ACTIVE=prod
```

**With storage mount:**
```bash
az containerapp create --name spring-app --resource-group spring-rg --environment spring-env \
  --image "${ACR_NAME}.azurecr.io/spring-app:v1.0" --target-port 8080 --ingress external \
  --cpu 2.0 --memory 4Gi --min-replicas 2 --max-replicas 10 \
  --user-assigned "$IDENTITY_ID" --registry-identity "$IDENTITY_ID" --registry-server "${ACR_NAME}.azurecr.io" \
  --secrets db-password=keyvaultref:"${SECRET_URI}",identityref:"${IDENTITY_ID}" \
  --env-vars SPRING_DATASOURCE_PASSWORD=secretref:db-password \
  --bind-storage-name spring-storage --mount-path /mnt/data
```

## Phase 7: Validation

**Check app status:**
```bash
FQDN=$(az containerapp show --name spring-app --resource-group spring-rg --query properties.configuration.ingress.fqdn -o tsv)
echo "Application URL: https://${FQDN}"
curl "https://${FQDN}/actuator/health"
az containerapp logs show --name spring-app --resource-group spring-rg --tail 50
```

## Phase 8: Post-Migration Optimization

### Add Spring Cloud Config Server

**Bash:**
```bash
az containerapp env java-component config-server-for-spring create \
  --environment spring-env --resource-group spring-rg \
  --name config-server --min-replicas 1 --max-replicas 1 \
  --configuration spring.cloud.config.server.git.uri=https://github.com/your-org/config-repo
az containerapp update --name spring-app --resource-group spring-rg \
  --bind config-server
```

**Create bootstrap.yml in src/main/resources:**
```yaml
spring:
  application:
    name: spring-app
  cloud:
    config:
      uri: ${SPRING_CLOUD_CONFIG_URI}
```

### Add Eureka Service Registry

**Bash:**
```bash
az containerapp env java-component eureka-server-for-spring create \
  --environment spring-env --resource-group spring-rg \
  --name eureka-server --min-replicas 1 --max-replicas 1
az containerapp update --name spring-app --resource-group spring-rg \
  --bind eureka-server
```

**Add dependency (pom.xml):**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

### Add Spring Cloud Gateway

**Bash:**
```bash
az containerapp create --name spring-gateway --resource-group spring-rg --environment spring-env \
  --image "${ACR_NAME}.azurecr.io/gateway:v1.0" --target-port 8080 --ingress external \
  --cpu 1.0 --memory 2Gi --min-replicas 1 --max-replicas 5 \
  --bind eureka-server config-server
```

### Add Spring Boot Admin

**Bash:**
```bash
az containerapp env java-component admin-for-spring create \
  --environment spring-env --resource-group spring-rg \
  --name admin-server --min-replicas 1 --max-replicas 1
az containerapp update --name spring-app --resource-group spring-rg \
  --bind admin-server
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull fails | Verify ACR role: `az role assignment list --assignee $PRINCIPAL_ID --scope $ACR_ID` |
| App won't start | Check logs: `az containerapp logs show --name spring-app -g spring-rg --tail 100` |
| Health check fails | Verify port 8080 matches `server.port` in application.properties |
| Secrets not accessible | Check Key Vault policy: `az keyvault show --name spring-kv --query properties.accessPolicies` |
| Storage mount fails | Verify storage configuration: `az containerapp env storage list --name spring-env -g spring-rg` |
| High memory usage | Reduce max heap: add `--env-vars JAVA_OPTS="-Xmx2g"` to container app |

## CI/CD Integration

**GitHub Actions example:**
```yaml
- name: Build and push to ACR
  run: |
    az acr build --registry ${{ secrets.ACR_NAME }} --image spring-app:${{ github.sha }} .
- name: Deploy to Container Apps
  run: |
    az containerapp update --name spring-app -g spring-rg --image ${{ secrets.ACR_NAME }}.azurecr.io/spring-app:${{ github.sha }}
```

**Azure Pipelines example:**
```yaml
- task: AzureCLI@2
  inputs:
    azureSubscription: 'AzureConnection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      az acr build --registry $(ACR_NAME) --image spring-app:$(Build.BuildId) .
      az containerapp update --name spring-app -g spring-rg --image $(ACR_NAME).azurecr.io/spring-app:$(Build.BuildId)
```
