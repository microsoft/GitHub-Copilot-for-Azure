# Template Selection Decision Tree — REFERENCE ONLY

**CRITICAL**: Check indicators IN ORDER before defaulting to web app.

**Architecture**: All deployments start from an appropriate base template for the workload (e.g., [web-app.md](web-app.md), [api.md](api.md), [worker.md](worker.md)).
Integrations are applied as [composable recipes](recipes/README.md) on top of the base.
See [composition.md](recipes/composition.md) for the merge algorithm.

Container Apps hosts **any** containerised app — any language, any framework, any SDK.
Event-driven processing with triggers/bindings uses [Functions on Container Apps](functions-on-aca.md).

```
1. Is this event-driven with Functions triggers/bindings?
   Indicators: BlobTrigger, ServiceBusTrigger, EventHubTrigger,
               TimerTrigger, CosmosDBTrigger, DurableOrchestration,
               host.json, @app.service_bus_queue, @app.schedule
   └─► YES → Functions on Container Apps (see functions-on-aca.md)

2. Is this a Container Apps Job (not a long-running service)?
   Indicators: scheduled task, cron job, one-shot batch,
               event-triggered processing, manual job
   └─► YES → Job template (see job.md)

3. Is this a microservices architecture?
   Indicators: multiple services, service discovery, Dapr,
               docker-compose with 3+ services, mono-repo with services/
   └─► YES → Microservice template (see microservice.md)

4. Is this a background worker / queue processor?
   Indicators: queue consumer, long-running task, KEDA scaling on queue depth,
               no HTTP ingress needed, worker process
   └─► YES → Worker template (see worker.md)

5. Is this a REST or gRPC API?
   Indicators: REST API, OpenAPI/Swagger, gRPC, API gateway,
               /api/ routes, Express/FastAPI/ASP.NET controllers
   └─► YES → API template (see api.md)

6. Does it use Dapr?
   Indicators: dapr.io/enabled annotation, Dapr SDK imports,
               state store, pub/sub, service invocation
   └─► YES → Use appropriate base + dapr recipe (recipes/dapr/)

7. Does it need a database?
   Indicators: Cosmos DB, PostgreSQL, Redis, SQL
   └─► YES → Use appropriate base + database recipe

8. Does it use messaging?
   Indicators: Service Bus, Event Hubs, Storage Queues
   └─► YES → Use appropriate base + messaging recipe

9. DEFAULT → Web app template (see web-app.md)
```

## Recipe Index

| Integration | Recipe | Description |
|-------------|--------|-------------|
| Dapr | [recipes/dapr/](recipes/dapr/README.md) | Service invocation, state, pub/sub |
| Cosmos DB | [recipes/cosmos/](recipes/cosmos/README.md) | NoSQL database |
| Service Bus | [recipes/servicebus/](recipes/servicebus/README.md) | Messaging with KEDA scaling |
| Redis | [recipes/redis/](recipes/redis/README.md) | Cache / state store |
| ACR | [recipes/acr/](recipes/acr/README.md) | Container registry build + push |
| PostgreSQL | [recipes/postgres/](recipes/postgres/README.md) | PostgreSQL Flexible Server |

## Base Templates

| Template | Use Case | File |
|----------|----------|------|
| Web app | General-purpose serverless web app | [web-app.md](web-app.md) |
| API | REST / gRPC API services | [api.md](api.md) |
| Microservice | Multi-service architecture | [microservice.md](microservice.md) |
| Worker | Background processing | [worker.md](worker.md) |
| Job | Scheduled / event / manual jobs | [job.md](job.md) |
| Functions on ACA | Event-driven triggers/bindings | [functions-on-aca.md](functions-on-aca.md) |

## Critical Rules

1. **Container Apps is stack-agnostic** — any language, any framework, any container image
2. **Use UAMI (User Assigned Managed Identity)** for all service connections — never connection strings
3. **Always use `--no-prompt`** with azd commands
4. **Never synthesize Bicep/Terraform from scratch** — use AZD templates or proven modules
5. **Use KEDA scaling rules** for event-driven workloads (queue depth, HTTP concurrency, cron)
6. **Disable local auth** on all backing services (Cosmos, Service Bus, etc.)
