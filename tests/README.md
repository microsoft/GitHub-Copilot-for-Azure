# Azure Deploy Skill Tests

Detection and classification tests for the `azure-deploy` skill, verifying that different application types are correctly mapped to the appropriate Azure services.

## Quick Start

```bash
cd tests
npm install
npm test
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Watch mode - re-runs on file changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run typecheck` | Verify TypeScript types |

## Project Structure

```
tests/
├── detection/                    # Test files
│   ├── service-selection.test.ts # Tests service routing
│   ├── confidence-assessment.test.ts # Tests confidence levels
│   └── app-detection.test.ts     # Tests framework detection
├── fixtures/
│   ├── expectations.json         # Expected detection results
│   └── projects/                 # Sample project structures
│       ├── react-vite/           # React + Vite → Static Web Apps
│       ├── functions-node/       # Node.js Functions → Azure Functions
│       ├── docker-node/          # Dockerfile → Container Apps
│       └── ...
├── utils/
│   ├── project-scanner.ts        # Detection logic
│   └── fixture-loader.ts         # Fixture utilities
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Test Coverage

The tests verify detection for these Azure services:

### Static Web Apps
- React (Vite)
- Vue (Vite)
- Angular
- Next.js (static export)
- Gatsby
- Astro
- Plain HTML

### Azure Functions
- Node.js (host.json + function.json)
- Python v2 (function_app.py)
- .NET (AzureFunctionsVersion in csproj)

### Container Apps
- Dockerfile
- docker-compose.yml

### App Service
- Next.js (SSR)
- Express.js
- Flask
- Django
- FastAPI
- ASP.NET Core
- Spring Boot

### Multi-Service (azd)
- Projects with azure.yaml

## Adding New Fixtures

1. **Create fixture folder:**
   ```bash
   mkdir tests/fixtures/projects/my-new-fixture
   ```

2. **Add minimal files** that identify the app type:
   - `package.json` for Node.js apps
   - `requirements.txt` for Python apps
   - `Dockerfile` for containerized apps
   - etc.

3. **Add expected result** to `tests/fixtures/expectations.json`:
   ```json
   {
     "my-new-fixture": {
       "service": "static-web-apps",
       "confidence": "MEDIUM",
       "framework": "my-framework"
     }
   }
   ```

4. **Run tests** to verify:
   ```bash
   npm test
   ```

## Detection Logic

The scanner follows this priority order:

1. **Azure Configuration Files (HIGH confidence)**
   - `azure.yaml` → azd-multi-service
   - `host.json` / `function.json` → Azure Functions
   - `function_app.py` → Azure Functions (Python v2)
   - `Dockerfile` / `docker-compose.yml` → Container Apps
   - `staticwebapp.config.json` → Static Web Apps

2. **Framework Detection (MEDIUM confidence)**
   - Node.js: Next.js, Nuxt, Angular, Vite, Gatsby, Astro, Express, etc.
   - Python: Flask, Django, FastAPI
   - .NET: ASP.NET Core, Blazor WebAssembly
   - Java: Spring Boot

3. **Static Fallback (MEDIUM confidence)**
   - `index.html` without build system → Static Web Apps

## CI Integration

Tests run automatically on PR/push when `plugin/skills/**` or `tests/**` change.

See `.github/workflows/test.yml` for the workflow configuration.
