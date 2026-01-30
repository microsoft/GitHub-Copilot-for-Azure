# Bootstrap AI Gateway

Deploy APIM with Basicv2 SKU for AI workloads.

## CLI Commands

```bash
az group create --name rg-aigateway --location eastus
az deployment group create -g rg-aigateway --template-file main.bicep --parameters apimSku=Basicv2
```

## Bicep Template

```bicep
param location string = resourceGroup().location
param apimSku string = 'Basicv2'

resource apimService 'Microsoft.ApiManagement/service@2024-06-01-preview' = {
  name: 'apim-aigateway-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: apimSku, capacity: 1 }
  properties: { publisherEmail: 'admin@contoso.com', publisherName: 'Contoso' }
  identity: { type: 'SystemAssigned' }
}

output gatewayUrl string = apimService.properties.gatewayUrl
output principalId string = apimService.identity.principalId
```

## Notes

- **Basicv2 SKU**: Cheaper, faster (~5-10 min vs 30+), supports all AI Gateway policies
- **Managed identity**: Prefer SystemAssigned for backend authentication
