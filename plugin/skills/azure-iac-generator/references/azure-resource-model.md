# Azure Resource Metadata Model

> **Canonical copy:** Shared resource-model schema used across Azure IaC and diagram skills. Keep local copies aligned when this schema changes.


Shared internal representation used by AzVerify skills (sketch-to-diagram, diagram-to-bicep, diagram-azure-sync).

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
| `id` | string | Yes | Unique identifier within the model. Use a short slug (e.g., `vm-web-01`). |
| `type` | string | Yes | Azure resource provider type (e.g., `Microsoft.Compute/virtualMachines`). |
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

## Usage by Skill

- **azure-to-bicep**: Builds a resource model from live Azure resources; generates Bicep from it.
- **azure-to-diagram**: Builds a resource model from live Azure resources; generates Draw.io XML from it.
- **bicep-diagram-sync**: Parses both Bicep and Draw.io into resource models and compares them.
- **bicep-policy-check**: Parses Bicep into a resource model to evaluate against Azure Policy.
- **bicep-whatif**: Parses Bicep into a resource model and compares it against live Azure state.
- **diagram-azure-sync**: Produces two resource models (diagram + live Azure) and compares them (quick or deep mode).
- **diagram-to-bicep**: Parses Draw.io XML into a resource model; enriches it with configuration manifest; generates Bicep.
- **sketch-to-diagram**: Produces a resource model from image analysis; generates Draw.io XML via stencil mapping.

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
