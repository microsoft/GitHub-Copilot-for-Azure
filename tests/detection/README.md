# Azure Skill Detection Tests

Automated tests for the app type detection logic used by Azure deployment skills. When a user asks "what Azure service should I use?", these tests verify the detection logic correctly identifies the appropriate Azure service based on project files and structure.

---

## Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
cd tests/detection
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
tests/detection/
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
├── src/                             # Detection logic implementation
│   ├── appTypeDetector.js           # Core detection algorithm
│   ├── filePatterns.js              # File pattern constants
│   └── serviceMapping.js            # Azure service mappings
│
├── utils/
│   ├── fixture-loader.js            # Loads fixtures and expectations
│   └── project-scanner.js           # Scans real directories
│
├── __tests__/                       # Test suites
│   ├── service-selection.test.js    # Fixture-based tests (iterates over projects/)
│   ├── highConfidence.test.js       # Azure config file tests
│   ├── nodejs.test.js               # Node.js framework tests
│   ├── python.test.js               # Python framework tests
│   ├── dotnet.test.js               # .NET framework tests
│   ├── java.test.js                 # Java framework tests
│   ├── static.test.js               # Pure static site tests
│   ├── multiService.test.js         # Monorepo tests
│   └── confidence.test.js           # Confidence level tests
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
   - Add pattern to `src/filePatterns.js`
   - Add detection logic to `src/appTypeDetector.js`

5. **Run tests:**
   ```bash
   npm test
   ```

### Option 2: Add a Unit Test

Add tests to the appropriate file in `__tests__/`:

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

## Test Coverage

### Deployment Skills Coverage

All deployment scenarios route to the consolidated `azure-deploy` skill:

| Service | Tested | Fixtures |
|---------|--------|----------|
| ✅ Azure Developer CLI (azd) | Yes | `azd-fullstack` |
| ✅ Container Apps | Yes | `docker-node`, `docker-compose-multi` |
| ✅ AKS | ⚠️ Partial | - |
| ✅ App Service | Yes | `express-api`, `flask-app`, `django-app`, etc. |
| ✅ Azure Functions | Yes | `functions-node`, `functions-python`, `functions-dotnet` |
| ✅ Static Web Apps | Yes | `react-vite`, `vue-vite`, `angular`, etc. |

### Framework Detection Coverage

| Language | Framework | Tested |
|----------|-----------|--------|
| **Node.js** | React, Vue, Angular, Next.js, Express, etc. | ✅ |
| **Python** | Flask, Django, FastAPI | ✅ |
| **.NET** | ASP.NET Core, Blazor | ✅ |
| **Java** | Spring Boot | ✅ |
| **Static** | Plain HTML | ✅ |

### High-Confidence Signal Coverage

| Signal | Tested | Service |
|--------|--------|---------|
| `azure.yaml` | ✅ | Azure Developer CLI |
| `host.json` | ✅ | Azure Functions |
| `staticwebapp.config.json` | ✅ | Static Web Apps |
| `Dockerfile` | ✅ | Container Apps |

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

---

## Related Documentation

- [`azure-deploy` SKILL.md](../../plugin/skills/azure-deploy/SKILL.md) - Detection logic source
