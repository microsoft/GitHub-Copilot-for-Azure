# Service Mapping Tables

Component→Azure service selection. Apply `context.json.intent` as modifiers, `context.json.overrides[]` as hard constraints, and policy constraints as filters.

## Hosting

> ⛔ **Implicit dependencies:** When selecting Container Apps and the component has a Dockerfile (or `hasDockerfile: true` in prereq), **ALWAYS include Container Registry (Basic)** in `services[]`. Container Apps requires ACR to host custom images — omitting it forces an imperative add during deploy, wasting a healing round. ACR Basic is $0.17/day (~$5/mo).

| Component Type | Primary Service | Alternatives | Selection Signal |
|---------------|----------------|-------------|-----------------|
| SPA Frontend | Static Web Apps | Blob + CDN | React/Vue/Angular, no SSR |
| SSR Web App | Container Apps | App Service, AKS | Next.js/Nuxt, server-rendered |
| REST/GraphQL API | Container Apps | App Service, Functions, AKS | Express/Fastify/Flask/FastAPI |
| Background Worker | Container Apps (scale-to-zero) | Functions, AKS | Celery/Bull/Agenda, no HTTP |
| Scheduled Task | Functions (Timer) | Container Apps Jobs | Cron patterns, periodic execution |
| Event Processor | Functions | Container Apps + KEDA | Event-driven, queue/topic consumer |
| Microservices (K8s) | AKS | Container Apps | kubectl/helm in repo, CRDs, service mesh |
| GPU/ML Workloads | AKS | Azure ML | GPU requirements, training workloads |

**Stack shortcuts:** Containers (Docker, microservices) → Container Apps or AKS. Serverless (event-driven, variable traffic) → Functions. Traditional web (PaaS preference) → App Service.

**AKS vs Container Apps:** Use Container Apps when scale-to-zero needed, no K8s expertise, or KEDA-driven event processing. Delegate AKS planning to `azure-kubernetes` skill.

**App Service vs Container Apps:** App Service preferred for simple web apps (F1 $0 / B1 ~$13/mo), single process, no container orchestration. Container Apps preferred when Dockerfile present + scale-to-zero needed, multi-container/sidecar, or event-driven KEDA scaling. Container Apps has no free tier (consumption billing).

**Static Dockerfile sites (nginx/httpd serving HTML):**
- **Primary:** Static Web Apps Free — $0, global CDN.
  > ⛔ **SWA region availability:** Validate via `az provider show --namespace Microsoft.Web --query "resourceTypes[?resourceType=='staticSites'].locations" -o tsv`.
- **Alternative:** App Service F1 (Free) — ⛔ F1 does NOT run Docker. Use Windows F1 (IIS serves `index.html` natively) or Linux F1 (`linuxFxVersion: 'STATICSITE|1.0'`). ⛔ Do NOT use `NODE|*`/`PHP|*`/`PYTHON|*` for static sites — causes 504/503 cold start.
- **If Docker required:** Container Apps (scale-to-zero) or App Service B1+ (custom containers).

**Plain HTML (no package manager, no Dockerfile):** Windows App Service F1 preferred (IIS serves natively). Linux: `linuxFxVersion: 'STATICSITE|1.0'`. Or Static Web Apps Free.

## Data

| Need | Primary Service | Alternatives | Selection Signal |
|------|----------------|-------------|-----------------|
| Relational | Azure SQL | PostgreSQL Flexible, MySQL Flexible | SQL schema, transactions, joins |
| Document/NoSQL | Cosmos DB | — | JSON docs, global distribution |
| Graph (Gremlin) | Cosmos DB (Gremlin API) | — | Graph traversal, relationships |

> **Cosmos DB Serverless:** Each Serverless account supports ONE API type (SQL, MongoDB, Gremlin, Table, Cassandra). Multi-API apps require separate Serverless accounts.

| Cache | Redis Cache | — | Session store, rate limiting |
| Files/Blobs | Blob Storage | Files Storage | File uploads, static assets |
| Search | AI Search | — | Full-text search requirements |
| MariaDB/MySQL | MySQL Flexible Server | — | `mariadb:*` or `mysql:*` in compose / connection config |
| Elasticsearch/OpenSearch | AI Search | Azure Monitor (for Kibana) | `elasticsearch:*` or `opensearch:*` in compose |
| S3-compatible / MinIO | Blob Storage | — | `minio/*` in compose, S3 SDK usage |

## Integration

| Need | Primary Service | Selection Signal |
|------|----------------|-----------------|
| Message Queue | Service Bus | Point-to-point, ordered, transactions |
| Pub/Sub | Event Grid | Event routing, fan-out |
| Streaming / Kafka | Event Hubs | High-throughput telemetry, logs. **Kafka protocol compatible** — apps using `kafka-clients`, Spring Kafka, `confluent-kafka-python` connect by changing bootstrap URL + SASL config only |
| Multi-step orchestration | Durable Functions + Durable Task Scheduler | DTS is the recommended managed backend |
| Low-code workflow | Logic Apps | Integration-heavy, visual designer |

> **docker-compose → Azure mapping:** Map each `detectedServices[].type` to its PaaS equivalent using these tables.

## Supporting (always include)

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring + APM |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth (zero secrets) |

## Specialized Routing

Check before mapping — delegate to specialized skill if matched:

| Signal | Delegate To |
|--------|-------------|
| Copilot SDK, `@github/copilot-sdk` | `azure-hosted-copilot-sdk` |
| Foundry agent, AI agent deployment | `microsoft-foundry` |

> **Non-Azure cloud SDK deps** (AWS Lambda, GCP Cloud Functions, `google-cloud-*`, `aws-sdk`, `boto3`, Firebase) are NOT routed to a separate skill. They are handled inline: prereq flags them as `CLOUD_SDK_DEPENDENCY`, prepare maps the Azure service equivalents, and scaffold performs the SDK code swaps.

## Non-Azure Terraform Resource Mapping

When `context.json.detectedInfraProvider.terraform` is `"gcp"` or `"aws"`, read existing `.tf` files and map cloud resources to Azure equivalents. These mappings provide architecture signal for service selection — use alongside component detection.

### GCP → Azure

| GCP Terraform Resource | Azure Equivalent | Notes |
|------------------------|-----------------|-------|
| `google_cloud_run_v2_service` | Container Apps | Map scaling, env vars, VPC config |
| `google_sql_database_instance` (POSTGRES) | PostgreSQL Flexible Server | Map tier, backup, maintenance config |
| `google_sql_database_instance` (MYSQL) | MySQL Flexible Server | Map tier, backup config |
| `google_artifact_registry_repository` | Container Registry (ACR) | Basic tier unless geo-replication needed |
| `google_pubsub_topic` / `google_pubsub_subscription` | Service Bus | Map topic/subscription model |
| `google_secret_manager_secret` | Key Vault | Map secret references |
| `google_firestore_database` | Cosmos DB (NoSQL API) | Map indexes, TTL config |
| `google_cloudfunctions2_function` | Azure Functions | Map triggers, runtime |
| `google_service_account` + `google_project_iam_member` | Managed Identity + RBAC | Map role bindings |

Other GCP resources (storage, redis, compute network, VPC connector, cloud tasks) map 1:1 to their Azure equivalents (Blob Storage, Redis Cache, VNet, Queue Storage).

### AWS → Azure

| AWS Terraform Resource | Azure Equivalent | Notes |
|------------------------|-----------------|-------|
| `aws_ecs_service` / `aws_ecs_task_definition` | Container Apps | Map task def → container config |
| `aws_rds_instance` (postgres/mysql) | PostgreSQL/MySQL Flexible Server | Map instance class → SKU |
| `aws_lambda_function` | Azure Functions | Map runtime, handler, triggers |
| `aws_dynamodb_table` | Cosmos DB (NoSQL API) | Map capacity, indexes |
| `aws_sns_topic` | Service Bus or Event Grid | Map subscriptions |
| `aws_secretsmanager_secret` | Key Vault | Map secret references |

Other AWS resources (S3, ECR, SQS, ElastiCache) map 1:1 to their Azure equivalents (Blob Storage, ACR, Queue Storage/Service Bus, Redis Cache). SQS → Service Bus if FIFO ordering needed.
