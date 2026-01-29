# Azure Skill Tests

Automated test suites for Azure deployment skills. These tests verify detection logic, production readiness validation, and Azure resource validation.

---

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Adding New Tests](#adding-new-tests)
- [Test Coverage vs Skills](#test-coverage-vs-skills)
- [Detection Logic Reference](#detection-logic-reference)

---

## Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

Each suite is independent with its own `package.json`. Install dependencies per suite:

```bash
# Detection tests
cd tests/detection && npm install

# Node.js production tests
cd tests/nodejs-production && npm install

# Validation tests
cd tests/validation && npm install
```

---

## Running Tests

### Run Individual Suites

```bash
# Detection tests (181 tests)
cd tests/detection && npm test

# Node.js production tests (83 tests)
cd tests/nodejs-production && npm test

# Validation tests (165 tests)
cd tests/validation && npm test
```

### Run All Suites

```bash
# From repository root
cd tests/detection && npm install && npm test && \
cd ../nodejs-production && npm install && npm test && \
cd ../validation && npm install && npm test
```

### Additional Commands

```bash
# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern="service-selection"

# Run tests matching a pattern
npm test -- --testNamePattern="Next.js"
```

### Expected Output

```
# Detection
Test Suites: 9 passed, 9 total
Tests:       181 passed, 181 total

# Node.js Production
Test Suites: 3 passed, 3 total
Tests:       83 passed, 83 total

# Validation
Test Suites: 4 passed, 4 total
Tests:       165 passed, 165 total
```

---

## Test Structure

```
tests/
├── detection/                       # App type detection tests (181 tests)
│   ├── __tests__/
│   │   ├── service-selection.test.js   # Fixture-based tests
│   │   ├── highConfidence.test.js      # Azure config file tests
│   │   ├── nodejs.test.js              # Node.js framework tests
│   │   ├── python.test.js              # Python framework tests
│   │   ├── dotnet.test.js              # .NET framework tests
│   │   ├── java.test.js                # Java framework tests
│   │   ├── static.test.js              # Pure static site tests
│   │   ├── multiService.test.js        # Monorepo tests
│   │   └── confidence.test.js          # Confidence level tests
│   ├── fixtures/
│   │   ├── expectations.json           # Expected results for each fixture
│   │   └── projects/                   # 21 real project fixtures
│   ├── src/
│   │   ├── appTypeDetector.js          # Core detection algorithm
│   │   ├── filePatterns.js             # File pattern constants
│   │   └── serviceMapping.js           # Azure service mappings
│   ├── utils/
│   │   ├── fixture-loader.js           # Loads fixtures and expectations
│   │   └── project-scanner.js          # Scans real directories
│   ├── package.json
│   └── README.md
│
├── nodejs-production/               # Node.js production tests (83 tests)
│   ├── __tests__/
│   │   ├── expressValidator.test.js    # Express.js validation
│   │   ├── dockerfileValidator.test.js # Dockerfile validation
│   │   └── integration.test.js         # End-to-end tests
│   ├── fixtures/projects/              # Sample Express projects
│   ├── src/validators/
│   │   ├── expressProductionValidator.js
│   │   └── dockerfileValidator.js
│   ├── package.json
│   └── README.md
│
├── validation/                      # Azure validation tests (165 tests)
│   ├── __tests__/
│   │   ├── resourceNameValidator.test.js  # Naming constraint tests
│   │   ├── bicepValidator.test.js         # Bicep detection tests
│   │   ├── preflightValidator.test.js     # Preflight utility tests
│   │   └── integration.test.js            # End-to-end scenarios
│   ├── fixtures/
│   │   ├── bicep/                      # Sample Bicep files
│   │   └── projects/                   # Sample project structures
│   ├── src/validators/
│   │   ├── resourceNameValidator.js    # Azure resource naming rules
│   │   ├── bicepValidator.js           # Bicep file detection
│   │   └── preflightValidator.js       # Preflight check utilities
│   ├── package.json
│   └── README.md
│
└── README.md                        # This file
```

---

## Adding New Tests

⚠️ **Only add tests to existing suites. Do not create new test areas.**

### Adding Detection Tests

1. **Create project directory:**
   ```bash
   mkdir -p tests/detection/fixtures/projects/my-new-app
   ```

2. **Add config files** (only the files needed for detection):
   ```bash
   echo '{"dependencies":{"@remix-run/node":"^2.0.0"}}' > tests/detection/fixtures/projects/remix-app/package.json
   ```

3. **Add expected result to `fixtures/expectations.json`:**
   ```json
   {
     "remix-app": {
       "service": "app-service",
       "skill": "azure-deploy",
       "confidence": "MEDIUM",
       "framework": "Remix"
     }
   }
   ```

4. **Run tests:**
   ```bash
   cd tests/detection && npm test
   ```

### Adding Validation Tests

Add tests to existing files in `tests/validation/__tests__/`:
- `resourceNameValidator.test.js` - Azure resource naming
- `bicepValidator.test.js` - Bicep file validation
- `preflightValidator.test.js` - Preflight checks
- `integration.test.js` - End-to-end scenarios

### Adding Node.js Production Tests

Add tests to existing files in `tests/nodejs-production/__tests__/`:
- `expressValidator.test.js` - Express.js checks
- `dockerfileValidator.test.js` - Dockerfile checks
- `integration.test.js` - Fixture-based tests

---

## Test Coverage vs Skills

### Test Suites Overview

| Suite | Location | Tests | Skills Covered |
|-------|----------|-------|----------------|
| **Detection** | `tests/detection/` | 181 | `azure-deploy` |
| **Node.js Production** | `tests/nodejs-production/` | 83 | `azure-nodejs-production` |
| **Validation** | `tests/validation/` | 165 | `azure-validation`, `azure-deployment-preflight` |
| **Total** | | **429** | |

### Deployment Skills Coverage (Detection Suite)

All deployment scenarios route to the consolidated `azure-deploy` skill with specialized reference guides:

| Service | Tested | Fixtures | Reference Guide |
|---------|--------|----------|-----------------|
| ✅ Azure Developer CLI (azd) | Yes | `azd-fullstack` | Main orchestrator, `azure.yaml` detection |
| ✅ Container Apps | Yes | `docker-node`, `docker-compose-multi` | `reference/container-apps.md` |
| ✅ AKS | ⚠️ Partial | - | `reference/aks.md` - Needs Kubernetes fixtures |
| ✅ App Service | Yes | `express-api`, `flask-app`, `django-app`, `fastapi-app`, `dotnet-webapp`, `spring-boot`, `nextjs-ssr` | `reference/app-service.md` |
| ✅ Azure Functions | Yes | `functions-node`, `functions-python`, `functions-dotnet` | `reference/functions.md` |
| ✅ Static Web Apps | Yes | `react-vite`, `vue-vite`, `angular`, `nextjs-static`, `gatsby`, `astro`, `plain-html` | `reference/static-web-apps.md` |

### Framework Detection Coverage

| Language | Framework | Tested | Fixture |
|----------|-----------|--------|---------|
| **Node.js** | | | |
| | React (Vite) | ✅ | `react-vite` |
| | Vue (Vite) | ✅ | `vue-vite` |
| | Angular | ✅ | `angular` |
| | Next.js (SSG) | ✅ | `nextjs-static` |
| | Next.js (SSR) | ✅ | `nextjs-ssr` |
| | Nuxt | ✅ | Unit tests |
| | Gatsby | ✅ | `gatsby` |
| | Astro | ✅ | `astro` |
| | Express | ✅ | `express-api` |
| | NestJS | ✅ | Unit tests |
| | Fastify | ✅ | Unit tests |
| | Koa | ✅ | Unit tests |
| | Hapi | ✅ | Unit tests |
| | Svelte | ⚠️ | Needs fixture |
| | Remix | ❌ | Not implemented |
| | SvelteKit | ❌ | Not implemented |
| **Python** | | | |
| | Flask | ✅ | `flask-app` |
| | Django | ✅ | `django-app` |
| | FastAPI | ✅ | `fastapi-app` |
| | Azure Functions | ✅ | `functions-python` |
| **.NET** | | | |
| | ASP.NET Core | ✅ | `dotnet-webapp` |
| | Blazor WebAssembly | ✅ | Unit tests |
| | Azure Functions | ✅ | `functions-dotnet` |
| **Java** | | | |
| | Spring Boot | ✅ | `spring-boot` |
| | Azure Functions | ✅ | Unit tests |
| | Quarkus | ❌ | Not implemented |
| | Micronaut | ❌ | Not implemented |
| **Static** | | | |
| | Plain HTML | ✅ | `plain-html` |

### High-Confidence Signal Coverage

| Signal | Tested | Service |
|--------|--------|---------|
| `azure.yaml` | ✅ | Azure Developer CLI |
| `host.json` | ✅ | Azure Functions |
| `function.json` | ✅ | Azure Functions |
| `function_app.py` | ✅ | Azure Functions |
| `local.settings.json` | ⚠️ | Azure Functions |
| `staticwebapp.config.json` | ✅ | Static Web Apps |
| `swa-cli.config.json` | ✅ | Static Web Apps |
| `Dockerfile` | ✅ | Container Apps |
| `docker-compose.yml` | ✅ | Container Apps |
| `docker-compose.yaml` | ✅ | Container Apps |

### Validation Suite Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| **Resource Naming** | ~60 | Storage Account, Key Vault, Container Registry, Container App, App Service, Function App, Resource Group, Cosmos DB |
| **Bicep Detection** | ~50 | Target scope, parameter files, azd projects, security checks |
| **Preflight Checks** | ~35 | Tool validation, auth parsing, report generation |
| **Integration** | ~20 | End-to-end scenarios |

### Node.js Production Suite Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| **Express Validation** | ~40 | Trust proxy, health endpoints, cookie security, port/host binding |
| **Dockerfile Validation** | ~25 | NODE_ENV, HEALTHCHECK, non-root user, base image |
| **Integration** | ~18 | Fixture-based end-to-end tests |

### Skills NOT Currently Tested

These skills don't have automated tests (they're service-specific, not detection/validation skills):

| Skill | Reason |
|-------|--------|
| `appinsights-instrumentation` | Monitoring, not deployment |
| `azure-ai` | AI services configuration |
| `azure-cli` | CLI usage guidance |
| `azure-cosmos-db` | Database service |
| `azure-cost-optimization` | Cost analysis |
| `azure-diagnostics` | Troubleshooting |
| `azure-keyvault-expiration-audit` | Security audit |
| `azure-mcp` | MCP tool usage |
| `azure-networking` | Network configuration |
| `azure-observability` | Monitoring setup |
| `azure-postgres-entra-rbac-setup` | Database security |
| `azure-redis` | Cache service |
| `azure-resource-visualizer` | Resource visualization |
| `azure-role-selector` | IAM configuration |
| `azure-security` | Security guidance |
| `azure-security-hardening` | Security hardening |
| `azure-sql-database` | Database service |
| `azure-storage` | Storage service |
| `microsoft-foundry` | AI platform |

---

## CI Workflows

| Workflow | File | Triggers |
|----------|------|----------|
| Detection | `test-detection.yml` | `azure-deploy` skill, `tests/detection/` |
| Node.js Production | `test-nodejs-production.yml` | `azure-nodejs-production` skill, `tests/nodejs-production/` |
| Validation | `test-validation.yml` | `azure-validation`, `azure-deployment-preflight` skills, `tests/validation/` |

All workflows:
- Run on push to `main` and PRs (with path filters)
- Test on Node.js 20 and 22
- Upload coverage to Codecov
- Support manual trigger via `workflow_dispatch`

---

## Detection Logic Reference

### Priority Order

1. **High Confidence** - Azure config files (`azure.yaml`, `host.json`, `Dockerfile`)
2. **Multi-Service** - Monorepo patterns (`frontend/`, `backend/`, multiple `package.json`)
3. **Framework** - Language-specific frameworks
4. **Static** - Pure HTML sites

### Confidence Levels

| Level | Criteria | Example |
|-------|----------|---------|
| **HIGH** | Azure config file found | `azure.yaml`, `host.json`, `Dockerfile` |
| **MEDIUM** | Framework detected | Express in package.json |
| **LOW** | Language only, no framework | Generic package.json |

### Service Mappings

All services route to `azure-deploy` with specialized reference guides:

| Detection | Service | Skill Route | Reference Guide |
|-----------|---------|-------------|-----------------|
| `azure.yaml` | Azure Developer CLI | `azure-deploy` | - |
| `host.json`, `function.json` | Azure Functions | `azure-deploy` | `reference/functions.md` |
| `staticwebapp.config.json` | Static Web Apps | `azure-deploy` | `reference/static-web-apps.md` |
| `Dockerfile` | Container Apps | `azure-deploy` | `reference/container-apps.md` |
| React, Vue, Angular, Gatsby, Astro | Static Web Apps | `azure-deploy` | `reference/static-web-apps.md` |
| Next.js (SSR), Express, NestJS | App Service | `azure-deploy` | `reference/app-service.md` |
| Flask, Django, FastAPI | App Service | `azure-deploy` | `reference/app-service.md` |
| ASP.NET Core | App Service | `azure-deploy` | `reference/app-service.md` |
| Spring Boot | App Service | `azure-deploy` | `reference/app-service.md` |

---

## Related Documentation

- [`azure-deploy` SKILL.md](../plugin/skills/azure-deploy/SKILL.md) - Detection logic source
- [Detection README](detection/README.md) - Detection suite details
- [Node.js Production README](nodejs-production/README.md) - Production validation details
- [Validation README](validation/README.md) - Azure validation details
