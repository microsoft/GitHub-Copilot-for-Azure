# Add AI Foundry Model Behind Gateway

## Step 1: Discover AI Foundry Projects and Models

```bash
accountName="<ai-foundry-resource-name>" && resourceGroupName="<resource-group>"
az cognitiveservices account list --query "[?kind=='AIServices'].{name:name, resourceGroup:resourceGroup}" -o table
az cognitiveservices account list-models -n $accountName -g $resourceGroupName | jq '.[] | {name,format,version}'
az cognitiveservices account deployment list -n $accountName -g $resourceGroupName
```

## Step 2: Ask User Which Model to Add

After listing models, **use the ask_user tool** to let the user select which model to add.

## Step 3: Deploy the Model (if not already deployed)

```bash
az cognitiveservices account deployment create -n $accountName -g $resourceGroupName \
  --deployment-name <model-name> --model-name <model-name> --model-version <version> \
  --model-format <format> --sku-capacity 1 --sku-name <sku>
```

## Step 4: Configure APIM Backend

```bash
ENDPOINT=$(az cognitiveservices account show -n $accountName -g $resourceGroupName \
  | jq -r '.properties.endpoints["Azure AI Model Inference API"]')
az apim backend create -g <apim-rg> --service-name <apim> --backend-id <model>-backend --protocol http --url "$ENDPOINT"
```

## Step 5: Import API Specification

```bash
az apim api import -g <apim-rg> --service-name <apim> --path <model> --specification-format OpenApiJson \
  --specification-url "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/cognitiveservices/data-plane/AzureOpenAI/inference/stable/2024-02-01/inference.json"
```

## Step 6: Grant APIM Access to AI Foundry

```bash
APIM_PRINCIPAL_ID=$(az apim show --name <apim> -g <apim-rg> --query "identity.principalId" -o tsv)
AI_RESOURCE_ID=$(az cognitiveservices account show -n $accountName -g $resourceGroupName --query "id" -o tsv)
az role assignment create --assignee $APIM_PRINCIPAL_ID --role "Cognitive Services User" --scope $AI_RESOURCE_ID
```

## Bicep Template for Backend

```bicep
resource backend 'Microsoft.ApiManagement/service/backends@2024-06-01-preview' = {
  parent: apimService
  name: backendId
  properties: { protocol: 'http', url: '${aiFoundryEndpoint}openai/deployments/${modelDeploymentName}',
    tls: { validateCertificateChain: true, validateCertificateName: true } }
}
```
