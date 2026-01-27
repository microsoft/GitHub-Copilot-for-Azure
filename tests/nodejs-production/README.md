# Node.js Production Tests

Tests for the `azure-nodejs-production` skill, which validates Express.js applications for Azure production best practices.

## Overview

This test suite validates that Node.js/Express apps have proper configuration for running in production on Azure. The skill covers:

- **Trust Proxy** - Required behind Azure load balancers/App Gateway
- **Health Endpoints** - For Azure App Service health checks
- **Cookie Security** - Proper sameSite, secure, httpOnly settings
- **Port Binding** - Using `process.env.PORT` for Azure compatibility
- **Host Binding** - Using `0.0.0.0` instead of `localhost` for containers
- **Dockerfile Best Practices** - NODE_ENV, HEALTHCHECK, non-root user

## Setup

```bash
cd tests/nodejs-production
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
tests/nodejs-production/
├── __tests__/
│   ├── expressValidator.test.js    # Unit tests for Express validation
│   ├── dockerfileValidator.test.js # Unit tests for Dockerfile validation
│   └── integration.test.js         # Fixture-based integration tests
├── src/validators/
│   ├── expressProductionValidator.js  # Express.js production checks
│   └── dockerfileValidator.js         # Dockerfile production checks
├── fixtures/
│   ├── expectations.json              # Expected results for fixtures
│   └── projects/                      # Sample Express projects
│       ├── express-prod-correct/      # All best practices ✅
│       ├── express-missing-trust-proxy/
│       ├── express-missing-health/
│       ├── express-localhost-bind/
│       └── dockerfile-missing-healthcheck/
├── package.json
├── jest.config.js
└── README.md
```

## Adding New Tests

### Adding a Unit Test

Add test cases to the appropriate test file in `__tests__/`:

```javascript
// __tests__/expressValidator.test.js
test('detects new pattern', () => {
  const content = `app.someNewPattern()`;
  const result = checkNewPattern(content);
  expect(result.passed).toBe(false);
});
```

### Adding a Fixture Test

1. Create a new project directory in `fixtures/projects/`:
   ```
   fixtures/projects/my-new-fixture/
   ├── server.js
   ├── package.json
   └── Dockerfile (optional)
   ```

2. Add expected results to `fixtures/expectations.json`:
   ```json
   {
     "my-new-fixture": {
       "description": "Description of what this tests",
       "express": {
         "valid": false,
         "errors": ["expected error substring"],
         "checks": {
           "trustProxy": false,
           "healthEndpoint": true
         }
       }
     }
   }
   ```

3. The integration tests will automatically pick up the new fixture.

## Validation Checks

### Express Validation

| Check | What it validates |
|-------|-------------------|
| `trustProxy` | `app.set('trust proxy', 1)` for Azure load balancers |
| `healthEndpoint` | `/health`, `/healthz`, `/ready`, or `/liveness` endpoint |
| `cookieConfig` | `sameSite: 'lax'` and `secure` settings for sessions/cookies |
| `portBinding` | `process.env.PORT` usage instead of hardcoded port |
| `hostBinding` | Binding to `0.0.0.0` instead of `localhost` |

### Dockerfile Validation

| Check | What it validates |
|-------|-------------------|
| `nodeEnvProduction` | `ENV NODE_ENV=production` instruction |
| `healthcheck` | `HEALTHCHECK CMD ...` instruction |
| `nonRootUser` | `USER node` or other non-root user |
| `properBaseImage` | Alpine/slim image with explicit version |

## CI/CD

Tests run automatically via GitHub Actions on:
- Push to `main` affecting `plugin/skills/azure-nodejs-production/` or `tests/nodejs-production/`
- Pull requests to `main` affecting the same paths
- Manual trigger via `workflow_dispatch`

See `.github/workflows/test-nodejs-production.yml`

## Related Skills

- `azure-nodejs-production` - The skill this test suite validates
- `azure-deploy` - App type detection (separate test suite in `tests/`)
