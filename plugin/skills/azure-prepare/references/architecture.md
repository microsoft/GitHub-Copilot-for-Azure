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

### Container Hosting: Container Apps vs AKS

| Factor | Container Apps | AKS |
|--------|:--------------:|:---:|
| **Scale to zero** | ✓✓ | |
| **Kubernetes API access** | | ✓✓ |
| **Custom operators/CRDs** | | ✓✓ |
| **Service mesh** | Dapr (built-in) | Istio, Cilium |
| **GPU workloads** | | ✓✓ |
| **Best for** | Microservices, event-driven | Full K8s control, complex workloads |

#### When to Use Container Apps
- Microservices without Kubernetes complexity
- Event-driven workloads (KEDA built-in)
- Need scale-to-zero for cost optimization
- Teams without Kubernetes expertise

#### When to Use AKS
- Need Kubernetes API/kubectl access
- Require custom operators or CRDs
- Service mesh requirements (Istio, Linkerd)
- GPU/ML workloads
- Complex networking or multi-tenant architectures

> **AKS Planning:** For AKS SKU selection (Automatic vs Standard), networking, identity, scaling, and security configuration, invoke the **azure-kubernetes** skill.

## Service Mapping

### Hosting

| Component Type | Primary Service | Alternatives |
|----------------|-----------------|--------------|
| SPA Frontend | Static Web Apps | Blob + CDN |
| SSR Web App | Container Apps | App Service, AKS |
| REST/GraphQL API | Container Apps | App Service, Functions, AKS |
| Background Worker | Container Apps | Functions, AKS |
| Scheduled Task | Functions (Timer) | Container Apps Jobs, AKS CronJob |
| Event Processor | Functions | Container Apps, AKS + KEDA |
| Microservices (full K8s) | AKS | Container Apps |
| GPU/ML Workloads | AKS | Azure ML |

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

---

## Document Architecture

Record selections in `.azure/plan.md` with rationale for each choice.
