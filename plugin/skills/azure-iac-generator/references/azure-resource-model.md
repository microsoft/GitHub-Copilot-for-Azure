# Azure Resource Metadata Model



## Schema

Each Azure environment is represented as a **resource model** — a JSON structure with the following shape:

```json
{
  "resources": [
    {
      "id": "<unique-identifier>",
      "type": "<Azure-resource-type>",
      "name": "<resource-name>",
      "resourceGroup": "<resource-group-name>",
      "location": "<azure-region>",
      "properties": {},
      "tags": {},
      "relationships": [
        {
          "targetId": "<id-of-related-resource>",
          "type": "<relationship-type>"
        }
      ]
    }
  ]
}
```

## Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | **Canonical ARM resource ID** (for example, `/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Compute/virtualMachines/vm-web-01`). This is the primary key for matching resources across workflows. |
| `localId` | string | No | Optional short slug for readability (for example, `vm-web-01`). Do not use as the canonical identifier. |
| `type` | string | Yes | Azure resource provider type (for example, `Microsoft.Compute/virtualMachines`). Must align with `id`. |
| `name` | string | Yes | Display name of the resource. |
| `resourceGroup` | string | No | Resource group the resource belongs to. |
| `location` | string | No | Azure region (e.g., `eastus`, `westeurope`). |
| `properties` | object | No | Resource-specific properties (SKU, tier, size, etc.). |
| `tags` | object | No | Azure resource tags as key-value pairs. |
| `relationships` | array | No | Connections to other resources in the model. |

## Relationship Types

| Type | Description | Example |
|------|-------------|---------|
| `contains` | Parent contains child resource | VNet contains Subnet |
| `connects` | Network or data flow connection | VM connects to Storage Account |
| `depends` | Deployment dependency | App Service depends on App Service Plan |
| `peers` | Bidirectional peering | VNet peers with VNet |
| `secures` | Security association | NSG secures Subnet |
| `routes` | Traffic routing | Load Balancer routes to VM |

## Usage by Workflow  

- **Azure to Bicep workflow**: Builds a resource model from live Azure resources; generates Bicep from it.  
- **Azure to diagram workflow**: Builds a resource model from live Azure resources; generates Draw.io XML from it.  
- **Bicep and diagram comparison workflow**: Parses both Bicep and Draw.io into resource models and compares them.  
- **Bicep policy evaluation workflow**: Parses Bicep into a resource model to evaluate against Azure Policy.  
- **Bicep what-if comparison workflow**: Parses Bicep into a resource model and compares it against live Azure state.  
- **Diagram and Azure sync workflow**: Produces two resource models (diagram + live Azure) and compares them (quick or deep mode).  
- **Diagram to Bicep workflow**: Parses Draw.io XML into a resource model; enriches it with configuration manifest; generates Bicep.  
- **Sketch to diagram workflow**: Produces a resource model from image analysis; generates Draw.io XML via stencil mapping.  

## Common Azure Resource Types

| Resource Type | Short Name |
|---------------|------------|
| `Microsoft.Compute/virtualMachines` | VM |
| `Microsoft.Web/sites` | App Service |
| `Microsoft.Web/serverfarms` | App Service Plan |
| `Microsoft.Storage/storageAccounts` | Storage Account |
| `Microsoft.Sql/servers` | SQL Server |
| `Microsoft.Sql/servers/databases` | SQL Database |
| `Microsoft.Network/virtualNetworks` | VNet |
| `Microsoft.Network/virtualNetworks/subnets` | Subnet |
| `Microsoft.Network/networkSecurityGroups` | NSG |
| `Microsoft.Network/loadBalancers` | Load Balancer |
| `Microsoft.Network/applicationGateways` | App Gateway |
| `Microsoft.Network/publicIPAddresses` | Public IP |
| `Microsoft.Network/networkInterfaces` | NIC |
| `Microsoft.Network/privateDnsZones` | Private DNS Zone |
| `Microsoft.Network/privateEndpoints` | Private Endpoint |
| `Microsoft.Network/virtualNetworkGateways` | VPN Gateway |
| `Microsoft.KeyVault/vaults` | Key Vault |
| `Microsoft.ContainerRegistry/registries` | Container Registry |
| `Microsoft.ContainerService/managedClusters` | AKS |
| `Microsoft.App/containerApps` | Container App |
| `Microsoft.App/managedEnvironments` | Container App Environment |
| `Microsoft.DocumentDB/databaseAccounts` | Cosmos DB |
| `Microsoft.ServiceBus/namespaces` | Service Bus |
| `Microsoft.EventHub/namespaces` | Event Hub |
| `Microsoft.Cache/redis` | Redis Cache |
| `Microsoft.Insights/components` | Application Insights |
| `Microsoft.OperationalInsights/workspaces` | Log Analytics Workspace |
| `Microsoft.ApiManagement/service` | API Management |
| `Microsoft.SignalRService/signalR` | SignalR |
| `Microsoft.CognitiveServices/accounts` | Cognitive Services |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | Managed Identity |
| `Microsoft.Authorization/roleAssignments` | Role Assignment |
| `Microsoft.Resources/resourceGroups` | Resource Group |
