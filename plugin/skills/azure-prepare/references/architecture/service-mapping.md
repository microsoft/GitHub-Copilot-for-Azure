# Service Mapping

Map application components to Azure services.

## TASK

Assign each identified component to the appropriate Azure hosting and supporting services.

## Component Type Mapping

### Hosting Services

| Component Type | Primary Service | Alternatives |
|----------------|-----------------|--------------|
| **Web Frontend (SPA)** | Static Web Apps | Blob Storage + CDN |
| **Web Frontend (SSR)** | Container Apps | App Service |
| **REST API** | Container Apps | App Service, Functions |
| **GraphQL API** | Container Apps | App Service |
| **Background Worker** | Container Apps | Functions, WebJobs |
| **Scheduled Task** | Functions (Timer) | Container Apps Jobs |
| **Event Processor** | Functions | Container Apps |
| **Microservice** | Container Apps | AKS |

### Data Services

| Data Need | Primary Service | Alternatives |
|-----------|-----------------|--------------|
| **Relational Data** | Azure SQL | PostgreSQL, MySQL |
| **Document Store** | Cosmos DB | MongoDB (Atlas) |
| **Key-Value Cache** | Redis Cache | Cosmos DB |
| **File Storage** | Blob Storage | Files Storage |
| **Search** | Azure AI Search | Cosmos DB |

### Integration Services

| Integration Need | Primary Service | Alternatives |
|------------------|-----------------|--------------|
| **Message Queue** | Service Bus | Storage Queues |
| **Pub/Sub Events** | Event Grid | Service Bus Topics |
| **Stream Processing** | Event Hubs | Service Bus |
| **Workflow Orchestration** | Logic Apps | Durable Functions |

### Supporting Services

| Need | Service |
|------|---------|
| **Logging** | Log Analytics Workspace |
| **Monitoring** | Application Insights |
| **Secrets** | Key Vault |
| **Configuration** | App Configuration |
| **Identity** | Managed Identity |

## Mapping Process

### Step 1: List Components

From discovery, list all deployable components:

```markdown
| Component | Type | Technology |
|-----------|------|------------|
| user-api | API | Node.js/Express |
| web-app | SPA | React |
| order-worker | Worker | Python |
```

### Step 2: Assign Hosting

For each component, select hosting service:

```markdown
| Component | Azure Service | Rationale |
|-----------|---------------|-----------|
| user-api | Container Apps | REST API, containers stack |
| web-app | Static Web Apps | React SPA, no server-side |
| order-worker | Container Apps | Long-running worker |
```

### Step 3: Identify Dependencies

Document what each component needs:

```markdown
| Component | Needs | Azure Service |
|-----------|-------|---------------|
| user-api | Database | PostgreSQL Flexible Server |
| user-api | Cache | Redis Cache |
| order-worker | Queue | Service Bus |
```

### Step 4: Add Supporting Services

Add baseline services all components need:

```markdown
| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | APM and monitoring |
| Key Vault | Secrets management |
| Container Registry | Image storage (if containers) |
```

## Document Mapping

Record in Preparation Manifest:

```markdown
## Azure Service Mapping

### Hosting

| Component | Service | SKU | Notes |
|-----------|---------|-----|-------|
| user-api | Container Apps | Consumption | Auto-scaling enabled |
| web-app | Static Web Apps | Free | CDN included |
| order-worker | Container Apps | Consumption | Min 1 replica |

### Data

| Service | SKU | Purpose |
|---------|-----|---------|
| PostgreSQL Flexible | Burstable B1ms | User data |
| Redis Cache | Basic C0 | Session cache |
| Service Bus | Standard | Order queue |

### Supporting

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logs |
| Application Insights | Monitoring |
| Key Vault | Secrets |
| Container Registry | Docker images |
```

## Service-Specific Details

For detailed patterns per service, see:
- [container-apps.md](../services/container-apps.md)
- [app-service.md](../services/app-service.md)
- [functions.md](../services/functions.md)
- [static-web-apps.md](../services/static-web-apps.md)
