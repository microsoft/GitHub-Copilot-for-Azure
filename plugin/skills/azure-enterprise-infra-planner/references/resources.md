# Resource Catalog

Lookup table for all 48 supported Azure resource types. Use this catalog with MCP tools to get resource details with most recent documentation at runtime.

## How to Use This Catalog

> ⚠️ **During Phase 2 (Research — Refine & Lookup), you MUST act on this data — not just read it.**

For each resource in the plan:

1. **Look up** the resource in the category tables below to get its ARM type, API version, CAF prefix, and Region category.
2. **Call `microsoft_docs_fetch`** with the **Naming Rules** URL from the documentation table for this resource's category. Use a sub-agent: "Extract naming rules for {service}: min/max length, allowed characters, uniqueness scope. ≤200 tokens."
3. **Call `microsoft_docs_fetch`** with the **Service Overview** or **Additional** URL for service-specific limits and configuration. Use a sub-agent: "Summarize key configuration guidance, limits, and best practices. ≤300 tokens."
4. **Extract pairing constraints** from [constraints.md](constraints.md) — grep or line-range read for the `### {Resource Name}` section only. See the [Section Index](constraints.md#section-index) for valid headings. If no results, proceed without constraints.
5. **Check Region category** — if Mainstream or Strategic, verify availability in the target region (see [Region Categories](#region-categories) below).

> ⚠️ **Context window management**: Always delegate `microsoft_docs_fetch` calls to sub-agents with token budgets, and extract specific sections from large reference files (via grep or line-range reads), to keep the main planning context focused.

## AI & Machine Learning

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| Cognitive Services | `Microsoft.CognitiveServices/accounts` | `2025-06-01` | varies by kind | Resource group | Mainstream |
| ML Workspace | `Microsoft.MachineLearningServices/workspaces` | `2025-06-01` | `mlw`/`hub`/`proj` | Resource group | Mainstream |
| AI Search | `Microsoft.Search/searchServices` | `2025-05-01` | `srch` | Global | Mainstream |

### AI & ML Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| Cognitive Services | [2025-06-01](https://learn.microsoft.com/azure/templates/microsoft.cognitiveservices/accounts?pivots=deployment-language-bicep) | [Custom subdomain names](https://learn.microsoft.com/azure/ai-services/cognitive-services-custom-subdomains) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcognitiveservices) | [All API versions](https://learn.microsoft.com/azure/templates/microsoft.cognitiveservices/allversions) |
| ML Workspace | [2025-06-01](https://learn.microsoft.com/azure/templates/microsoft.machinelearningservices/workspaces?pivots=deployment-language-bicep) | [ML Services](https://learn.microsoft.com/azure/templates/microsoft.machinelearningservices/allversions) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftmachinelearningservices) | [All API versions](https://learn.microsoft.com/azure/templates/microsoft.machinelearningservices/allversions) |
| AI Search | [2025-05-01](https://learn.microsoft.com/azure/templates/microsoft.search/searchservices?pivots=deployment-language-bicep) | [Service limits](https://learn.microsoft.com/azure/search/search-limits-quotas-capacity) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsearch) | [All API versions](https://learn.microsoft.com/azure/templates/microsoft.search/allversions) |

## Compute

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| AKS Cluster | `Microsoft.ContainerService/managedClusters` | `2025-05-01` | `aks` | Resource group | Foundational |
| App Service | `Microsoft.Web/sites` | `2024-11-01` | `app` | Global | Mainstream |
| App Service Plan | `Microsoft.Web/serverfarms` | `2024-11-01` | `asp` | Resource group | Mainstream |
| Availability Set | `Microsoft.Compute/availabilitySets` | `2024-11-01` | `avail` | Resource group | Foundational |
| Container App | `Microsoft.App/containerApps` | `2025-01-01` | `ca` | Environment | Strategic |
| Container Apps Environment | `Microsoft.App/managedEnvironments` | `2025-01-01` | `cae` | Resource group | Strategic |
| Container Registry | `Microsoft.ContainerRegistry/registries` | `2025-04-01` | `cr` | Global | Mainstream |
| Function App | `Microsoft.Web/sites` | `2024-11-01` | `func` | Global | Mainstream |
| Managed Disk | `Microsoft.Compute/disks` | `2025-01-02` | `osdisk`/`disk` | Resource group | Foundational |
| Static Web App | `Microsoft.Web/staticSites` | `2024-11-01` | `stapp` | Resource group | Mainstream |
| Virtual Machine | `Microsoft.Compute/virtualMachines` | `2024-11-01` | `vm` | Resource group | Foundational |
| VM Scale Set | `Microsoft.Compute/virtualMachineScaleSets` | `2024-11-01` | `vmss` | Resource group | Foundational |

### Compute Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| AKS Cluster | [2025-05-01](https://learn.microsoft.com/azure/templates/microsoft.containerservice/managedclusters?pivots=deployment-language-bicep) | [AKS overview](https://learn.microsoft.com/azure/aks/intro-kubernetes) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcontainerservice) | [Networking concepts](https://learn.microsoft.com/azure/aks/concepts-network) |
| App Service | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.web/sites?pivots=deployment-language-bicep) | [App Service overview](https://learn.microsoft.com/azure/app-service/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb) | [Hosting plans](https://learn.microsoft.com/azure/app-service/overview-hosting-plans) |
| App Service Plan | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.web/serverfarms?pivots=deployment-language-bicep) | [Plan overview](https://learn.microsoft.com/azure/app-service/overview-hosting-plans) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb) | [Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux) |
| Availability Set | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.compute/availabilitysets?pivots=deployment-language-bicep) | [Overview](https://learn.microsoft.com/azure/virtual-machines/availability-set-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute) | — |
| Container App | [2025-01-01](https://learn.microsoft.com/azure/templates/microsoft.app/containerapps?pivots=deployment-language-bicep) | [Container Apps overview](https://learn.microsoft.com/azure/container-apps/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapp) | [Environments](https://learn.microsoft.com/azure/container-apps/environment) |
| Container Apps Environment | [2025-01-01](https://learn.microsoft.com/azure/templates/microsoft.app/managedenvironments?pivots=deployment-language-bicep) | [Environments overview](https://learn.microsoft.com/azure/container-apps/environment) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapp) | [Workload profiles](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview) |
| Container Registry | [2025-04-01](https://learn.microsoft.com/azure/templates/microsoft.containerregistry/registries?pivots=deployment-language-bicep) | [ACR overview](https://learn.microsoft.com/azure/container-registry/container-registry-intro) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcontainerregistry) | [SKU tiers](https://learn.microsoft.com/azure/container-registry/container-registry-skus) |
| Function App | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.web/sites?pivots=deployment-language-bicep) | [Functions overview](https://learn.microsoft.com/azure/azure-functions/functions-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb) | [Hosting plans](https://learn.microsoft.com/azure/azure-functions/functions-scale) |
| Managed Disk | [2025-01-02](https://learn.microsoft.com/azure/templates/microsoft.compute/disks?pivots=deployment-language-bicep) | [Managed disks overview](https://learn.microsoft.com/azure/virtual-machines/managed-disks-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute) | — |
| Static Web App | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.web/staticsites?pivots=deployment-language-bicep) | [Static Web Apps overview](https://learn.microsoft.com/azure/static-web-apps/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb) | [Hosting plans](https://learn.microsoft.com/azure/static-web-apps/plans) |
| Virtual Machine | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.compute/virtualmachines?pivots=deployment-language-bicep) | [VMs overview](https://learn.microsoft.com/azure/virtual-machines/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute) | [VM sizes](https://learn.microsoft.com/azure/virtual-machines/sizes/overview) |
| VM Scale Set | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.compute/virtualmachinescalesets?pivots=deployment-language-bicep) | [VMSS overview](https://learn.microsoft.com/azure/virtual-machine-scale-sets/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcompute) | — |

## Data

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| Cosmos DB | `Microsoft.DocumentDB/databaseAccounts` | `2025-04-15` | `cosmos` | Global | Foundational |
| Data Factory | `Microsoft.DataFactory/factories` | `2018-06-01` | `adf` | Global | Mainstream |
| MySQL Flexible Server | `Microsoft.DBforMySQL/flexibleServers` | `2023-12-30` | `mysql` | Global | Mainstream |
| PostgreSQL Flexible Server | `Microsoft.DBforPostgreSQL/flexibleServers` | `2024-08-01` | `psql` | Global | Mainstream |
| Redis Cache | `Microsoft.Cache/redis` | `2024-11-01` | `redis` | Global | Mainstream |
| SQL Database | `Microsoft.Sql/servers/databases` | `2023-08-01` | `sqldb` | Parent server | Foundational |
| SQL Server | `Microsoft.Sql/servers` | `2023-08-01` | `sql` | Global | Foundational |
| Storage Account | `Microsoft.Storage/storageAccounts` | `2025-01-01` | `st` | Global | Foundational |
| Synapse Workspace | `Microsoft.Synapse/workspaces` | `2021-06-01` | `synw` | Global | Strategic |

### Data Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| Cosmos DB | [2025-04-15](https://learn.microsoft.com/azure/templates/microsoft.documentdb/databaseaccounts?pivots=deployment-language-bicep) | [Cosmos DB overview](https://learn.microsoft.com/azure/cosmos-db/introduction) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdocumentdb) | [Consistency levels](https://learn.microsoft.com/azure/cosmos-db/consistency-levels) |
| Data Factory | [2018-06-01](https://learn.microsoft.com/azure/templates/microsoft.datafactory/factories?pivots=deployment-language-bicep) | [ADF overview](https://learn.microsoft.com/azure/data-factory/introduction) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdatafactory) | [ADF naming rules](https://learn.microsoft.com/azure/data-factory/naming-rules) |
| MySQL Flexible Server | [2023-12-30](https://learn.microsoft.com/azure/templates/microsoft.dbformysql/flexibleservers?pivots=deployment-language-bicep) | [MySQL overview](https://learn.microsoft.com/azure/mysql/flexible-server/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdbformysql) | [Compute and storage](https://learn.microsoft.com/azure/mysql/flexible-server/concepts-compute-storage) |
| PostgreSQL Flexible Server | [2024-08-01](https://learn.microsoft.com/azure/templates/microsoft.dbforpostgresql/flexibleservers?pivots=deployment-language-bicep) | [PostgreSQL overview](https://learn.microsoft.com/azure/postgresql/flexible-server/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdbforpostgresql) | [Compute and storage](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-compute-storage) |
| Redis Cache | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.cache/redis?pivots=deployment-language-bicep) | [Redis overview](https://learn.microsoft.com/azure/azure-cache-for-redis/cache-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcache) | [Service tiers](https://learn.microsoft.com/azure/azure-cache-for-redis/cache-overview#service-tiers) |
| SQL Database | [2023-08-01](https://learn.microsoft.com/azure/templates/microsoft.sql/servers/databases?pivots=deployment-language-bicep) | [SQL Database overview](https://learn.microsoft.com/azure/azure-sql/database/sql-database-paas-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsql) | [DTU vs vCore](https://learn.microsoft.com/azure/azure-sql/database/purchasing-models) |
| SQL Server | [2023-08-01](https://learn.microsoft.com/azure/templates/microsoft.sql/servers?pivots=deployment-language-bicep) | [SQL Server overview](https://learn.microsoft.com/azure/azure-sql/database/sql-database-paas-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsql) | [TDE with Key Vault](https://learn.microsoft.com/azure/azure-sql/database/transparent-data-encryption-byok-overview) |
| Storage Account | [2025-01-01](https://learn.microsoft.com/azure/templates/microsoft.storage/storageaccounts?pivots=deployment-language-bicep) | [Storage overview](https://learn.microsoft.com/azure/storage/common/storage-account-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftstorage) | [Storage redundancy](https://learn.microsoft.com/azure/storage/common/storage-redundancy) |
| Synapse Workspace | [2021-06-01](https://learn.microsoft.com/azure/templates/microsoft.synapse/workspaces?pivots=deployment-language-bicep) | [Synapse overview](https://learn.microsoft.com/azure/synapse-analytics/overview-what-is) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsynapse) | [All API versions](https://learn.microsoft.com/azure/templates/microsoft.synapse/allversions) |

## Messaging

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| Event Grid Topic | `Microsoft.EventGrid/topics` | `2025-02-15` | `evgt` | Region | Mainstream |
| Event Hub | `Microsoft.EventHub/namespaces` | `2024-01-01` | `evhns` | Global | Foundational |
| Service Bus | `Microsoft.ServiceBus/namespaces` | `2024-01-01` | `sbns` | Global | Foundational |

### Messaging Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| Event Grid Topic | [2025-02-15](https://learn.microsoft.com/azure/templates/microsoft.eventgrid/topics?pivots=deployment-language-bicep) | [Event Grid overview](https://learn.microsoft.com/azure/event-grid/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsofteventgrid) | [Security and auth](https://learn.microsoft.com/azure/event-grid/security-authentication) |
| Event Hub | [2024-01-01](https://learn.microsoft.com/azure/templates/microsoft.eventhub/namespaces?pivots=deployment-language-bicep) | [Event Hubs overview](https://learn.microsoft.com/azure/event-hubs/event-hubs-about) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsofteventhub) | [Event Hubs tiers](https://learn.microsoft.com/azure/event-hubs/event-hubs-quotas) |
| Service Bus | [2024-01-01](https://learn.microsoft.com/azure/templates/microsoft.servicebus/namespaces?pivots=deployment-language-bicep) | [Service Bus overview](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-messaging-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftservicebus) | [Service Bus tiers](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-premium-messaging) |

## Monitoring

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| Application Insights | `Microsoft.Insights/components` | `2020-02-02` | `appi` | Resource group | Mainstream |
| Log Analytics | `Microsoft.OperationalInsights/workspaces` | `2025-02-01` | `log` | Resource group | Mainstream |

### Monitoring Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| Application Insights | [2020-02-02](https://learn.microsoft.com/azure/templates/microsoft.insights/components?pivots=deployment-language-bicep) | [App Insights overview](https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftinsights) | [Workspace-based](https://learn.microsoft.com/azure/azure-monitor/app/convert-classic-resource) |
| Log Analytics | [2025-02-01](https://learn.microsoft.com/azure/templates/microsoft.operationalinsights/workspaces?pivots=deployment-language-bicep) | [Log Analytics overview](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftoperationalinsights) | [Pricing](https://learn.microsoft.com/azure/azure-monitor/logs/cost-logs) |

## Networking

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| API Management | `Microsoft.ApiManagement/service` | `2024-05-01` | `apim` | Global | Mainstream |
| Application Gateway | `Microsoft.Network/applicationGateways` | `2024-07-01` | `agw` | Resource group | Foundational |
| Azure Bastion | `Microsoft.Network/bastionHosts` | `2024-07-01` | `bas` | Resource group | Mainstream |
| Azure Firewall | `Microsoft.Network/azureFirewalls` | `2024-07-01` | `afw` | Resource group | Mainstream |
| DNS Zone | `Microsoft.Network/dnsZones` | `2018-05-01` | *(domain)* | Resource group | Foundational |
| Front Door | `Microsoft.Cdn/profiles` | `2025-06-01` | `afd` | Resource group | Foundational |
| Load Balancer | `Microsoft.Network/loadBalancers` | `2024-07-01` | `lbi`/`lbe` | Resource group | Foundational |
| NAT Gateway | `Microsoft.Network/natGateways` | `2024-07-01` | `ng` | Resource group | Foundational |
| Network Interface | `Microsoft.Network/networkInterfaces` | `2024-07-01` | `nic` | Resource group | Foundational |
| NSG | `Microsoft.Network/networkSecurityGroups` | `2024-07-01` | `nsg` | Resource group | Foundational |
| Private DNS Zone | `Microsoft.Network/privateDnsZones` | `2024-06-01` | *(domain)* | Resource group | Foundational |
| Private Endpoint | `Microsoft.Network/privateEndpoints` | `2024-07-01` | `pep` | Resource group | Foundational |
| Public IP | `Microsoft.Network/publicIPAddresses` | `2024-07-01` | `pip` | Resource group | Foundational |
| Route Table | `Microsoft.Network/routeTables` | `2024-07-01` | `rt` | Resource group | Foundational |
| Subnet | `Microsoft.Network/virtualNetworks/subnets` | `2024-07-01` | `snet` | Parent VNet | Foundational |
| Virtual Network | `Microsoft.Network/virtualNetworks` | `2024-07-01` | `vnet` | Resource group | Foundational |
| VPN Gateway | `Microsoft.Network/virtualNetworkGateways` | `2024-07-01` | `vpng` | Resource group | Foundational |

### Networking Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| API Management | [2024-05-01](https://learn.microsoft.com/azure/templates/microsoft.apimanagement/service?pivots=deployment-language-bicep) | [APIM overview](https://learn.microsoft.com/azure/api-management/api-management-key-concepts) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapimanagement) | [VNet integration](https://learn.microsoft.com/azure/api-management/virtual-network-concepts) |
| Application Gateway | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/applicationgateways?pivots=deployment-language-bicep) | [App Gateway overview](https://learn.microsoft.com/azure/application-gateway/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [v2 features](https://learn.microsoft.com/azure/application-gateway/application-gateway-autoscaling-zone-redundant) |
| Azure Bastion | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/bastionhosts?pivots=deployment-language-bicep) | [Bastion overview](https://learn.microsoft.com/azure/bastion/bastion-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Configuration settings](https://learn.microsoft.com/azure/bastion/configuration-settings) |
| Azure Firewall | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/azurefirewalls?pivots=deployment-language-bicep) | [Firewall overview](https://learn.microsoft.com/azure/firewall/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [SKU comparison](https://learn.microsoft.com/azure/firewall/choose-firewall-sku) |
| DNS Zone | [2018-05-01](https://learn.microsoft.com/azure/templates/microsoft.network/dnszones?pivots=deployment-language-bicep) | [Azure DNS overview](https://learn.microsoft.com/azure/dns/dns-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Delegate a domain](https://learn.microsoft.com/azure/dns/dns-delegate-domain-azure-dns) |
| Front Door | [2025-06-01](https://learn.microsoft.com/azure/templates/microsoft.cdn/profiles?pivots=deployment-language-bicep) | [Front Door overview](https://learn.microsoft.com/azure/frontdoor/front-door-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcdn) | [Routing architecture](https://learn.microsoft.com/azure/frontdoor/front-door-routing-architecture) |
| Load Balancer | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/loadbalancers?pivots=deployment-language-bicep) | [LB overview](https://learn.microsoft.com/azure/load-balancer/load-balancer-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Standard LB](https://learn.microsoft.com/azure/load-balancer/load-balancer-standard-overview) |
| NAT Gateway | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/natgateways?pivots=deployment-language-bicep) | [NAT Gateway overview](https://learn.microsoft.com/azure/nat-gateway/nat-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Availability zones](https://learn.microsoft.com/azure/nat-gateway/nat-availability-zones) |
| Network Interface | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/networkinterfaces?pivots=deployment-language-bicep) | [NIC overview](https://learn.microsoft.com/azure/virtual-network/virtual-network-network-interface) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Accelerated networking](https://learn.microsoft.com/azure/virtual-network/accelerated-networking-overview) |
| NSG | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/networksecuritygroups?pivots=deployment-language-bicep) | [NSG overview](https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Security rules](https://learn.microsoft.com/azure/virtual-network/network-security-group-how-it-works) |
| Private DNS Zone | [2024-06-01](https://learn.microsoft.com/azure/templates/microsoft.network/privatednszones?pivots=deployment-language-bicep) | [Private DNS overview](https://learn.microsoft.com/azure/dns/private-dns-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [PE DNS config](https://learn.microsoft.com/azure/private-link/private-endpoint-dns) |
| Private Endpoint | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/privateendpoints?pivots=deployment-language-bicep) | [PE overview](https://learn.microsoft.com/azure/private-link/private-endpoint-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [DNS zone values](https://learn.microsoft.com/azure/private-link/private-endpoint-dns) |
| Public IP | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/publicipaddresses?pivots=deployment-language-bicep) | [Public IP overview](https://learn.microsoft.com/azure/virtual-network/ip-services/public-ip-addresses) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Basic SKU retirement](https://learn.microsoft.com/azure/virtual-network/ip-services/public-ip-basic-upgrade-guidance) |
| Route Table | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/routetables?pivots=deployment-language-bicep) | [Traffic routing](https://learn.microsoft.com/azure/virtual-network/virtual-networks-udr-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Forced tunneling](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-forced-tunneling-rm) |
| Subnet | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks/subnets?pivots=deployment-language-bicep) | [Subnets](https://learn.microsoft.com/azure/virtual-network/virtual-network-manage-subnet) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Subnet delegation](https://learn.microsoft.com/azure/virtual-network/subnet-delegation-overview) |
| Virtual Network | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworks?pivots=deployment-language-bicep) | [VNet overview](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [VNet planning](https://learn.microsoft.com/azure/virtual-network/virtual-network-vnet-plan-design-arm) |
| VPN Gateway | [2024-07-01](https://learn.microsoft.com/azure/templates/microsoft.network/virtualnetworkgateways?pivots=deployment-language-bicep) | [VPN Gateway overview](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpngateways) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftnetwork) | [Gateway SKUs](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-gateway-settings#gwsku) |

## Security

| Resource | ARM Type | API Version | CAF Prefix | Naming Scope | Region |
|----------|----------|-------------|------------|--------------|--------|
| Key Vault | `Microsoft.KeyVault/vaults` | `2024-11-01` | `kv` | Global | Foundational |
| Managed Identity | `Microsoft.ManagedIdentity/userAssignedIdentities` | `2024-11-30` | `id` | Resource group | Foundational |

### Security Documentation

| Resource | Bicep Reference | Service Overview | Naming Rules | Additional |
|----------|----------------|------------------|--------------|------------|
| Key Vault | [2024-11-01](https://learn.microsoft.com/azure/templates/microsoft.keyvault/vaults?pivots=deployment-language-bicep) | [Key Vault overview](https://learn.microsoft.com/azure/key-vault/general/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftkeyvault) | [Soft-delete](https://learn.microsoft.com/azure/key-vault/general/soft-delete-overview) |
| Managed Identity | [2024-11-30](https://learn.microsoft.com/azure/templates/microsoft.managedidentity/userassignedidentities?pivots=deployment-language-bicep) | [Managed identities](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview) | [Naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftmanagedidentity) | [Workload identity federation](https://learn.microsoft.com/entra/workload-id/workload-identity-federation) |

## Region Categories

Categories from [Available services by region types and categories](https://learn.microsoft.com/azure/reliability/availability-service-by-category):

| Category | Region Availability |
|----------|---------------------|
| **Foundational** | Available in all recommended and alternate regions — no verification needed |
| **Mainstream** | Available in all recommended regions; demand-driven in alternate regions — verify if targeting alternate region |
| **Strategic** | Demand-driven across regions — always verify before planning |

> Only Mainstream and Strategic resources require region verification. Fetch via `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Globally-Unique Names

These resources require globally unique names (DNS-based):

| Resource | DNS Pattern |
|----------|-------------|
| Storage Account | `{name}.blob.core.windows.net` |
| Key Vault | `{name}.vault.azure.net` |
| Cosmos DB | `{name}.documents.azure.com` |
| SQL Server | `{name}.database.windows.net` |
| Function App | `{name}.azurewebsites.net` |
| App Service | `{name}.azurewebsites.net` |
| Redis Cache | `{name}.redis.cache.windows.net` |
| Service Bus | `{name}.servicebus.windows.net` |
| Event Hub | `{name}.servicebus.windows.net` |
| Data Factory | `{name}.adf.azure.com` |
| Synapse Workspace | `{name}.dev.azuresynapse.net` |
| Container Registry | `{name}.azurecr.io` |
| AI Search | `{name}.search.windows.net` |
| API Management | `{name}.azure-api.net` |
| PostgreSQL Flexible Server | `{name}.postgres.database.azure.com` |
| MySQL Flexible Server | `{name}.mysql.database.azure.com` |

## Shared ARM Types

Some resource types share the same ARM type and are distinguished by `kind`:

| ARM Type | `kind` Value | Resource |
|----------|--------------|----------|
| `Microsoft.Web/sites` | `app` / `app,linux` | App Service |
| `Microsoft.Web/sites` | `functionapp` / `functionapp,linux` | Function App |
| `Microsoft.MachineLearningServices/workspaces` | _(omitted)_ / `Default` | ML Workspace |
| `Microsoft.MachineLearningServices/workspaces` | `Hub` | AI Foundry Hub |
| `Microsoft.MachineLearningServices/workspaces` | `Project` | AI Foundry Project |
| `Microsoft.MachineLearningServices/workspaces` | `FeatureStore` | Feature Store |
