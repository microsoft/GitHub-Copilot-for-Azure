# Resource Pairing Constraints

Per-resource pairing rules that cannot be obtained from MCP tools. Use `grep` to extract individual `### Resource Name` sections rather than loading the entire file.

## Section Index

Resource names below match the `Resource` column in [resources.md](resources.md). Use the exact name with grep:

| Category | Resources |
|----------|-----------|
| AI & ML | AI Search, Cognitive Services, ML Workspace |
| Compute | AKS Cluster, App Service, App Service Plan, Availability Set, Container App, Container Apps Environment, Container Registry, Function App, Managed Disk, Static Web App, Virtual Machine, VM Scale Set |
| Data | Cosmos DB, Data Factory, MySQL Flexible Server, PostgreSQL Flexible Server, Redis Cache, SQL Database, SQL Server, Storage Account, Synapse Workspace |
| Messaging | Event Grid, Event Hub, Service Bus |
| Monitoring | Application Insights, Log Analytics |
| Networking | API Management, Application Gateway, Azure Bastion, Azure Firewall, DNS Zone, Front Door, Load Balancer, NAT Gateway, Network Interface, NSG, Private DNS Zone, Private Endpoint, Public IP, Route Table, Subnet, Virtual Network, VPN Gateway |
| Security | Key Vault, Managed Identity |

## AI & Machine Learning

### AI Search

| Paired With | Constraint |
|-------------|------------|
| **Cognitive Services (AI Enrichment)** | For AI enrichment pipelines (skillsets), attach a Cognitive Services account. Must be `kind: 'CognitiveServices'` or `kind: 'AIServices'` and in the same region as the search service. |
| **Storage Account (Indexers)** | Indexer data sources support Blob, Table, and File storage. Storage must be accessible (same VNet or public). For managed identity access, assign `Storage Blob Data Reader` role. |
| **Cosmos DB (Indexers)** | Indexer data source for Cosmos DB. Requires connection string or managed identity with `Cosmos DB Account Reader Role`. |
| **SQL Database (Indexers)** | Indexer data source. Requires change tracking enabled on the source table. |
| **Private Endpoints** | When `publicNetworkAccess: 'Disabled'`, create shared private link resources for outbound connections to data sources. |
| **Managed Identity** | Assign system or user-assigned identity for secure connections to data sources. Use RBAC instead of connection strings. |
| **Semantic Search** | Requires `semanticSearch` property set to `free` or `standard`. Available on `basic` and above SKUs. |

### Cognitive Services

| Paired With | Constraint |
|-------------|------------|
| **Azure OpenAI Deployments** | When `kind: 'OpenAI'` or `kind: 'AIServices'`, create model deployments as child resource `accounts/deployments`. |
| **Microsoft Entra ID Auth** | Requires `customSubDomainName` to be set. Without it, only API key auth works. |
| **Private Endpoint** | Requires `customSubDomainName`. Set `publicNetworkAccess: 'Disabled'` and configure private DNS zone. |
| **Key Vault (CMK)** | When using customer-managed keys, Key Vault must have soft-delete and purge protection enabled. Set `encryption.keySource: 'Microsoft.KeyVault'`. |
| **Storage Account** | When using `userOwnedStorage`, the storage account must be in the same region. Required for certain features (e.g., batch translation). |
| **AI Foundry Hub** | When `kind: 'AIServices'` with `allowProjectManagement: true`, can manage Foundry projects as child resources (`accounts/projects`). |
| **VNet Integration** | Configure `networkAcls` with `defaultAction: 'Deny'` and add virtual network rules. Set `bypass: 'AzureServices'` to allow trusted Azure services. |

### ML Workspace

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Must be linked via `properties.storageAccount`. Cannot change after creation. Use `StorageV2` kind with standard SKU. |
| **Key Vault** | Must be linked via `properties.keyVault`. Cannot change after creation. Requires soft-delete enabled. |
| **Application Insights** | Linked via `properties.applicationInsights`. Should use workspace-based App Insights (backed by Log Analytics). |
| **Container Registry** | Optional but recommended for custom environments. Linked via `properties.containerRegistry`. |
| **Hub workspace (kind=Project)** | Must set `properties.hubResourceId` to the parent Hub's ARM resource ID. The Project inherits the Hub's linked resources. |
| **VNet Integration** | When `managedNetwork.isolationMode` is `AllowOnlyApprovedOutbound`, must configure outbound rules for all dependent services. |

## Compute

### AKS Cluster

| Paired With | Constraint |
|-------------|------------|
| **VNet / Subnet** | With Azure CNI, subnet must have enough IPs for nodes + pods (30 pods/node default × node count). Subnet cannot have other delegations. Reserved CIDR ranges cannot be used: `169.254.0.0/16`, `172.30.0.0/16`, `172.31.0.0/16`, `192.0.2.0/24`. |
| **Pod CIDR** | Pod CIDR must not overlap with cluster subnet, peered VNets, ExpressRoute, or VPN address spaces. Overlapping causes SNAT/routing issues. |
| **kubenet** | Kubenet uses NAT — subnet only needs IPs for nodes. Less IP pressure but no direct pod-to-VNet connectivity. Kubenet is retiring March 2028 — migrate to CNI Overlay. Not supported by Application Gateway for Containers. |
| **CNI Overlay** | CNI Overlay does not support VM availability sets (must use VMSS-based node pools), virtual nodes, or DCsv2-series VMs (use DCasv5/DCadsv5 instead). |
| **Dual-stack CNI Overlay** | IPv4+IPv6 dual-stack disables Azure/Calico network policies, NAT gateway, and virtual nodes. |
| **Key Vault** | Enable `azureKeyvaultSecretsProvider` addon. Use `enableRbacAuthorization: true` on Key Vault with managed identity. |
| **Container Registry** | Attach ACR via `acrPull` role assignment on cluster identity, or use `imagePullSecrets`. |
| **Log Analytics** | Enable `omsagent` addon with `config.logAnalyticsWorkspaceResourceID` pointing to workspace. |
| **Load Balancer** | AKS creates a managed Standard LB by default (`loadBalancerSku: 'standard'`). |
| **System Pool** | At least one agent pool must have `mode: 'System'`. System pools run critical pods (CoreDNS, tunnelfront). |

### App Service

| Paired With | Constraint |
|-------------|------------|
| **App Service Plan** | Must be in the same region. Linux apps need Linux plan (`reserved: true`). Windows apps need Windows plan. |
| **Deployment Slots** | Only available on Standard or higher plan tiers. Free and Basic do not support slots. |
| **VNet Integration** | Requires Basic or higher plan tier. Subnet must be delegated to `Microsoft.Web/serverFarms`. VNet integration subnet must be a different subnet than any Private Endpoint subnet. |
| **Private Endpoints** | Requires Basic or higher plan tier. Not available on Free or Shared tiers. |
| **Custom Domain** | Requires Shared (D1) or higher tier for custom domains. Free tier only supports `*.azurewebsites.net`. Managed certificates require Basic or higher. |
| **Application Insights** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. |
| **Key Vault References** | Use `@Microsoft.KeyVault(SecretUri=...)` in app settings. Requires managed identity with Key Vault access. |
| **Managed Identity** | Enable `identity.type: 'SystemAssigned'` or `'UserAssigned'` for passwordless auth to other Azure resources. |

### App Service Plan

| Paired With | Constraint |
|-------------|------------|
| **Function App** | Consumption (`Y1`) and Flex (`FC1`) plans cannot be shared with web apps. EP plans can host both functions and web apps. |
| **Linux Apps** | Linux plan (`reserved: true`) cannot host Windows apps and vice versa. |
| **Zone Redundancy** | Requires Premium v3 (`P1v3`+) or Isolated v2. Minimum 3 instances. |
| **Deployment Slots** | Slots share plan capacity. Standard+ tier required. Slots are not available on Free/Basic. |
| **Auto-scale** | Not available on Free/Shared/Basic. Standard+ required for manual scale, auto-scale. |
| **VNet Integration** | Requires Basic or higher. Subnet must be delegated to `Microsoft.Web/serverFarms`. Minimum subnet size /28 (or /26 for multi-plan subnet join). VNet integration subnet must be a different subnet than any Private Endpoint subnet. |
| **Private Endpoints** | Requires Basic tier or higher. Not available on Free or Shared tiers. |
| **Isolated Compute** | Dedicated single-tenant compute requires IsolatedV2 (`I1v2`+) tier. |
| **Free/Shared Tiers** | Free (`F1`) and Shared (`D1`) use shared compute with no VNet integration, no private endpoints, no deployment slots, no Always On, and no auto-scale. Managed Identity is available but limited. |

### Availability Set

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | VMs must be in the same resource group. Set `vm.properties.availabilitySet.id`. |
| **Availability Zones** | Cannot combine with zones — availability zones supersede availability sets for zone-redundant architectures. |
| **Managed Disks** | `sku.name` must be `Aligned` when VMs use managed disks. |
| **VM Scale Set** | A VM cannot be in both an availability set and a VMSS. |

### Container App

| Paired With | Constraint |
|-------------|------------|
| **Container Apps Environment** | Must reference `environmentId`. Environment must exist in the same region. |
| **VNet** | VNet integration is configured on the **Environment**, not the individual app. Environment needs a dedicated subnet with minimum /23 prefix for Consumption-only environments or /27 for workload profiles environments. |
| **Container Registry** | Requires registry credentials in `configuration.registries[]` or managed identity-based pull. |
| **Dapr** | Enable via `configuration.dapr.enabled: true`. Dapr components are configured on the Environment. |
| **CPU/Memory** | CPU and memory must follow valid combinations: 0.25 cores/0.5Gi, 0.5/1Gi, 1/2Gi, 2/4Gi, 4/8Gi (consumption). |
| **Scale Rules** | KEDA-based scale rules reference secrets by name — secrets must be defined in `configuration.secrets[]`. |

### Container Apps Environment

| Paired With | Constraint |
|-------------|------------|
| **Container App** | Container Apps reference the environment via `properties.environmentId`. Apps and environment must be in the same region. |
| **Log Analytics Workspace** | Provide `customerId` and `sharedKey` in `appLogsConfiguration`. Workspace must exist before the environment. |
| **VNet / Subnet** | Subnet must have a minimum /23 prefix for Consumption-only environments or /27 for workload profiles environments. Subnet must be dedicated to the Container Apps Environment (no other resources). Workload Profiles: subnet must be delegated to `Microsoft.App/environments`. Consumption-only: subnet MUST NOT be delegated to any service. |
| **Zone Redundancy** | Requires VNet integration. Zone-redundant environments need a /23 subnet in a region with availability zones. |
| **Internal Environment** | When `internal: true`, no public endpoint is created. Requires custom DNS or Private DNS Zone and a VNet with connectivity to clients. |
| **Workload Profiles** | At least one `Consumption` profile must be defined when using workload profiles. Dedicated profiles require `minimumCount` and `maximumCount`. |
| **Workload Profiles vs Consumption-only** | UDR support, NAT Gateway egress, private endpoints, and remote gateway peering are only available with Workload Profiles environments — not Consumption-only. |
| **Network Immutability** | Network type (Workload Profiles vs Consumption-only) is immutable after creation. Cannot change between environment types. |
| **IPv6** | IPv6 is not supported for either Workload Profiles or Consumption-only environments. |
| **VNet Move** | VNet-integrated environments cannot be moved to a different resource group or subscription while in use. |

### Container Registry

| Paired With | Constraint |
|-------------|------------|
| **AKS** | AKS needs `acrPull` role assignment on the registry. Use managed identity (attach via `az aks update --attach-acr`). |
| **Container App** | Reference in `configuration.registries[]`. Use managed identity or admin credentials. |
| **ML Workspace** | Referenced as `containerRegistry` property. Used for custom training/inference images. |
| **Private Endpoint** | Premium SKU required. Set `publicNetworkAccess: 'Disabled'`. |
| **Geo-Replication** | Premium SKU required. Configure via child `replications` resource. |
| **CMK** | Premium SKU required. Needs user-assigned identity with Key Vault access. |

### Function App

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Must use `StorageV2` or `Storage` kind. `BlobStorage`, `BlockBlobStorage`, `FileStorage` not supported (need Queue + Table). |
| **Storage (Consumption)** | Consumption plan cannot use VNet-secured storage. Only Premium/Dedicated support VNet-restricted storage. |
| **Storage (ZRS)** | Zone-redundant functions require `Standard_ZRS` storage SKU. |
| **App Service Plan** | Plan must be in the same region. Linux functions need Linux plan (`reserved: true`). |
| **VNet Integration** | Requires Premium (EP) or Dedicated plan. Consumption does not support VNet integration (use Flex Consumption). |
| **Application Insights** | Set `APPINSIGHTS_INSTRUMENTATIONKEY` or `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. |
| **Key Vault References** | App settings can use `@Microsoft.KeyVault(SecretUri=...)` syntax. Requires managed identity with Key Vault access. |

### Managed Disk

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | Attach via `storageProfile.osDisk` or `storageProfile.dataDisks`. Disk must be in same region. |
| **Availability Zone** | `PremiumV2_LRS` and `UltraSSD_LRS` require zone specification. |
| **Premium SSD v2** | Cannot be used as OS disk (data disks only). Does not support host caching (`ReadOnly`/`ReadWrite` unavailable). Requires zonal VM deployment. Cannot mix with other storage types on SQL Server VMs. |
| **Key Vault (CMK)** | Requires a Disk Encryption Set pointing to Key Vault key. Key Vault must have purge protection enabled. |

### Static Web App

| Paired With | Constraint |
|-------------|------------|
| **GitHub Repository** | Provide `repositoryUrl`, `branch`, and `repositoryToken`. A GitHub Actions workflow is auto-created in the repo. |
| **Azure DevOps** | Set `provider: 'DevOps'`. Provide `repositoryUrl` and `branch`. Pipeline is configured separately. |
| **Azure Functions (managed)** | API location in `buildProperties.apiLocation` deploys a managed Functions backend. Limited to HTTP triggers, C#, JavaScript, Python, Java. |
| **Linked Backend** | Use `linkedBackends` child resource to connect an existing Function App, Container App, or App Service as the API backend. Standard SKU required. |
| **Private Endpoint** | Only available with `Standard` SKU. Set up a Private Endpoint to restrict access to the static web app. |
| **Custom Domain** | Custom domains are child resources. Require DNS CNAME or TXT validation. Free SSL certificates are auto-provisioned. |
| **Enterprise-Grade CDN** | `Standard` SKU only. Enables Azure Front Door integration for advanced caching and edge capabilities. |

### Virtual Machine

| Paired With | Constraint |
|-------------|------------|
| **NIC** | At least one NIC required via `networkProfile.networkInterfaces`. NIC must be in the same region. |
| **Availability Set** | Cannot combine with `virtualMachineScaleSet` or availability zones. Set `availabilitySet.id`. |
| **Availability Zone** | Cannot combine with availability sets. Set `zones: ['1']` (string array). |
| **Managed Disk (Premium SSD)** | Not all VM sizes support Premium storage — check size docs for compatibility. |
| **Managed Disk (UltraSSD)** | Requires `additionalCapabilities.ultraSSDEnabled: true`. Cannot enable on a running VM — requires stop/deallocate first. |
| **Managed Disk (Premium SSD v2)** | Premium SSD v2 cannot be used as OS disk (data disks only). Does not support host caching (ReadOnly/ReadWrite unavailable). Requires zonal VM deployment. Cannot mix Premium SSD v2 with other storage types on SQL Server VMs. |
| **Dedicated Host** | Cannot specify both `host` and `hostGroup`. |
| **Boot Diagnostics Storage** | Cannot use Premium or ZRS storage. Use `Standard_LRS` or `Standard_GRS`. |
| **CNI Overlay (AKS)** | DCsv2-series VMs are not supported with Azure CNI Overlay. Use DCasv5/DCadsv5 for confidential computing. |

### VM Scale Set

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Network interfaces defined inline in `virtualMachineProfile.networkProfile`. Subnet must be in same region. |
| **Load Balancer** | Reference backend pool ID in NIC IP configuration. |
| **Orchestration Mode** | `Flexible` is the modern default. `Uniform` requires `upgradePolicy`. |
| **Availability Zone** | Set `zones: ['1', '2', '3']` for zone distribution. Cannot combine with availability sets. |

## Data

### Cosmos DB

| Paired With | Constraint |
|-------------|------------|
| **Multi-region writes** | `consistencyPolicy.defaultConsistencyLevel` cannot be `Strong` when `enableMultipleWriteLocations: true`. |
| **Strong consistency** | Strong consistency with regions >5000 miles apart is blocked by default (requires support ticket to enable). Strong and Bounded Staleness reads cost 2× RU/s compared to Session/Consistent Prefix/Eventual. |
| **Serverless** | Cannot combine `EnableServerless` capability with multi-region writes or analytical store. Serverless is single-region only — cannot add regions. No shared throughput databases. Cannot provision throughput (auto-managed; settings return error). Merge partitions not available for serverless accounts. |
| **Free tier** | Only one free-tier account per subscription. Cannot combine with multi-region writes. |
| **VNet** | Set `isVirtualNetworkFilterEnabled: true` and configure `virtualNetworkRules[]` with subnet IDs. Subnets need `Microsoft.AzureCosmosDB` service endpoint. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. One Private DNS Zone record per DNS name — multiple private endpoints in different regions need separate Private DNS Zones. |
| **Key Vault (CMK)** | Requires `keyVaultKeyUri` in encryption config. Key Vault must be in same region. |
| **Merge Partitions** | Not available for serverless or multi-region write accounts. Single-region provisioned throughput only. |

### Data Factory

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Linked service requires `Storage Blob Data Contributor` role on the storage account for the ADF managed identity. For ADLS Gen2, also requires `Storage Blob Data Reader` at minimum. |
| **Key Vault** | For CMK encryption, Key Vault must have `softDeleteEnabled: true` and `enablePurgeProtection: true`. ADF managed identity needs `Key Vault Crypto Service Encryption User` role or equivalent access policy. |
| **Managed VNet** | When `managedVirtualNetworks` is configured, all outbound connections must use managed private endpoints (`factories/managedVirtualNetworks/managedPrivateEndpoints`). |
| **Private Endpoint** | When `publicNetworkAccess: 'Disabled'`, must create private endpoint to `dataFactory` sub-resource for studio access and pipeline connectivity. |
| **Purview** | Requires Microsoft Purview instance resource ID. ADF managed identity must have `Data Curator` role in Purview. |
| **Integration Runtime** | Self-hosted IR requires network line-of-sight to on-premises sources. Azure IR regional choice affects data residency. |

### MySQL Flexible Server

| Paired With | Constraint |
|-------------|------------|
| **VNet (private access)** | Requires a dedicated subnet delegated to `Microsoft.DBforMySQL/flexibleServers`. Subnet must have no other resources. |
| **Private DNS Zone** | For VNet-integrated (private access) servers, use the zone name `{name}.mysql.database.azure.com` (not `privatelink.*`). The `privatelink.mysql.database.azure.com` zone is used for Private Endpoint connectivity only. Provide `privateDnsZoneResourceId` and the DNS zone must be linked to the VNet. |
| **High Availability** | `ZoneRedundant` HA requires `GeneralPurpose` or `MemoryOptimized` tier. Not available with `Burstable`. |
| **Geo-Redundant Backup** | Must be enabled at server creation time. Cannot be changed after creation. Not available in all regions. |
| **Storage Auto-Grow** | Storage can only grow, never shrink. Enabled by default. |
| **Read Replicas** | Source server must have `backup.backupRetentionDays` > 1. Replica count limit: up to 10 replicas. |
| **Key Vault (CMK)** | Customer-managed keys require user-assigned managed identity and Key Vault with purge protection enabled. |

### PostgreSQL Flexible Server

| Paired With | Constraint |
|-------------|------------|
| **VNet (private access)** | Requires a dedicated subnet delegated to `Microsoft.DBforPostgreSQL/flexibleServers`. Subnet must have no other resources. |
| **Private DNS Zone** | For VNet-integrated (private access) servers, use the zone name `{name}.postgres.database.azure.com` (not `privatelink.*`). The `privatelink.postgres.database.azure.com` zone is used for Private Endpoint connectivity only. Provide `privateDnsZoneArmResourceId` and the DNS zone must be linked to the VNet. |
| **High Availability** | `ZoneRedundant` HA requires `GeneralPurpose` or `MemoryOptimized` tier. Not available with `Burstable`. |
| **Geo-Redundant Backup** | Not available in all regions. Cannot be enabled with VNet-integrated (private access) servers in some configurations. |
| **Storage Auto-Grow** | Storage can only grow, never shrink. Minimum increase is based on current size. |
| **Key Vault (CMK)** | Customer-managed keys require user-assigned managed identity and Key Vault with purge protection enabled. |

### Redis Cache

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Only Premium SKU supports VNet injection via `subnetId`. Basic/Standard use firewall rules only. |
| **VNet + Private Endpoint** | VNet injection and private endpoint are mutually exclusive — cannot use both on the same cache. |
| **Private Endpoint** | Available for Basic, Standard, Premium, and Enterprise tiers. Set `publicNetworkAccess: 'Disabled'` when using private endpoints. Premium with clustering supports max 1 private link; non-clustered supports up to 100. |
| **Clustering** | Only Premium SKU supports `shardCount`. Basic and Standard are single-node/two-node only. |
| **Persistence** | Only Premium SKU supports RDB/AOF persistence. Requires a storage account for RDB exports. |
| **Geo-replication** | Only Premium SKU. Primary and secondary must be Premium with same shard count. Passive geo-replication with private endpoints requires unlinking geo-replication first, adding private link, then re-linking. |
| **Zones** | Zone redundancy requires Premium SKU with multiple replicas. |
| **Tier Scaling** | Cannot scale down tiers (Enterprise → lower, Premium → Standard/Basic, Standard → Basic). Cannot scale between Enterprise and Enterprise Flash, or from Basic/Standard/Premium to Enterprise/Flash — must create a new cache. |
| **Enterprise/Flash** | Firewall rules and `publicNetworkAccess` flag are not available on Enterprise/Enterprise Flash tiers. |
| **Azure Lighthouse** | Azure Lighthouse + VNet injection is not supported. Use private links instead. |

### SQL Database

| Paired With | Constraint |
|-------------|------------|
| **SQL Server** | Must be deployed as child of the parent SQL Server. Location must match. |
| **Elastic Pool** | `elasticPoolId` must reference a pool on the same server. Cannot set `sku` when using elastic pool (it inherits pool SKU). |
| **Zone Redundancy** | Only available in `GeneralPurpose`, `BusinessCritical`, and `Hyperscale` tiers. Not available in DTU tiers. General Purpose zone redundancy is only available in selected regions. Hyperscale zone redundancy can only be set at creation — cannot modify after provisioning; must recreate via copy/restore/geo-replica. |
| **Serverless** | Only available in `GeneralPurpose` tier. SKU name uses `GP_S_Gen5_*` pattern. |
| **Hyperscale** | Reverse migration from Hyperscale to General Purpose is supported within 45 days of the original migration. Databases originally created as Hyperscale cannot reverse migrate. |
| **Hyperscale Elastic Pool** | Cannot be created from a non-Hyperscale pool. Cannot be converted to non-Hyperscale (one-way only). Named replicas cannot be added to Hyperscale elastic pools (`UnsupportedReplicationOperation`). Zone-redundant Hyperscale elastic pools require databases with ZRS/GZRS backup storage — cannot add LRS-backed databases. |
| **Failover Group** | Failover group from zone-redundant to non-zone-redundant Hyperscale elastic pool fails silently (geo-secondary shows "Seeding 0%"). |
| **Backup Redundancy** | `GeoZone` only available in select regions. `Local` not available in all regions. |

### SQL Server

| Paired With | Constraint |
|-------------|------------|
| **SQL Database** | Databases are child resources — must reference this server as parent. |
| **Key Vault (TDE)** | Key Vault must have `enablePurgeProtection: true`. Must be in same Azure AD tenant. Server needs GET, WRAP KEY, UNWRAP KEY permissions on key. TDE protector setup fails if Key Vault soft-delete and purge-protection are not both enabled. |
| **Virtual Network** | Use `Microsoft.Sql/servers/virtualNetworkRules` to restrict access to specific subnets. Subnets need `Microsoft.Sql` service endpoint. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. |
| **Elastic Pool** | Databases using elastic pools reference `elasticPoolId` — server must host both pool and databases. Hyperscale elastic pools cannot be created from non-Hyperscale pools. |
| **Failover Group** | Both primary and secondary servers must exist. Databases to be replicated must belong to the primary server. Failover group from zone-redundant to non-zone-redundant Hyperscale elastic pool fails silently (geo-secondary shows "Seeding 0%"). |

### Storage Account

| Paired With | Constraint |
|-------------|------------|
| **Azure Functions** | Must use `StorageV2` or `Storage` kind. `BlobStorage`, `BlockBlobStorage`, `FileStorage` not supported (missing Queue/Table). |
| **Functions (Consumption plan)** | Cannot use network-secured storage (VNet rules). Only Premium/Dedicated plans support VNet-restricted storage. |
| **Functions (zone-redundant)** | Must use ZRS SKU (`Standard_ZRS`). LRS/GRS not sufficient. |
| **VM Boot Diagnostics** | Cannot use Premium storage or ZRS. Use `Standard_LRS` or `Standard_GRS`. Managed boot diagnostics (no storage account required) is also available. |
| **CMK Encryption** | Key Vault must have `softDeleteEnabled: true` AND `enablePurgeProtection: true`. |
| **CMK at creation** | Requires user-assigned managed identity (system-assigned only works for existing accounts). |
| **Geo-redundant failover** | Certain features (SFTP, NFS 3.0, etc.) block GRS/GZRS failover. |

### Synapse Workspace

| Paired With | Constraint |
|-------------|------------|
| **ADLS Gen2 Storage Account** | **Required.** Storage account must have `isHnsEnabled: true` (hierarchical namespace / Data Lake Storage Gen2) and `kind: 'StorageV2'`. Synapse managed identity needs `Storage Blob Data Contributor` role on the storage account. |
| **Key Vault** | For CMK encryption, Key Vault must have `softDeleteEnabled: true` and `enablePurgeProtection: true`. Synapse managed identity needs `Get`, `Unwrap Key`, and `Wrap Key` permissions. |
| **Managed VNet** | When `managedVirtualNetwork: 'default'`, all outbound connections require managed private endpoints. Set at creation time — cannot be changed after. |
| **Private Endpoint** | When `publicNetworkAccess: 'Disabled'`, create private endpoints for sub-resources: `Dev` (Studio), `Sql` (dedicated SQL), `SqlOnDemand` (serverless SQL). |
| **Purview** | Requires Microsoft Purview resource ID. Synapse managed identity needs appropriate Purview roles. |
| **VNet (compute subnet)** | `virtualNetworkProfile.computeSubnetId` must reference an existing subnet. The subnet must be delegated to `Microsoft.Synapse/workspaces` if required by the deployment model. |

## Messaging

### Event Grid

| Paired With | Constraint |
|-------------|------------|
| **Event Subscriptions** | Subscriptions are child resources. Delivery endpoints include: Webhook, Azure Function, Event Hub, Service Bus Queue/Topic, Storage Queue, Hybrid Connection. |
| **Private Endpoint** | Only available with `Premium` SKU. Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. |
| **Managed Identity** | Required for dead-letter destinations and delivery to Azure resources that require authentication (Event Hub, Service Bus, Storage). |
| **Function App** | Use Event Grid trigger binding. Subscription endpoint type is `AzureFunction`. Function must have Event Grid extension registered. |
| **Event Hub** | Subscription endpoint type is `EventHub`. Provide the Event Hub resource ID. Requires managed identity or connection string. |
| **Storage Queue** | Subscription endpoint type is `StorageQueue`. Provide storage account ID and queue name. |
| **Dead Letter** | Dead-letter destination must be a Storage blob container. Requires managed identity or storage key for access. |

### Event Hub

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Standard, Premium, and Dedicated SKUs support VNet service endpoints and private endpoints. |
| **Zone Redundancy** | Available in Standard (with ≥4 TU recommended) and Premium. |
| **Kafka** | Kafka protocol support available in Standard and Premium only (not Basic). |
| **Capture** | Event capture to Storage/Data Lake available in Standard and Premium only. |
| **Consumer Groups** | Basic: 1 consumer group. Standard: 20. Premium: 100. Dedicated: 1,000. |
| **Retention** | Basic: 1 day. Standard: 1–7 days. Premium: up to 90 days. |
| **Function App** | Event Hub trigger uses connection string or managed identity. Set `EventHubConnection` in app settings. |

### Service Bus

| Paired With | Constraint |
|-------------|------------|
| **Topics** | Only Standard and Premium SKUs support topics and subscriptions. Basic supports queues only. |
| **VNet** | Only Premium SKU supports VNet service endpoints and private endpoints. |
| **Zone Redundancy** | Only Premium SKU supports zone redundancy. |
| **Partitioning** | Premium messaging partitions cannot be changed after creation. |
| **Message Size** | Basic/Standard: max 256 KB. Premium: max 100 MB. Plan accordingly for large payloads. |
| **Function App** | Service Bus trigger uses connection string or managed identity. Set `ServiceBusConnection` in app settings. |

## Monitoring

### Application Insights

| Paired With | Constraint |
|-------------|------------|
| **Log Analytics** | Workspace-based App Insights (recommended) requires `WorkspaceResourceId`. Classic (standalone) is being phased out. |
| **Function App** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` or `APPINSIGHTS_INSTRUMENTATIONKEY` in function app settings. |
| **App Service** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` in app settings. Enable auto-instrumentation for supported runtimes. |
| **AKS** | Use Container Insights (different from App Insights) for cluster-level monitoring. App Insights used for application-level telemetry. |
| **Private Link** | Use Azure Monitor Private Link Scope (AMPLS) to restrict ingestion/query to private networks. |
| **Retention** | If workspace-based, retention is governed by the Log Analytics workspace. Component-level retention acts as an override. |

### Log Analytics

| Paired With | Constraint |
|-------------|------------|
| **Application Insights** | App Insights `WorkspaceResourceId` must reference this workspace. Both should be in the same region for optimal performance. |
| **AKS (Container Insights)** | AKS `omsagent` addon references workspace via `logAnalyticsWorkspaceResourceID`. |
| **Diagnostic Settings** | Multiple resources can send diagnostics to the same workspace. Configure via `Microsoft.Insights/diagnosticSettings` on each resource. |
| **Retention** | Free tier is limited to 7-day retention. PerGB2018 supports 30–730 days. Archive tier available for longer retention. |
| **Private Link** | Use Azure Monitor Private Link Scope (AMPLS) for private ingestion/query. A workspace can be linked to up to 100 AMPLS resources (a VNet can connect to only one AMPLS). |

## Networking

### API Management

| Paired With | Constraint |
|-------------|------------|
| **VNet (External)** | Only available with `Developer`, `Premium`, or `Isolated` SKU. Subnet must be dedicated with an NSG allowing APIM management traffic. |
| **VNet (Internal)** | Same as External but no public gateway endpoint. Requires Private DNS or custom DNS for resolution. |
| **Application Gateway** | Common pattern: App Gateway in front of Internal-mode APIM. App Gateway uses the APIM private IP as backend. |
| **Key Vault** | Named values and certificates can reference Key Vault secrets. Requires managed identity with `Key Vault Secrets User` role. |
| **Application Insights** | Set `properties.customProperties` with `Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2` and logger resource for diagnostics. |
| **NSG (VNet mode)** | Subnet NSG must allow: inbound on ports 3443 (management), 80/443 (client); outbound to Azure Storage, SQL, Event Hub, and other dependencies. |

### Application Gateway

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Requires a dedicated subnet — no other resources allowed in the subnet (except other App Gateways). Cannot mix v1 and v2 SKUs on the same subnet — separate subnets required for each. |
| **Public IP** | v2 SKU requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on App Gateway subnet must allow `GatewayManager` service tag on ports `65200–65535` (v2) or `65503–65534` (v1). |
| **WAF** | WAF configuration only available with `WAF_v2` or `WAF_Large`/`WAF_Medium` SKUs. WAF v2 cannot disable request buffering — chunked file transfer requires path-rule workaround. |
| **Zones** | v2 supports availability zones. Specify `zones: ['1','2','3']` for zone-redundant deployment. |
| **Key Vault** | For SSL certificates, use `sslCertificates[].properties.keyVaultSecretId` to reference Key Vault certificates. User-assigned managed identity required. |
| **v1 Limitations** | v1 does not support: autoscaling, zone redundancy, Key Vault integration, mTLS, Private Link, WAF custom rules, or header rewrite. Must use v2 for these features. v1 SKUs are being retired April 2026. |
| **Private-only (no public IP)** | Requires `EnableApplicationGatewayNetworkIsolation` feature registration. Only available with `Standard_v2` or `WAF_v2`. |
| **Global VNet Peering** | Backend via private endpoint across global VNet peering causes traffic to be dropped — results in unhealthy backend status. |
| **kubenet (AKS)** | Kubenet is not supported by Application Gateway for Containers. Must use CNI or CNI Overlay. |

### Azure Bastion

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureBastionSubnet` with minimum /26 prefix. |
| **Developer SKU** | Does NOT require `AzureBastionSubnet` or public IP. Deploys as shared infrastructure. Only connects to VMs in the same VNet. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on `AzureBastionSubnet` requires mandatory inbound (HTTPS 443 from Internet, GatewayManager 443) and outbound rules (see [Bastion NSG docs](https://learn.microsoft.com/azure/bastion/bastion-nsg)). |
| **VMs** | Target VMs must be in the same VNet as Bastion (or peered VNets with Standard/Premium SKU). |

### Azure Firewall

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `AzureFirewallSubnet` with minimum /26 prefix. |
| **Basic Tier** | Additionally requires `AzureFirewallManagementSubnet` with /26 minimum and its own public IP. |
| **Public IP** | Requires Standard SKU public IP with Static allocation. |
| **Firewall Policy** | Cannot use both `firewallPolicy.id` and classic rule collections simultaneously. Policy tier must match or exceed firewall tier. |
| **Zones** | In zone-redundant mode, all associated public IPs must also be zone-redundant (Standard SKU). |
| **Virtual WAN** | `AZFW_Hub` SKU name must reference `virtualHub.id` instead of `ipConfigurations`. |

### DNS Zone

| Paired With | Constraint |
|-------------|------------|
| **Domain Registrar** | NS records from `properties.nameServers` must be configured at your domain registrar to delegate the domain to Azure DNS. |
| **App Service** | Create a CNAME record pointing to `{app-name}.azurewebsites.net` for custom domains. Add a TXT verification record. |
| **Front Door** | Create a CNAME record pointing to the Front Door endpoint. Add a `_dnsauth` TXT record for domain validation. |
| **Application Gateway** | Create an A record pointing to the Application Gateway public IP, or a CNAME to the public IP DNS name. |
| **Traffic Manager** | Create a CNAME record pointing to the Traffic Manager profile `{name}.trafficmanager.net`. |
| **Child Zones** | Delegate subdomains by creating NS records in the parent zone pointing to the child zone's Azure name servers. |

### Front Door

| Paired With | Constraint |
|-------------|------------|
| **Origins (backends)** | Origins are defined in child `originGroups/origins`. Supported origin types: App Service, Storage, Application Gateway, Public IP, custom hostname. |
| **Private Link Origins** | Only available with `Premium_AzureFrontDoor` SKU. Enable private origin connections to App Service, Storage, Internal Load Balancer, etc. |
| **WAF Policy** | WAF policies are separate `Microsoft.Network/FrontDoorWebApplicationFirewallPolicies` resources. Linked via security policy child resource on the profile. |
| **Custom Domains** | Custom domains are child resources of the profile. Require DNS CNAME/TXT validation and certificate (managed or custom). |
| **Application Gateway** | Front Door in front of App Gateway: use App Gateway public IP as origin. Set `X-Azure-FDID` header restriction on App Gateway to accept only Front Door traffic. |
| **App Service** | Restrict App Service to Front Door traffic using access restrictions with `AzureFrontDoor.Backend` service tag and `X-Azure-FDID` header check. |

### Load Balancer

| Paired With | Constraint |
|-------------|------------|
| **Public IP** | Public IP SKU must match LB SKU. Basic LB requires Basic public IP; Standard LB requires Standard public IP. No cross-SKU mixing. |
| **Standard SKU** | Backend pool VMs must be in the same VNet. No VMs from different VNets. Standard LB blocks outbound traffic by default — requires explicit outbound rules, NAT gateway, or instance-level public IPs. Standard LB requires an NSG (secure by default; inbound traffic blocked without NSG). |
| **Basic SKU** | Backend pool VMs must be in the same availability set or VMSS. |
| **Availability Zones** | Standard SKU is zone-redundant by default. Frontend IPs inherit zone from public IP. |
| **VMs / VMSS** | VMs in backend pool cannot have both Basic and Standard LBs simultaneously. |
| **Outbound Rules** | Only Standard SKU supports outbound rules. Basic SKU has implicit outbound. |

### NAT Gateway

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | NAT Gateway is associated on the subnet side: set `subnet.properties.natGateway.id` to the NAT Gateway resource ID. A subnet can have at most one NAT Gateway. |
| **Public IP** | Public IP must use `Standard` SKU and `Static` allocation. Public IP and NAT Gateway must be in the same region. |
| **Public IP Prefix** | Public IP prefix must use `Standard` SKU. Provides contiguous outbound IPs. |
| **Availability Zones** | NAT Gateway can be zonal (pinned to one zone) or non-zonal. Public IPs must match the same zone or be zone-redundant. |
| **Load Balancer** | NAT Gateway takes precedence over outbound rules of a Standard Load Balancer when both are on the same subnet. |
| **VPN Gateway / ExpressRoute** | `GatewaySubnet` does not support NAT Gateway association. |
| **Azure Firewall** | NAT Gateway can be associated with the `AzureFirewallSubnet` for deterministic outbound IPs in SNAT scenarios. |

### Network Interface

| Paired With | Constraint |
|-------------|------------|
| **Virtual Machine** | Each VM requires at least one NIC. NIC must be in the same region and subscription as the VM. |
| **Subnet** | NIC must reference a subnet. The subnet determines the VNet, NSG, and route table that apply. |
| **NSG** | NSG can be associated at the NIC level or at the subnet level (or both). NIC-level NSG is evaluated after subnet-level NSG. |
| **Public IP** | Public IP and NIC must be in the same region. When associated with a Load Balancer, Public IP SKU must match the LB SKU (Basic with Basic, Standard with Standard). |
| **Load Balancer** | NIC IP configuration can reference `loadBalancerBackendAddressPools` and `loadBalancerInboundNatRules`. Load balancer and NIC must be in the same VNet. |
| **Accelerated Networking** | Not all VM sizes support accelerated networking. Must verify VM size compatibility. |
| **VM Scale Set** | NICs for VMSS instances are managed by the scale set — do not create standalone NICs for VMSS. |
| **Application Gateway** | NIC IP configuration can reference `applicationGatewayBackendAddressPools`. |

### NSG

| Paired With | Constraint |
|-------------|------------|
| **GatewaySubnet** | NSGs are not supported on `GatewaySubnet`. Associating an NSG may cause VPN and ExpressRoute gateways to stop functioning. |
| **AzureBastionSubnet** | NSG on Bastion subnet requires specific inbound/outbound rules (see [Azure Bastion NSG](https://learn.microsoft.com/azure/bastion/bastion-nsg)). |
| **Application Gateway** | NSG on App Gateway subnet must allow `GatewayManager` service tag on ports `65200–65535` (v2) and health probe traffic. |
| **Load Balancer** | Must allow `AzureLoadBalancer` service tag for health probes. Standard LB requires NSG — it is secure by default and blocks inbound traffic without an NSG. |
| **Virtual Network** | NSG is associated to subnets, not directly to VNets. Each subnet can have at most one NSG. |

### Private DNS Zone

| Paired With | Constraint |
|-------------|------------|
| **Virtual Network** | Must create a `virtualNetworkLinks` child resource to link the DNS zone to each VNet that needs resolution. |
| **Private Endpoint** | Use a `privateDnsZoneGroups` child on the Private Endpoint to auto-register A records, or manually create A record sets. One DNS record per DNS name — multiple private endpoints in different regions need separate Private DNS Zones. |
| **VNet Link (auto-registration)** | Only one Private DNS Zone with `registrationEnabled: true` can be linked per VNet. Auto-registration creates DNS records for VMs in the VNet. |
| **Hub-Spoke VNet** | Link the Private DNS Zone to the hub VNet. Spoke VNets resolve via hub DNS forwarder or VNet link. |
| **PostgreSQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.postgres.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.postgres.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneArmResourceId`. |
| **MySQL Flexible Server** | For Private Endpoint access, zone name is `privatelink.mysql.database.azure.com`. For VNet-integrated (private access) servers, the zone name is `{name}.mysql.database.azure.com` (not `privatelink.*`). Referenced via `properties.network.privateDnsZoneResourceId`. |

### Private Endpoint

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | The subnet must not have NSG rules that block private endpoint traffic. Subnet must have `privateEndpointNetworkPolicies` set to `Disabled` (default) for network policies to be bypassed. |
| **Private DNS Zone** | Create a `Microsoft.Network/privateDnsZones/virtualNetworkLinks` to link the DNS zone to the VNet. Create an A record or use a private DNS zone group to auto-register DNS. |
| **Private DNS Zone Group** | Use `privateEndpoint/privateDnsZoneGroups` child resource to auto-register DNS records in the Private DNS Zone. |
| **Key Vault** | Group ID: `vault`. DNS zone: `privatelink.vaultcore.azure.net`. |
| **Storage Account** | Group IDs: `blob`, `file`, `queue`, `table`, `web`, `dfs`. Each requires its own PE and DNS zone. |
| **SQL Server** | Group ID: `sqlServer`. DNS zone: `privatelink.database.windows.net`. |
| **Container Registry** | Group ID: `registry`. DNS zone: `privatelink.azurecr.io`. |

### Public IP

| Paired With | Constraint |
|-------------|------------|
| **Standard SKU** | Must use `Static` allocation method. `Dynamic` only works with Basic SKU. |
| **Load Balancer** | Public IP SKU must match Load Balancer SKU (Standard ↔ Standard, Basic ↔ Basic). |
| **Application Gateway** | Standard_v2 App Gateway requires Standard SKU public IP with Static allocation. |
| **Azure Bastion** | Requires Standard SKU with Static allocation. |
| **VPN Gateway** | Basic VPN Gateway SKU requires Basic public IP. Standard+ gateway SKUs require Standard public IP. |
| **Azure Firewall** | Requires Standard SKU with Static allocation. |
| **Zones** | Standard SKU is zone-redundant by default. Specify `zones` only to pin to specific zone(s). |

### Route Table

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Route table is associated on the subnet side: set `subnet.properties.routeTable.id` to the route table resource ID. Each subnet can have at most one route table. |
| **Azure Firewall** | For forced tunneling, create a default route (`0.0.0.0/0`) with `nextHopType: 'VirtualAppliance'` pointing to the firewall private IP. |
| **VPN Gateway** | Set `disableBgpRoutePropagation: true` to prevent BGP routes from overriding UDRs on the subnet. |
| **GatewaySubnet** | UDRs on `GatewaySubnet` have restrictions — cannot use `0.0.0.0/0` route pointing to a virtual appliance. |
| **AKS** | AKS subnets with UDRs require careful route design. Must allow traffic to Azure management APIs. `kubenet` and `Azure CNI` have different routing requirements. |
| **Virtual Appliance** | `nextHopIpAddress` must be a reachable private IP in the same VNet or a peered VNet. The appliance NIC must have `enableIPForwarding: true`. |

### Subnet

| Paired With | Constraint |
|-------------|------------|
| **NSG** | Cannot attach NSG to `GatewaySubnet` — NSGs are not supported for either VPN or ExpressRoute gateways. NSG on `AzureBastionSubnet` requires specific required rules. |
| **Delegations** | A subnet can only be delegated to one service. Delegated subnets cannot host other resource types. |
| **Service Endpoints** | Must match the service being accessed (e.g., `Microsoft.Sql` for SQL Server VNet rules). |
| **Private Endpoints** | Set `privateEndpointNetworkPolicies: 'Enabled'` to apply NSG/route table to private endpoints (default is `Disabled`). |
| **AKS** | AKS subnet needs enough IPs for all nodes + pods. Cannot be delegated or have conflicting service endpoints. |
| **Application Gateway** | Dedicated subnet required — cannot coexist with other resources except other App Gateways. Cannot mix v1 and v2 App Gateway SKUs on the same subnet. |
| **Azure Firewall** | Subnet must be named `AzureFirewallSubnet`, minimum /26. Cannot have other resources. |
| **App Service VNet Integration** | Subnet must be delegated to `Microsoft.Web/serverFarms`. Minimum size /28 (or /26 for multi-plan subnet join). This subnet must be different from any subnet used for App Service Private Endpoints. |
| **GatewaySubnet UDR** | Do not apply UDR with `0.0.0.0/0` next hop on `GatewaySubnet`. ExpressRoute gateways require management controller access. BGP route propagation must remain enabled on `GatewaySubnet`. |

### Virtual Network

| Paired With | Constraint |
|-------------|------------|
| **Subnets** | Address prefixes of all subnets must fall within the VNet address space. Subnet CIDRs cannot overlap. |
| **VNet Peering** | Peered VNets cannot have overlapping address spaces. |
| **Azure Firewall** | Requires a subnet named exactly `AzureFirewallSubnet` with minimum /26 prefix. |
| **Azure Bastion** | Requires a subnet named exactly `AzureBastionSubnet` with minimum /26 prefix (recommended /26). |
| **VPN Gateway** | Requires a subnet named exactly `GatewaySubnet` with minimum /27 prefix (recommended /27). |
| **Application Gateway** | Requires a dedicated subnet (no mandatory name, but must not contain other resource types). |
| **AKS** | AKS subnet must have enough IP addresses for nodes + pods. With Azure CNI, each node reserves IPs for max pods. |

### VPN Gateway

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Requires a subnet named exactly `GatewaySubnet` with minimum /27 prefix. Use /26+ for 16 ExpressRoute circuits or for ExpressRoute/VPN coexistence. |
| **Public IP** | Basic VPN SKU requires Basic public IP. VpnGw1+ requires Standard public IP. |
| **Active-Active** | Requires 2 public IPs and 2 IP configurations. Only supported with VpnGw1+. |
| **Zone-Redundant** | Must use `AZ` SKU variant (e.g., `VpnGw1AZ`). Requires Standard SKU public IPs. AZ SKU cannot be downgraded to non-AZ (one-way migration only). |
| **ExpressRoute** | Can coexist with VPN gateway on the same `GatewaySubnet` (requires /27 or larger). Not supported with Basic SKU. Route-based VPN required. |
| **PolicyBased** | Limited to 1 S2S tunnel, no P2S, no VNet-to-VNet. Use `RouteBased` for most scenarios. |
| **Basic SKU** | Basic VPN Gateway does not support BGP, IPv6, RADIUS authentication, IKEv2 P2S, or ExpressRoute coexistence. Max 10 S2S tunnels. |
| **GatewaySubnet UDR** | Do not apply UDR with `0.0.0.0/0` next hop on GatewaySubnet. ExpressRoute gateways require management controller access — this route breaks it. |
| **GatewaySubnet BGP** | BGP route propagation must remain enabled on GatewaySubnet. Disabling causes the gateway to become non-functional. |
| **DNS Private Resolver** | DNS Private Resolver in a VNet with an ExpressRoute gateway and wildcard forwarding rules can cause management connectivity problems. |

## Security

### Key Vault

| Paired With | Constraint |
|-------------|------------|
| **Storage Account (CMK)** | Must have `enableSoftDelete: true` AND `enablePurgeProtection: true`. |
| **Storage Account (CMK at creation)** | Storage must use user-assigned managed identity — system-assigned only works for existing accounts. |
| **SQL Server (TDE)** | Must enable `enablePurgeProtection`. Key Vault and SQL Server must be in the same Azure AD tenant. |
| **AKS (secrets)** | Use `enableRbacAuthorization: true` with Azure RBAC for secrets access. AKS needs `azureKeyvaultSecretsProvider` addon. |
| **Disk Encryption** | Must set `enabledForDiskEncryption: true`. Premium SKU required for HSM-protected keys. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` and `networkAcls.defaultAction: 'Deny'` when using private endpoints. |
| **CMK Firewall** | When any Azure service uses CMK from Key Vault, the Key Vault firewall must enable "Allow trusted Microsoft services to bypass this firewall" — unless using private endpoints to Key Vault. |
| **CMK Key Type** | Key must be RSA or RSA-HSM, 2048/3072/4096-bit. Other key types are not supported for customer-managed keys. |
| **CMK Cross-Tenant** | Key Vault and consuming service must be in the same Azure AD tenant. Cross-tenant CMK requires separate configuration. |

### Managed Identity

| Paired With | Constraint |
|-------------|------------|
| **Any Resource (identity assignment)** | Reference the identity resource ID in the resource's `identity.userAssignedIdentities` object as `{ '${managedIdentity.id}': {} }`. |
| **Key Vault (CMK)** | Storage accounts using CMK at creation require a user-assigned identity — system-assigned only works for existing accounts. |
| **Container Registry (ACR pull)** | Assign `AcrPull` role to the identity's `principalId`. Reference the identity in the pulling resource (AKS, Container App, etc.). |
| **AKS (workload identity)** | Create a federated identity credential on the managed identity. Map it to a Kubernetes service account via OIDC issuer. |
| **Role Assignments** | Use `properties.principalId` with `principalType: 'ServicePrincipal'` in `Microsoft.Authorization/roleAssignments`. |
| **Function App / App Service** | Set `identity.type` to `'UserAssigned'` and reference the identity resource ID. Use for Key Vault references, storage access, etc. |
