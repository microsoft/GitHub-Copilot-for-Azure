# Azure App Type Detection Tests

Automated tests for the app type detection logic used by Azure deployment skills. When a user asks "what Azure service should I use?", these tests verify the detection logic correctly identifies the appropriate Azure service based on project files and structure.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── src/detection/                    # Detection logic implementation
│   ├── appTypeDetector.js           # Core detection algorithm
│   ├── filePatterns.js              # File pattern constants
│   └── serviceMapping.js            # Azure service mappings
│
└── __tests__/detection/             # Test suites
    ├── highConfidence.test.js       # Azure config files (azure.yaml, host.json, Dockerfile)
    ├── nodejs.test.js               # Node.js frameworks (Next.js, Angular, Vue, Express, etc.)
    ├── python.test.js               # Python frameworks (Flask, Django, FastAPI, Functions)
    ├── dotnet.test.js               # .NET frameworks (ASP.NET Core, Blazor, Functions)
    ├── java.test.js                 # Java frameworks (Spring Boot, Functions)
    ├── static.test.js               # Pure static HTML sites
    ├── multiService.test.js         # Monorepos and multi-service architectures
    └── confidence.test.js           # Confidence level assignment
```

## Detection Logic

The detection algorithm follows the priority order from the `azure-deploy` skill:

### 1. High Confidence Signals (checked first)

| File | Service | Skill Route |
|------|---------|-------------|
| `azure.yaml` | Azure Developer CLI | `azure-deploy` |
| `host.json`, `function.json`, `function_app.py` | Azure Functions | `azure-function-app-deployment` |
| `staticwebapp.config.json`, `swa-cli.config.json` | Static Web Apps | `azure-static-web-apps` |
| `Dockerfile`, `docker-compose.yml` | Container Apps | `azure-aca-deployment` |

### 2. Multi-Service Detection

Triggers when detecting:
- Multiple service directories (`frontend/`, `backend/`, `api/`, etc.)
- Multiple `package.json` in subdirectories

Recommends: Azure Developer CLI with Infrastructure as Code

### 3. Framework Detection

| Language | Framework | Service |
|----------|-----------|---------|
| Node.js | Next.js (SSR) | App Service |
| Node.js | Next.js (export), Angular, Vue, React, Gatsby, Astro | Static Web Apps |
| Node.js | Express, NestJS, Fastify, Koa | App Service |
| Python | Flask, Django, FastAPI | App Service |
| Python | azure-functions | Azure Functions |
| .NET | ASP.NET Core | App Service |
| .NET | Blazor WebAssembly | Static Web Apps |
| .NET | Azure Functions | Azure Functions |
| Java | Spring Boot | App Service |
| Java | azure-functions | Azure Functions |

### 4. Static Sites

Pure HTML sites (index.html without package.json/requirements.txt) → Static Web Apps

## Confidence Levels

| Level | Criteria | Example |
|-------|----------|---------|
| **HIGH** | Azure config file found | `azure.yaml`, `host.json`, `Dockerfile` |
| **MEDIUM** | Framework detected from dependencies | Express in package.json, Flask in requirements.txt |
| **LOW** | Language detected but no framework | Generic package.json without framework |

## Usage in Code

```javascript
const { detectAppType } = require('./src/detection/appTypeDetector');

const result = detectAppType({
  files: ['package.json', 'next.config.js'],
  contents: {
    'package.json': { dependencies: { next: '^14.0.0' } },
    'next.config.js': "module.exports = { output: 'export' };"
  },
  directories: []
});

// Result:
// {
//   service: 'Static Web Apps',
//   skill: 'azure-static-web-apps',
//   confidence: 'MEDIUM',
//   reason: 'Next.js with static export detected',
//   framework: 'Next.js (SSG)'
// }
```

## Adding New Tests

1. Identify the detection pattern from `azure-deploy` SKILL.md
2. Add the pattern to `src/detection/filePatterns.js`
3. Implement detection logic in `src/detection/appTypeDetector.js`
4. Add tests in the appropriate `__tests__/detection/*.test.js` file

## Related Skills

- [`azure-deploy`](../plugin/skills/azure-deploy/SKILL.md) - Main deployment skill with detection logic
- [`azure-function-app-deployment`](../plugin/skills/azure-function-app-deployment/SKILL.md) - Azure Functions deployment
- [`azure-static-web-apps`](../plugin/skills/azure-static-web-apps/SKILL.md) - Static Web Apps deployment
- [`azure-aca-deployment`](../plugin/skills/azure-aca-deployment/SKILL.md) - Container Apps deployment
- [`azure-app-service-deployment`](../plugin/skills/azure-app-service-deployment/SKILL.md) - App Service deployment
