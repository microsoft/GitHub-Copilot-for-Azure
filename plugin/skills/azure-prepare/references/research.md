# Research Components

After architecture planning, research each selected component to gather best practices before generating artifacts.

## Process

1. **Identify Components** — List all Azure services from architecture plan
2. **Load Service References** — For each service, load `services/<service>/README.md` first, then specific references as needed
3. **Check Resource Naming Rules** — For each resource type, check [resource naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules) for valid characters, length limits, and uniqueness scopes
4. **Load Recipe References** — Load the selected recipe's guide (e.g., [AZD](recipes/azd/README.md)) and its IAC rules, MCP best practices, and schema tools listed in its "Before Generation" table
5. **Check Region Availability** — Verify all selected services are available in the target region per [region-availability.md](region-availability.md)
6. **Load Runtime References** — For containerized apps, load language-specific production settings (e.g., [Node.js](runtimes/nodejs.md))
7. **Invoke Related Skills** — For deeper guidance, invoke mapped skills from the table below
8. **Document Findings** — Record key insights in `.azure/plan.md`

## Service-to-Reference Mapping

| Azure Service | Reference | Related Skills |
|---------------|-----------|----------------|
| **Hosting** | | |
| Container Apps | [Container Apps](services/container-apps/README.md) | `azure-diagnostics`, `azure-observability`, `azure-nodejs-production` |
| App Service | [App Service](services/app-service/README.md) | `azure-diagnostics`, `azure-observability`, `azure-nodejs-production` |
| Azure Functions | [Functions](services/functions/README.md) | — |
| Static Web Apps | [Static Web Apps](services/static-web-apps/README.md) | — |
| AKS | [AKS](services/aks/README.md) | `azure-networking`, `azure-security-hardening` |
| **Data** | | |
| Azure SQL | [SQL Database](services/sql-database/README.md) | `azure-security` |
| Cosmos DB | [Cosmos DB](services/cosmos-db/README.md) | `azure-security` |
| PostgreSQL | — | `azure-postgres` (invoke for passwordless auth) |
| Storage (Blob/Files) | [Storage](services/storage/README.md) | `azure-storage`, `azure-security-hardening` |
| **Messaging** | | |
| Service Bus | [Service Bus](services/service-bus/README.md) | — |
| Event Grid | [Event Grid](services/event-grid/README.md) | — |
| Event Hubs | — | — |
| **Integration** | | |
| Logic Apps | [Logic Apps](services/logic-apps/README.md) | — |
| **Security & Identity** | | |
| Key Vault | [Key Vault](services/key-vault/README.md) | `azure-security`, `azure-keyvault-expiration-audit` |
| Managed Identity | — | `azure-security`, `entra-app-registration` |
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
| Using Azure Functions | Load [selection.md](services/functions/templates/selection.md) → Follow [composition.md](services/functions/templates/recipes/composition.md) algorithm |
| PostgreSQL with passwordless auth | Invoke `azure-postgres` skill |
| Need detailed security hardening | `azure-security-hardening` |
| Setting up App Insights instrumentation | `appinsights-instrumentation` |
| Building AI applications | `microsoft-foundry` |
| Cost-sensitive deployment | `azure-cost-optimization` |

**Skill/Reference Invocation Pattern:**
```
For Component: Azure Functions
→ Load: services/functions/templates/selection.md (decision tree)
→ Follow: services/functions/templates/recipes/composition.md (algorithm)
→ Result: Base template + recipe composition (never synthesize IaC)

For Component: PostgreSQL
→ Invoke: azure-postgres skill
→ Extract: passwordless auth patterns
→ Apply: to artifact generation
```

### Step 3: Document in Plan

Add research findings to `.azure/plan.md`:

```markdown
## Research Summary

### Container Apps
- **Source**: services/container-apps/README.md, scaling.md, health-probes.md
- **Key Insights**: 
  - Use min replicas: 1 for APIs to avoid cold starts
  - Configure health probes for liveness and readiness
  - Use queue-based scaling for workers

### Security
- **Source**: azure-security-hardening skill
- **Key Insights**:
  - Use Managed Identity for all service-to-service auth
  - Store secrets in Key Vault, not env vars
```

## Common Research Patterns

### Web Application + API + Database

1. Load: `services/container-apps/README.md` → `bicep.md`, `scaling.md`
2. Load: `services/cosmos-db/README.md` → `partitioning.md`
3. Load: `services/key-vault/README.md`
4. Invoke: `azure-observability` (monitoring setup)
5. Invoke: `azure-security-hardening` (security baseline)

### Serverless Event-Driven

1. Load: `services/functions/README.md` (contains mandatory composition workflow)
2. Load: `services/event-grid/README.md` or `services/service-bus/README.md` (if using messaging)
3. Load: `services/storage/README.md` (if using queues/blobs)
4. Invoke: `azure-observability` (distributed tracing)

### AI Application

1. Invoke: `microsoft-foundry` (AI patterns and best practices)
2. Load: `services/container-apps/README.md` → `bicep.md`
3. Load: `services/cosmos-db/README.md` → `partitioning.md` (vector storage)
4. Invoke: `azure-security` (API key management)

## After Research

Proceed to **Generate Artifacts** step with research findings applied.
