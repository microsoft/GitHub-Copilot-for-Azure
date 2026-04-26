# Auto-Detection Rules

Settings automatically applied based on diagram topology during Bicep generation.

| Condition | Auto-Setting |
|-----------|-------------|
| Resource has a Private Endpoint connection | Set `publicNetworkAccess: 'Disabled'` on target resource |  
| App Service connected to a Subnet | Set `vnetIntegrationSubnet` to the subnet reference |  
| Private Endpoint connected to SQL Server | Set `groupIds: ['sqlServer']` |  
| Private Endpoint connected to Storage Account | Set `groupIds: ['blob']` |  
| Private Endpoint connected to App Service | Set `groupIds: ['sites']` |  
| Private Endpoint connected to Key Vault | Set `groupIds: ['vault']` |  
| Private Endpoint connected to Cosmos DB | Set `groupIds: ['Sql']` |  
| Private Endpoint exists in a subnet | Set `privateEndpointNetworkPolicies: 'Disabled'` on that subnet |  
| VM exists without NIC in diagram | Auto-add NIC resource |
| App Service exists without App Service Plan | Auto-add App Service Plan |
| Subnet index N | Derive `addressPrefix` from the VNet `addressSpace` when present; otherwise require or prompt for a base CIDR before auto-assigning a non-overlapping subnet |  

