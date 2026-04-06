# Deployment Guide: Spring Boot to Azure Container Apps

## Phase 1: Create Container Apps Environment

```bash
#!/bin/bash
set -euo pipefail
az group create --name spring-rg --location eastus
az monitor log-analytics workspace create --resource-group spring-rg --workspace-name spring-logs --location eastus
LOG_ID=$(az monitor log-analytics workspace show --resource-group spring-rg --workspace-name spring-logs --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group spring-rg --workspace-name spring-logs --query primarySharedKey -o tsv)
az containerapp env create --name spring-env --resource-group spring-rg --location eastus --logs-workspace-id "$LOG_ID" --logs-workspace-key "$LOG_KEY"
```

## Phase 2: Configure Logging

**Update application.properties:**
```properties
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} - %msg%n
```

Configure diagnostic settings: Azure Monitor Log Analytics (recommended), Event Hubs, or third-party solutions.

## Phase 3: Containerize Application

**Dockerfile:**
```dockerfile
FROM mcr.microsoft.com/openjdk/jdk:21-ubuntu
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Build and push:**
```bash
ACR_NAME="${ACR_NAME:-<acr>}"
az acr create --name "$ACR_NAME" --resource-group spring-rg --sku Basic --location eastus
az acr login --name "$ACR_NAME"
docker build -t "${ACR_NAME}.azurecr.io/spring-app:v1.0" .
docker push "${ACR_NAME}.azurecr.io/spring-app:v1.0"
```

## Phase 4: Configure Storage (if needed)

**Azure Files for persistent storage:**
```bash
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-<storage-account>}"
az storage account create --name "$STORAGE_ACCOUNT" --resource-group spring-rg --location eastus --sku Standard_LRS
STORAGE_KEY=$(az storage account keys list --account-name "$STORAGE_ACCOUNT" --resource-group spring-rg --query "[0].value" -o tsv)
az storage share create --name spring-data --account-name "$STORAGE_ACCOUNT" --account-key "$STORAGE_KEY"
az containerapp env storage set --name spring-env --resource-group spring-rg --storage-name spring-storage \
  --azure-file-account-name "$STORAGE_ACCOUNT" --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name spring-data --access-mode ReadWrite
```

## Phase 5: Migrate Secrets to Key Vault

```bash
KEY_VAULT="${KEY_VAULT:-<keyvault>}"
az keyvault create --name "$KEY_VAULT" --resource-group spring-rg --location eastus
IDENTITY_ID=$(az identity create --name spring-id --resource-group spring-rg --location eastus --query id -o tsv)
PRINCIPAL_ID=$(az identity show --ids "$IDENTITY_ID" --query principalId -o tsv)
az keyvault set-policy --name "$KEY_VAULT" --object-id "$PRINCIPAL_ID" --secret-permissions get list
az keyvault secret set --vault-name "$KEY_VAULT" --name db-password --value "<your-password>"
ACR_ID=$(az acr show --name "$ACR_NAME" --query id -o tsv)
az role assignment create --assignee "$PRINCIPAL_ID" --role AcrPull --scope "$ACR_ID"
```

## Phase 6: Deploy Container App

```bash
SECRET_URI=$(az keyvault secret show --vault-name "$KEY_VAULT" --name db-password --query id -o tsv)
az containerapp create --name spring-app --resource-group spring-rg --environment spring-env \
  --image "${ACR_NAME}.azurecr.io/spring-app:v1.0" --target-port 8080 --ingress external \
  --cpu 2.0 --memory 4Gi --min-replicas 2 --max-replicas 10 \
  --user-assigned "$IDENTITY_ID" --registry-identity "$IDENTITY_ID" --registry-server "${ACR_NAME}.azurecr.io" \
  --secrets db-password=keyvaultref:"${SECRET_URI}",identityref:"${IDENTITY_ID}" \
  --env-vars SPRING_DATASOURCE_PASSWORD=secretref:db-password SPRING_PROFILES_ACTIVE=prod
```

**With storage mount:**
```bash
az containerapp create ... --bind-storage-name spring-storage --mount-path /mnt/data
```

## Phase 7: Validation

```bash
FQDN=$(az containerapp show --name spring-app --resource-group spring-rg --query properties.configuration.ingress.fqdn -o tsv)
echo "Application URL: https://${FQDN}"
curl "https://${FQDN}/actuator/health"
az containerapp logs show --name spring-app --resource-group spring-rg --tail 50
```

## Phase 8: Post-Migration Optimization

### Add Spring Cloud Config Server

```bash
az containerapp env java-component config-server-for-spring create \
  --environment spring-env --resource-group spring-rg --name config-server \
  --min-replicas 1 --max-replicas 1 \
  --configuration spring.cloud.config.server.git.uri=https://github.com/your-org/config-repo
az containerapp update --name spring-app --resource-group spring-rg --bind config-server
```

### Add Eureka Service Registry

```bash
az containerapp env java-component eureka-server-for-spring create \
  --environment spring-env --resource-group spring-rg --name eureka-server \
  --min-replicas 1 --max-replicas 1
az containerapp update --name spring-app --resource-group spring-rg --bind eureka-server
```

**Add dependency (pom.xml):**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

### Add Spring Cloud Gateway

```bash
az containerapp create --name spring-gateway --resource-group spring-rg --environment spring-env \
  --image "${ACR_NAME}.azurecr.io/gateway:v1.0" --target-port 8080 --ingress external \
  --cpu 1.0 --memory 2Gi --min-replicas 1 --max-replicas 5 \
  --bind eureka-server config-server
```

### Add Spring Boot Admin

```bash
az containerapp env java-component admin-for-spring create \
  --environment spring-env --resource-group spring-rg --name admin-server \
  --min-replicas 1 --max-replicas 1
az containerapp update --name spring-app --resource-group spring-rg --bind admin-server
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Image pull fails | Verify ACR role: `az role assignment list --assignee $PRINCIPAL_ID --scope $ACR_ID` |
| App won't start | Check logs: `az containerapp logs show --name spring-app -g spring-rg --tail 100` |
| Health check fails | Verify port 8080 matches `server.port` in application.properties |
| Secrets not accessible | Check Key Vault policy: `az keyvault show --name $KEY_VAULT --query properties.accessPolicies` |
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
