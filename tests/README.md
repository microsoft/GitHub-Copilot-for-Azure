# Azure Skill Detection Tests

Automated tests for the app type detection logic used by Azure deployment skills. When a user asks "what Azure service should I use?", these tests verify the detection logic correctly identifies the appropriate Azure service based on project files and structure.

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

```bash
cd tests
npm install
```

---

## Running Tests

```bash
# Run all tests
npm test

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
Test Suites: 12 passed, 12 total
Tests:       264 passed, 264 total
Time:        0.3 s
```

---

## Test Structure

```
tests/
├── fixtures/
│   ├── expectations.json            # Expected results for each fixture
│   └── projects/                    # 21 real project fixtures
│       ├── react-vite/
│       ├── angular/
│       ├── nextjs-ssr/
│       ├── functions-node/
│       ├── docker-node/
│       └── ...
│
├── src/detection/                   # Detection logic implementation
│   ├── appTypeDetector.js          # Core detection algorithm
│   ├── filePatterns.js             # File pattern constants
│   └── serviceMapping.js           # Azure service mappings
│
├── utils/
│   ├── fixture-loader.js           # Loads fixtures and expectations
│   └── project-scanner.js          # Scans real directories
│
├── __tests__/detection/            # Test suites
│   ├── service-selection.test.js   # Fixture-based tests (iterates over projects/)
│   ├── highConfidence.test.js      # Azure config file tests
│   ├── nodejs.test.js              # Node.js framework tests
│   ├── python.test.js              # Python framework tests
│   ├── dotnet.test.js              # .NET framework tests
│   ├── java.test.js                # Java framework tests
│   ├── static.test.js              # Pure static site tests
│   ├── multiService.test.js        # Monorepo tests
│   └── confidence.test.js          # Confidence level tests
│
├── package.json
├── jest.config.js
└── README.md
```

---

## Adding New Tests

### Option 1: Add a Fixture (Recommended)

1. **Create project directory:**
   ```bash
   mkdir -p fixtures/projects/my-new-app
   ```

2. **Add config files** (only the files needed for detection):
   ```bash
   # Example: Remix app
   echo '{"dependencies":{"@remix-run/node":"^2.0.0"}}' > fixtures/projects/remix-app/package.json
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

4. **Update detection logic** (if new pattern):
   - Add pattern to `src/detection/filePatterns.js`
   - Add detection logic to `src/detection/appTypeDetector.js`

5. **Run tests:**
   ```bash
   npm test
   ```

### Option 2: Add a Unit Test

Add tests to the appropriate file in `__tests__/detection/`:

```javascript
// In nodejs.test.js
test('detects Remix and recommends App Service', () => {
  const project = {
    files: ['package.json', 'remix.config.js'],
    contents: {
      'package.json': { dependencies: { '@remix-run/node': '^2.0.0' } }
    }
  };
  
  const result = detectAppType(project);
  
  expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
  expect(result.framework).toBe('Remix');
});
```

---

## Test Coverage vs Skills

### Deployment Skills Coverage

All deployment scenarios now route to the consolidated `azure-deploy` skill with specialized reference guides:

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

### Skills NOT Currently Tested

These skills don't have app type detection (they're service-specific, not deployment skills):

| Skill | Reason |
|-------|--------|
| `appinsights-instrumentation` | Monitoring, not deployment |
| `azure-ai` | AI services configuration |
| `azure-cli` | CLI usage guidance |
| `azure-cosmos-db` | Database service |
| `azure-cost-optimization` | Cost analysis |
| `azure-deployment-preflight` | Pre-deployment checks |
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
| `azure-validation` | Validation checks |
| `microsoft-foundry` | AI platform |

### Skills with Separate Test Suites

| Skill | Test Location | Tests | Description |
|-------|---------------|-------|-------------|
| ✅ `azure-nodejs-production` | `tests/nodejs-production/` | 83 | Express.js production best practices validation |
| ✅ `azure-validation` | `tests/validation/` | 165 | Resource naming, Bicep validation, preflight checks |
| ✅ `azure-deployment-preflight` | `tests/validation/` | (shared) | Preflight utilities covered in validation suite |

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

All services now route to `azure-deploy` with specialized reference guides:

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
- [PR #574](https://github.com/microsoft/GitHub-Copilot-for-Azure/pull/574) - Original test approach reference
