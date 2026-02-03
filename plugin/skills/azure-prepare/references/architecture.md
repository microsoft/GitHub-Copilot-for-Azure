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
| Workflow | Logic Apps, Durable Functions |

### Supporting (Always Include)

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring, APM |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth |

---

## Location Selection

> **⛔ BLOCKING REQUIREMENT — DO NOT SKIP**
>
> After determining the Azure services needed, you **MUST** consult [region-availability.md](region-availability.md) and use `ask_user` to prompt the user for location/region. Only present regions that support ALL selected services.

### Steps

1. **Identify all Azure services** from the architecture (e.g., Static Web Apps, Container Apps, Cosmos DB)
2. **Consult [region-availability.md](region-availability.md)** to find regions that support ALL selected services
   - This is the authoritative source — do NOT guess or use outdated knowledge
   - Pay special attention to services with limited availability (SWA, Azure OpenAI)
3. **Find intersection** of regions that support ALL required services
4. **Check for existing azd configuration**: Run `azd env get-values 2>$null | Select-String "AZURE_LOCATION"` to check if a location is already configured
5. **Use `ask_user`** to present ONLY valid regions:
   - If azd env has a location configured AND it's valid for all services, show it as the default
   - Question: "Which Azure region do you want to deploy to? Based on your architecture ({list services}), these regions support all required services:"
   - Choices: List ONLY valid regions with one marked "(Recommended)"
   - ⚠️ Do NOT include regions that don't support all services — this will cause deployment failures

### Region Availability Quick Reference

> **IMPORTANT:** Always consult [region-availability.md](region-availability.md) for the authoritative matrix.

| Service | Notes |
|---------|-------|
| Static Web Apps | Only 5 regions — check before recommending |
| Azure OpenAI | Limited — varies by model |
| Container Apps | Most regions |
| Cosmos DB | Most regions |

### Example Prompt

If architecture includes Static Web Apps + Azure SQL:
```
"Which Azure region do you want to deploy to?

Based on your architecture (Static Web Apps, Azure SQL), these regions support all services:
[Present regions from region-availability.md that support ALL selected services]
```

> ⚠️ Consult [region-availability.md](region-availability.md) for valid regions per service.

---

## Document Architecture

Record selections in manifest with rationale for each choice, including:
- Selected services and why
- Chosen location and why (service availability, compliance, latency)
