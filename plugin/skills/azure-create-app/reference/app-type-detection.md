# Application Type Detection

Use these patterns to identify application types during discovery.

## Node.js Applications

**Indicator:** `package.json` exists

| Pattern | Azure Service |
|---------|---------------|
| `next.config.js/mjs/ts` with `output: 'export'` | Static Web Apps |
| `next.config.js/mjs/ts` without export config | Container Apps (SSR) |
| `angular.json` | Static Web Apps |
| `vite.config.*` | Static Web Apps |
| `gatsby-config.js` | Static Web Apps |
| `astro.config.mjs` | Static Web Apps |
| `nest-cli.json` | Container Apps |
| express/fastify/koa/hapi dependency | Container Apps |

## Python Applications

**Indicator:** `requirements.txt` or `pyproject.toml` exists

| Pattern | Azure Service |
|---------|---------------|
| `function_app.py` exists | Azure Functions |
| `azure-functions` dependency | Azure Functions |
| flask/django/fastapi dependency | Container Apps |

## .NET Applications

**Indicator:** `*.csproj` or `*.sln` exists

| Pattern | Azure Service |
|---------|---------------|
| `<AzureFunctionsVersion>` in csproj | Azure Functions |
| Blazor WebAssembly | Static Web Apps |
| ASP.NET Core | Container Apps |

## Java Applications

**Indicator:** `pom.xml` or `build.gradle` exists

| Pattern | Azure Service |
|---------|---------------|
| `azure-functions-*` dependency | Azure Functions |
| spring-boot dependency | Container Apps |

## Static Sites

**Indicator:** `index.html` without `package.json` or `requirements.txt`

→ **Static Web Apps**

## Containerized Applications

**Indicator:** `Dockerfile` exists

→ **Container Apps** (or AKS if complex Kubernetes needs)

## Multi-Service Indicators

These patterns suggest a multi-service application:

- Monorepo structure (`frontend/`, `backend/`, `api/`)
- `docker-compose.yml` with multiple services
- Multiple `package.json` files in subdirectories
- Database connection strings in config files
