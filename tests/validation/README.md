# Azure Validation Tests

Automated tests for the `azure-validation` and `azure-deployment-preflight` skills. These tests verify validation logic for Azure resource naming, Bicep file detection, and preflight checks.

---

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Coverage](#test-coverage)
- [Adding New Tests](#adding-new-tests)

---

## Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
cd tests/validation
npm install
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern="resourceName"
```

### Expected Output

```
Test Suites: 4 passed, 4 total
Tests:       110+ passed, 110+ total
Time:        ~0.5s
```

---

## Test Structure

```
tests/validation/
├── README.md
├── package.json
├── jest.config.js
├── src/
│   └── validators/
│       ├── resourceNameValidator.js    # Azure resource naming rules
│       ├── bicepValidator.js           # Bicep file detection & validation
│       └── preflightValidator.js       # Preflight check utilities
├── fixtures/
│   ├── bicep/
│   │   ├── valid-resourcegroup.bicep   # Resource group scoped
│   │   ├── valid-subscription.bicep    # Subscription scoped
│   │   ├── invalid-syntax.bicep        # Intentional errors
│   │   └── with-params/
│   │       ├── main.bicep
│   │       └── main.bicepparam
│   └── projects/
│       ├── azd-project/
│       │   └── azure.yaml
│       └── standalone-bicep/
│           └── main.bicep
└── __tests__/
    ├── resourceNameValidator.test.js   # Naming constraint tests
    ├── bicepValidator.test.js          # Bicep detection tests
    ├── preflightValidator.test.js      # Preflight utility tests
    └── integration.test.js             # End-to-end scenarios
```

---

## Test Coverage

### Resource Naming Validation

| Resource | Tests | Key Constraints |
|----------|-------|-----------------|
| Storage Account | 12 | 3-24 chars, lowercase+numbers only |
| Key Vault | 8 | 3-24 chars, alphanumerics+hyphens, must start with letter |
| Container Registry | 6 | 5-50 chars, alphanumerics only (no hyphens!) |
| Container App | 6 | 2-32 chars, lowercase+numbers+hyphens |
| App Service | 4 | 2-60 chars, alphanumerics+hyphens |
| Function App | 2 | Same as App Service |
| Resource Group | 4 | 1-90 chars, alphanumerics+hyphens+underscores+periods |
| Cosmos DB | 4 | 3-44 chars, lowercase+numbers+hyphens |

### Bicep Validation

| Feature | Tests |
|---------|-------|
| Target scope detection | 7 |
| CLI command mapping | 5 |
| Parameter file discovery | 5 |
| azd project detection | 4 |
| Bicep error parsing | 4 |
| Content validation (security) | 5 |

### Preflight Validation

| Feature | Tests |
|---------|-------|
| Azure CLI output parsing | 3 |
| Version parsing/comparison | 8 |
| Tool validation | 3 |
| Required tools detection | 5 |
| Validation fallback logic | 5 |
| Report generation | 6 |

---

## Adding New Tests

### Adding a New Resource Type

1. Add constraints to `src/validators/resourceNameValidator.js`:

```javascript
const RESOURCE_CONSTRAINTS = {
  // ... existing
  newResource: {
    name: 'New Resource',
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-z][a-z0-9-]*$/,
    patternDescription: 'lowercase letters, numbers, and hyphens',
    globallyUnique: true
  }
};
```

2. Add tests to `__tests__/resourceNameValidator.test.js`:

```javascript
describe('New Resource', () => {
  const resourceType = 'newResource';
  
  test('accepts valid name', () => {
    const result = validateResourceName('my-new-resource', resourceType);
    expect(result.valid).toBe(true);
  });
  
  test('rejects invalid characters', () => {
    const result = validateResourceName('UPPERCASE', resourceType);
    expect(result.valid).toBe(false);
  });
});
```

### Adding a New Bicep Validation Rule

1. Add validation logic to `src/validators/bicepValidator.js`:

```javascript
function validateBicepContent(content) {
  // ... existing checks
  
  // New check
  if (/* some condition */) {
    warnings.push({
      type: 'new-category',
      message: 'Description of the issue'
    });
  }
}
```

2. Add tests to `__tests__/bicepValidator.test.js`.

---

## Related Documentation

- [azure-validation SKILL.md](../../plugin/skills/azure-validation/SKILL.md)
- [azure-deployment-preflight SKILL.md](../../plugin/skills/azure-deployment-preflight/SKILL.md)
- [Azure naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules)
