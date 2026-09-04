# Research Components

After architecture planning, research each selected component to gather best practices before generating artifacts.

## Process

1. **Identify Components** — List all Azure services from architecture plan
2. **Load Service References** — For each service, load `services/<service>/README.md` first, then specific references as needed
3. **Check Resource Naming Rules** — For each resource type, check [resource naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules) for valid characters, length limits, and uniqueness scopes
4. **Load Recipe References** — Load the selected recipe's guide (e.g., [AZD](recipes/azd/README.md)) and its IAC rules, MCP best practices, and schema tools listed in its "Before Generation" table
5. **Check Region Availability** — Verify all selected services are available in the target region per [region-availability.md](region-availability.md)
6. **Check Provisioning Limits** — Invoke **azure-quotas** skill to validate that the selected subscription and region have sufficient quota/capacity for all planned resources. Complete [Step 6 of the plan template](plan-template.md#6-provisioning-limit-checklist) in two phases: (1) prepare resource inventory with deployment quantities, (2) fetch quotas and validate capacity using azure-quotas skill
7. **Load Runtime References** — For containerized apps, load language-specific production settings (e.g., [Node.js](runtimes/nodejs.md))
8. **Invoke Related Skills** — For deeper guidance, invoke mapped skills from the table below
9. **Document Findings** — Record key insights in `.azure/deployment-plan.md`

## Service-to-Reference Mapping

| Azure Service | Reference | Related Skills |
|---------------|-----------|----------------|
| **Hosting** | | |
| Container Apps | [Container Apps](services/container-apps/README.md) | `azure-diagnostics`, `azure-observability`, `azure-nodejs-production` |
| App Service | [App Service](services/app-service/README.md) | `azure-diagnostics`, `azure-observability`, `azure-nodejs-production` |
| Azure Functions | [Functions](services/functions/README.md) | — |
| Static Web Apps | [Static Web Apps](services/static-web-apps/README.md) | — |
| AKS | [AKS](services/aks/README.md) | `azure-networking` |
| **Data** | | |
| Azure SQL | [SQL Database](services/sql-database/README.md) | — |
| Cosmos DB | [Cosmos DB](services/cosmos-db/README.md) | — |
| PostgreSQL | — | — |
| Storage (Blob/Files) | [Storage](services/storage/README.md) | `azure-storage` |
| **Messaging** | | |
| Service Bus | [Service Bus](services/service-bus/README.md) | — |
| Event Grid | [Event Grid](services/event-grid/README.md) | — |
| Event Hubs | — | — |
| **Integration** | | |
| API Management | [APIM](apim.md) | `azure-aigateway` (invoke for AI Gateway policies) |
| Logic Apps | [Logic Apps](services/logic-apps/README.md) | — |
| **Workflow & Orchestration** | | |
| Durable Functions | [Durable Functions](services/functions/durable.md), [Durable Task Scheduler](services/durable-task-scheduler/README.md) | — |
| Durable Task Scheduler | [Durable Task Scheduler](services/durable-task-scheduler/README.md) | — |
| **Security & Identity** | | |
| Key Vault | [Key Vault](services/key-vault/README.md) | `azure-keyvault-expiration-audit` |
| Managed Identity | — | `entra-app-registration` |
| **Observability** | | |
| Application Insights | [App Insights](services/app-insights/README.md) | `appinsights-instrumentation` (invoke for instrumentation) |
| Log Analytics | — | `azure-observability`, `azure-kusto` |
| **AI Services** | | |
| Azure OpenAI | [Foundry](services/foundry/README.md) | `microsoft-foundry` (invoke for AI patterns and model guidance) |
| AI Search | — | `azure-ai` (invoke for search configuration) |

## Research Instructions

### Step 1: Load Internal References (Progressive Loading)

For each selected service, load the README.md first, then load specific files as needed:

```
Selected: Container Apps, Cosmos DB, Key Vault

→ Load: services/container-apps/README.md (overview)
  → If need Bicep: services/container-apps/bicep.md
  → If need Terraform: services/container-apps/terraform.md
  → If need scaling: services/container-apps/scaling.md
  → If need health probes: services/container-apps/health-probes.md

→ Load: services/cosmos-db/README.md (overview)
  → If need partitioning: services/cosmos-db/partitioning.md
  → If need SDK: services/cosmos-db/sdk.md

→ Load: services/key-vault/README.md (overview)
  → If need SDK: services/key-vault/sdk.md
```

### Step 2: Invoke Related Skills (When Deeper Guidance Needed)

Invoke related skills for specialized scenarios:

| Scenario | Action |
|----------|--------|
| Using Azure Functions | Stay in **azure-prepare** — load [selection.md](services/functions/templates/selection.md) → Follow [composition.md](services/functions/templates/recipes/composition.md) algorithm |
| Using Container Apps with Dapr/recipes (Cosmos, messaging, Redis, ACR, PostgreSQL) | Stay in **azure-prepare** — load [selection.md](services/container-apps/templates/selection.md) → Follow [composition.md](services/container-apps/templates/composition.md) algorithm |
| PostgreSQL with passwordless auth | Handle directly without a separate skill |
| Need detailed security hardening | Handle directly with service-specific security guidance and platform best practices |
| Setting up App Insights instrumentation | `appinsights-instrumentation` |
| Building AI applications | `microsoft-foundry` |
| Cost-sensitive deployment | `azure-cost` |

### Step 3: Document in Plan

Add research findings to `.azure/deployment-plan.md` under a `## Research Summary` section with source references and key insights per component.

## Common Research Patterns

| Scenario | Load or invoke |
|----------|----------------|
| Web/API + Cosmos DB | [Container Apps](services/container-apps/README.md), [Cosmos DB](services/cosmos-db/README.md), [partitioning](services/cosmos-db/partitioning.md), [Key Vault](services/key-vault/README.md), `azure-observability` |
| Container Apps + SQL | [Container Apps selection](services/container-apps/templates/selection.md), [composition](services/container-apps/templates/composition.md), [SQL Bicep](services/sql-database/bicep.md), [SQL auth](services/sql-database/auth.md), [Key Vault](services/key-vault/README.md) |
| App Service + SQL | [App Service Bicep](services/app-service/bicep.md), [SQL Bicep](services/sql-database/bicep.md), [SQL auth](services/sql-database/auth.md), [Key Vault](services/key-vault/README.md) |
| Serverless events | [Functions](services/functions/README.md), [Event Grid](services/event-grid/README.md) or [Service Bus](services/service-bus/README.md), [Storage](services/storage/README.md), `azure-observability` |
| AI application | `microsoft-foundry`, [Container Apps](services/container-apps/README.md), [Cosmos DB partitioning](services/cosmos-db/partitioning.md), [Key Vault](services/key-vault/README.md) |

Apply the findings during **Generate Artifacts**.
