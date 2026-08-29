# Azure Container Apps

Serverless container hosting for microservices, APIs, and background workers.

## When to Use

- Microservices and APIs
- Background processing workers
- Event-driven applications
- Web applications (server-rendered)
- Any containerized workload that doesn't need full Kubernetes

## Service Type in azure.yaml

```yaml
services:
  my-api:
    host: containerapp
    project: ./src/my-api
    docker:
      path: ./Dockerfile
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Container Apps Environment | Hosting environment |
| Container Registry | Image storage |
| Log Analytics Workspace | Logging |
| Application Insights | Monitoring |

## Common Configurations

| Workload Type | Ingress | Min Replicas | Scaling |
|---------------|---------|--------------|---------|
| API Service | External | 1 (avoid cold starts) | HTTP-based |
| Background Worker | None | 0 (scale to zero) | Queue-based |
| Web Application | External | 1 | HTTP-based |

## Templates & Recipes

> ⚠️ **Before generating IaC**, load [templates/selection.md](templates/selection.md) for the base
> template decision tree, then follow [templates/recipes/composition.md](templates/recipes/composition.md)
> to compose the base template with any required recipes. Never hand-write Container Apps IaC from scratch.

| Base Template | Use Case |
|---------------|----------|
| [web-app](templates/web-app.md) | High-scale serverless web application |
| [api](templates/api.md) | REST/gRPC API service |
| [microservice](templates/microservice.md) | Multi-service app with Dapr service discovery |
| [worker](templates/worker.md) | Background/queue-driven worker |
| [job](templates/job.md) | Scheduled/event/manual-trigger Container Apps Job |
| [functions-on-aca](templates/functions-on-aca.md) | Azure Functions hosted on Container Apps |

| Recipe | Adds |
|--------|------|
| [dapr](templates/recipes/dapr/README.md) | Service invocation, pub/sub, state, secrets |
| [cosmos](templates/recipes/cosmos/README.md) | Cosmos DB NoSQL |
| [servicebus](templates/recipes/servicebus/README.md) | Service Bus messaging + KEDA scaling |
| [redis](templates/recipes/redis/README.md) | Redis cache / state store |
| [acr](templates/recipes/acr/README.md) | Container Registry build/push |
| [postgres](templates/recipes/postgres/README.md) | PostgreSQL Flexible Server |

## References

- [Bicep Patterns](bicep.md)
- [Terraform Patterns](terraform.md)
- [Scaling Patterns](scaling.md)
- [Health Probes](health-probes.md)
- [Environment Variables](environment.md)
- [Day-2 Operations](day2-operations.md)
- [Networking & Ingress](networking.md)
- [Revisions & Traffic Splitting](revisions.md)
