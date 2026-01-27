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
Test Suites: 9 passed, 9 total
Tests:       181 passed, 181 total
Time:        0.268 s
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
       "skill": "azure-app-service-deployment",
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

| Skill | Tested | Fixtures | Notes |
|-------|--------|----------|-------|
| ✅ `azure-deploy` | Yes | `azd-fullstack` | Main orchestrator, azure.yaml detection |
| ✅ `azure-aca-deployment` | Yes | `docker-node`, `docker-compose-multi` | Container Apps |
| ✅ `azure-aks-deployment` | ⚠️ Partial | - | Needs Kubernetes fixtures |
| ✅ `azure-app-service-deployment` | Yes | `express-api`, `flask-app`, `django-app`, `fastapi-app`, `dotnet-webapp`, `spring-boot`, `nextjs-ssr` | App Service |
| ✅ `azure-function-app-deployment` | Yes | `functions-node`, `functions-python`, `functions-dotnet` | Azure Functions |
| ✅ `azure-static-web-apps` | Yes | `react-vite`, `vue-vite`, `angular`, `nextjs-static`, `gatsby`, `astro`, `plain-html` | Static Web Apps |

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
| `azure-nodejs-production` | Production best practices |
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

| Detection | Service | Skill Route |
|-----------|---------|-------------|
| `azure.yaml` | Azure Developer CLI | `azure-deploy` |
| `host.json`, `function.json` | Azure Functions | `azure-function-app-deployment` |
| `staticwebapp.config.json` | Static Web Apps | `azure-static-web-apps` |
| `Dockerfile` | Container Apps | `azure-aca-deployment` |
| React, Vue, Angular, Gatsby, Astro | Static Web Apps | `azure-static-web-apps` |
| Next.js (SSR), Express, NestJS | App Service | `azure-app-service-deployment` |
| Flask, Django, FastAPI | App Service | `azure-app-service-deployment` |
| ASP.NET Core | App Service | `azure-app-service-deployment` |
| Spring Boot | App Service | `azure-app-service-deployment` |

---

## Related Documentation

- [`azure-deploy` SKILL.md](../plugin/skills/azure-deploy/SKILL.md) - Detection logic source
- [PR #574](https://github.com/microsoft/GitHub-Copilot-for-Azure/pull/574) - Original test approach reference
