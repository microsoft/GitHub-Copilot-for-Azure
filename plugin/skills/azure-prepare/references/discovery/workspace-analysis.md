# Workspace Analysis

Scan and analyze workspace to identify all application components and technologies.

## TASK

Perform comprehensive workspace scanning to understand the existing codebase structure, technologies, and deployment requirements.

## Analysis Areas

### File System Inventory

| Pattern | Indicates |
|---------|-----------|
| `package.json` | Node.js project |
| `requirements.txt`, `pyproject.toml` | Python project |
| `*.csproj`, `*.sln` | .NET project |
| `pom.xml`, `build.gradle` | Java project |
| `go.mod` | Go project |
| `Dockerfile` | Containerized service |
| `azure.yaml` | Existing AZD project |

### Component Classification

#### Web Applications
- React, Angular, Vue.js (SPA)
- Static HTML/CSS/JS sites
- Server-rendered (Next.js, Nuxt, Blazor)

#### API Services
- REST APIs
- GraphQL endpoints
- gRPC services
- Microservices

#### Background Services
- Message queue processors
- Scheduled tasks / cron jobs
- Data pipelines
- Event handlers

#### Databases
- SQL (PostgreSQL, MySQL, SQL Server)
- NoSQL (MongoDB, Cosmos DB)
- Caching (Redis)
- Migrations present

#### Supporting Services
- Authentication/Authorization
- Logging and monitoring
- Configuration management
- Secret management

### Dependency Analysis

Identify:
- Inter-component communication patterns
- External API dependencies
- Database connections
- Message queue usage
- File storage requirements

## Detection Patterns

### Node.js Applications

```
package.json exists
├── Has "react" or "vue" or "angular" → SPA/Web Frontend
├── Has "express" or "fastify" or "koa" → API Service
├── Has "bull" or "agenda" → Background Worker
└── Has "next" or "nuxt" → Server-rendered Web App
```

### Python Applications

```
requirements.txt or pyproject.toml exists
├── Has "flask" or "fastapi" or "django" → Web/API Service
├── Has "celery" → Background Worker
└── Has "azure-functions" → Azure Function
```

### .NET Applications

```
*.csproj exists
├── <OutputType>Exe</OutputType> with web SDK → Web/API Service
├── Worker SDK reference → Background Worker
└── Azure Functions SDK → Azure Function
```

## Output Format

Document findings in the Preparation Manifest:

```markdown
## Discovery Findings

### Components Identified

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| user-api | API Service | Node.js/Express | src/user-api |
| web-frontend | SPA | React | src/web |
| order-processor | Worker | Python/Celery | src/worker |

### Dependencies

| Component | Depends On | Connection Type |
|-----------|-----------|-----------------|
| user-api | PostgreSQL | Database |
| web-frontend | user-api | HTTP REST |
| order-processor | Service Bus | Message Queue |

### Existing Infrastructure

| File | Status | Notes |
|------|--------|-------|
| azure.yaml | Not found | Need to generate |
| infra/ | Not found | Need to generate |
| Dockerfile | Found in src/user-api | Preserve |
```
