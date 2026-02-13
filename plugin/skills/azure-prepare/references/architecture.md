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
| SSR Web App | Container Apps | App Service |
| REST/GraphQL API | Container Apps | App Service, Functions |
| Background Worker | Container Apps | Functions |
| Scheduled Task | Functions (Timer) | Container Apps Jobs |
| Event Processor | Functions | Container Apps |

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
| Workflow | Logic Apps, Durable Functions, Durable Task Scheduler |

### Supporting (Always Include)

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring, APM |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth |

---

## Document Architecture

Record selections in `.azure/plan.md` with rationale for each choice.

## Service References

Consult these guides when the architecture includes these services:

| Service | Reference |
|---------|-----------|
| AKS | [services/aks.md](services/aks.md) |
| App Service | [services/app-service.md](services/app-service.md) |
| Container Apps | [services/container-apps.md](services/container-apps.md) |
| Cosmos DB | [services/cosmos-db.md](services/cosmos-db.md) |
| Durable Task Scheduler | [services/durable-task-scheduler.md](services/durable-task-scheduler.md) |
| Event Grid | [services/event-grid.md](services/event-grid.md) |
| Functions | [services/functions.md](services/functions.md) |
| Key Vault | [services/key-vault.md](services/key-vault.md) |
| Logic Apps | [services/logic-apps.md](services/logic-apps.md) |
| Service Bus | [services/service-bus.md](services/service-bus.md) |
| SQL Database | [services/sql-database.md](services/sql-database.md) |
| Static Web Apps | [services/static-web-apps.md](services/static-web-apps.md) |
| Storage | [services/storage.md](services/storage.md) |
