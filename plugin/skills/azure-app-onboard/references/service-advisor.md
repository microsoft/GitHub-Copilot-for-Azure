# Service Advisor — Comparison Tables

Quick-reference tables for answering architecture questions. Not a deployment mapping — see `prepare/references/service-mapping.md` for component→service selection during planning.

## Databases

| Service | Best for | Scale model | Starting cost | Key differentiator |
|---------|----------|-------------|---------------|-------------------|
| Azure SQL | Relational, transactions, complex joins | DTU or vCore | ~$5/mo (Basic) | Full SQL Server compatibility |
| PostgreSQL Flexible | Open-source relational, PostGIS | vCore | ~$13/mo (Burstable B1ms) | Extensions, community ecosystem |
| Cosmos DB | Global distribution, multi-model | RU/s or serverless | ~$24/mo (serverless) | Single-digit ms latency worldwide |
| MySQL Flexible | MySQL workloads, WordPress/PHP | vCore | ~$13/mo (Burstable B1ms) | MySQL wire-protocol compatible |

## Hosting

| Service | Best for | Scaling | Free tier | Key differentiator |
|---------|----------|---------|-----------|-------------------|
| App Service | Traditional web apps, PaaS | Manual/auto, up to 30 instances | F1 (shared, 60 min/day) | Easiest path, built-in CI/CD slots |
| Container Apps | Microservices, event-driven containers | KEDA auto-scale, scale-to-zero | Included free grants | Serverless containers, no K8s mgmt |
| AKS | Complex microservices, K8s-native | Node auto-scale, pod HPA | Control plane free | Full K8s API, service mesh, CRDs |
| Functions | Event-driven, short-lived tasks | Per-execution, scale-to-zero | 1M exec/mo free | Pay-per-use, binding integrations |

## Messaging

| Service | Pattern | Best for | Starting cost |
|---------|---------|----------|---------------|
| Service Bus | Queue / Topic | Ordered, transactional messaging | ~$0.05/M operations (Basic) |
| Event Grid | Pub/Sub | Event routing, reactive architectures | $0.60/M operations |
| Event Hubs | Stream | High-throughput telemetry, log ingestion | ~$11/mo (Basic, 1 TU) |

## Storage

| Service | Best for | Access pattern |
|---------|----------|---------------|
| Blob Storage | Files, images, backups, large objects | REST API, SDKs, tiered (hot/cool/archive) |
| Files Storage | Shared file systems, lift-and-shift | SMB/NFS mount, replaces on-prem file shares |
| Table Storage | Key-value, simple structured data | NoSQL, low cost, high throughput |
| Queue Storage | Simple async messaging | Lightweight, no ordering guarantees |

## Auth

| Service | Best for | Scenario |
|---------|----------|----------|
| Entra ID | Enterprise/workforce identity | Employee SSO, B2E apps, Microsoft 365 integration |
| Azure AD B2C | Consumer-facing identity | Self-service signup, social logins, custom flows |
| App Service Auth | Quick add-on auth | Built-in auth for App Service without code changes |
