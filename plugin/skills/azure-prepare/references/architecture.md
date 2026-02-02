# Architecture Planning

Select hosting stack and map components to Azure services.

## Stack Selection

| Stack | Best For | Azure Services |
|-------|----------|----------------|
| **Containers** | Docker experience, complex dependencies, microservices | Container Apps, AKS, ACR |
| **Serverless** | Event-driven, variable traffic, cost optimization | Functions, Logic Apps, Event Grid |
| **App Service** | Traditional web apps, PaaS preference | App Service, Static Web Apps |

### Decision Factors

| Factor | Containers | Serverless | App Service |
|--------|:----------:|:----------:|:-----------:|
| Docker experience | ✓✓ | | |
| Event-driven | ✓ | ✓✓ | |
| Variable traffic | | ✓✓ | ✓ |
| Complex dependencies | ✓✓ | | ✓ |
| Long-running processes | ✓✓ | | ✓ |
| Minimal ops overhead | | ✓✓ | ✓ |

## Service Mapping

### Hosting

| Component Type | Primary Service | Alternatives |
|----------------|-----------------|--------------|
| SPA Frontend | Static Web Apps | Blob + CDN |
| Pure Static Site | Static Web Apps | Blob + CDN |
| SSR Web App | Container Apps | App Service |
| REST/GraphQL API | Container Apps | App Service, Functions |
| Background Worker | Container Apps | Functions |
| Scheduled Task | Functions (Timer) | Container Apps Jobs |
| Event Processor | Functions | Container Apps |

**Note:** Static Web Apps is a non-regional service - static content is globally distributed via CDN. The region parameter only affects where the integrated API backend (Azure Functions) is deployed. If you encounter provisioning issues, try an alternative region for the API backend.

### Data

| Need | Primary | Alternatives |
|------|---------|--------------|
| Relational | Azure SQL | PostgreSQL, MySQL |
| Document | Cosmos DB | MongoDB |
| Cache | Redis Cache | |
| Files | Blob Storage | Files Storage |
| Search | AI Search | |

### Integration

| Need | Service |
|------|---------|
| Message Queue | Service Bus |
| Pub/Sub | Event Grid |
| Streaming | Event Hubs |
| Workflow | Logic Apps, Durable Functions |

### Supporting (Always Include)

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring, APM |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth |

## Document Architecture

Record selections in manifest with rationale for each choice.
