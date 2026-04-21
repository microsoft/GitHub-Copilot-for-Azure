# Requirements Gathering

> Determine what user needs for project. Auto-infer from existing code when possible; only ask what cannot be determined.

---

## Inference-First Approach

**ALWAYS attempt to infer requirements from workspace before asking user.**

Run workspace detection from SKILL.md Step 0 first. After detection, you should know:
- Runtime and language (from existing project files)
- Existing test infrastructure (from test configs and deps)
- Azure SDKs already in use (from dep lists)
- Frontend framework (from existing frontend code)

### ⚠️ If `.azure/plan.md` Exists — Service List Is Already Decided

When `.azure/plan.md` found:
1. Read plan's **Architecture → Service Mapping** section
2. Use those services — Do NOT ask user to re-specify
3. Present inferred service list for confirmation: _"Based on your deployment plan, your project will use: PostgreSQL, Blob Storage, Redis. Want to add or change anything?"_
4. Only ask follow-ups for things NOT covered by plan

---

## Questions to Ask (Only If Needed)

### Q1: App Type — Ask only if workspace is empty (NEW mode)

> What kind of app are you building?

| Option | Description |
|--------|-------------|
| **API only** | Backend API with no frontend (REST endpoints) |
| **SPA + API** | Single-page app (React/Vue/Angular/Svelte) with backend API |
| **Full-stack SSR** | Server-rendered app (Next.js, Nuxt, Blazor) |
| **Static site + API** | Static HTML/CSS/JS site with serverless API endpoints |
| **Background worker** | Event-driven processing (queue, timer, blob triggers) — no HTTP frontend |

### Q2: Runtime — Ask only if not detectable from workspace

> What language/runtime do you want to use?

| Option | Azure Functions Model | Test Runner Options |
|--------|----------------------|-------------------|
| **TypeScript** (Node.js) | v4 programming model | vitest, jest, mocha+chai+sinon |
| **Python** | v2 programming model | pytest |
| **C# (.NET 8)** | Isolated worker model | xUnit, NUnit |

### Q3: Test Runner — Ask only if not detectable from existing test config

> What test runner do you want to use?

Present options based on selected runtime. Include brief pros/cons. See [testing.md](testing.md) → Test Runner Quick Reference.

### Q4: Data Stores — Ask only if not detectable from SDK imports or `.azure/plan.md`

> What data stores does your app need?

| Option | Azure Service | Environment Variable |
|--------|--------------|---------------------|
| **Blob Storage** (files, images, documents) | Azure Blob Storage | `STORAGE_CONNECTION_STRING` |
| **Queue Storage** (async message processing) | Azure Queue Storage | `STORAGE_CONNECTION_STRING` |
| **Table Storage** (simple key-value NoSQL) | Azure Table Storage | `STORAGE_CONNECTION_STRING` |
| **PostgreSQL** (relational database) | Azure Database for PostgreSQL | `DATABASE_URL` |
| **CosmosDB** (document database) | Azure Cosmos DB | `COSMOSDB_CONNECTION_STRING` |
| **Redis** (caching, sessions) | Azure Cache for Redis | `REDIS_URL` |
| **Azure SQL** (SQL Server compatible) | Azure SQL Database | `SQL_CONNECTION_STRING` |

### Q5: Frontend Framework — Ask only if app type includes a frontend and not detectable

> What frontend framework do you want to use?

| Option | Build Tool |
|--------|-----------|
| **React** | Vite |
| **Vue** | Vite |
| **Angular** | Angular CLI |
| **Svelte** | Vite |

### Q6: Features / Routes — Ask when building a new app

> Describe the features or API routes your app needs.

This is free-form question. User might say:
- "A todo app with CRUD for tasks and tagging"
- "A photo gallery with upload, list, and delete"
- "A blog API with posts, comments, and search"

From user's description, derive:
- Entity types (Task, Photo, Post, Comment, etc.)
- API routes (CRUD operations per entity)
- Data relationships (one-to-many, many-to-many)
- Which services needed (storage for uploads, database for entities, cache for search, etc.)

### Q7: Authentication (Local) — Ask only if auth is relevant to the user's features

> How do you want to handle authentication?

| Option | Description |
|--------|-------------|
| **No auth** | All endpoints public |
| **Mock auth middleware** | Fake JWT validation that always passes — useful for testing protected routes without real auth |

---

## Requirement Inference Rules

| If you detect... | Then infer... |
|-----------------|---------------|
| `.azure/plan.md` exists | Read it — extract all Azure services. This is authoritative. |
| `@azure/storage-blob` import | App uses Blob Storage |
| `@azure/cosmos` import | App uses CosmosDB |
| `pg` or `psycopg2` import | App uses PostgreSQL |
| `redis` or `ioredis` import | App uses Redis |
| `react` in dependencies | Frontend = React |
| `vue` in dependencies | Frontend = Vue |
| `@angular/core` in dependencies | Frontend = Angular |
| `svelte` in dependencies | Frontend = Svelte |
| `vitest` in devDependencies | Test runner = vitest |
| `jest` in devDependencies | Test runner = jest |
| `mocha` in devDependencies | Test runner = mocha+chai+sinon |
| `pytest` in project deps | Test runner = pytest |
| `xunit` in project refs | Test runner = xUnit |
| `host.json` exists | Azure Functions already initialized — augment, don't recreate |
| `zod` in dependencies | Validation library already chosen — use it |
| `pydantic` in dependencies | Validation library already chosen — use it |

---

## Output

After gathering requirements, produce summary that feeds directly into plan template:

```markdown
### Requirements Summary

- **App Type**: SPA + API
- **Runtime**: TypeScript (Node.js)
- **Backend**: Azure Functions v4
- **Frontend**: React + Vite
- **Test Runner**: vitest
- **Mocking**: vitest built-in (vi.mock)
- **Data Stores**: PostgreSQL (primary), Blob Storage (uploads)
- **Validation**: Zod
- **Logging**: pino
- **Auth (Local)**: Mock auth middleware
- **Features**:
  - Items CRUD (GET, POST, PUT, DELETE /api/items)
  - Photo upload (POST /api/photos)
  - Health check (GET /api/health)
  - OpenAPI spec (GET /api/openapi.json)
```

This summary becomes Sections 2, 3, 4, and 6 of project plan.
