# Azure Skill Tests

Automated test suites for Azure deployment skills.

---

## Test Suites

| Suite | Location | Tests | Description |
|-------|----------|-------|-------------|
| **Detection** | `tests/detection/` | 264 | App type detection, service selection, framework detection |
| **Node.js Production** | `tests/nodejs-production/` | 83 | Express.js production best practices |
| **Validation** | `tests/validation/` | 165 | Resource naming, Bicep validation, preflight checks |

**Total: 512 tests**

---

## Running Tests

Each suite is independent with its own `package.json`:

```bash
# Detection tests
cd tests/detection && npm install && npm test

# Node.js production tests
cd tests/nodejs-production && npm install && npm test

# Validation tests
cd tests/validation && npm install && npm test
```

---

## Structure

```
tests/
├── detection/              # App type detection tests
│   ├── __tests__/          # Test files
│   ├── fixtures/           # Project fixtures
│   ├── src/                # Detection logic
│   └── package.json
│
├── nodejs-production/      # Node.js production readiness tests
│   ├── __tests__/
│   ├── fixtures/
│   ├── src/
│   └── package.json
│
├── validation/             # Azure validation tests
│   ├── __tests__/
│   ├── fixtures/
│   ├── src/
│   └── package.json
│
└── README.md               # This file
```

---

## CI Workflows

| Workflow | File | Triggers |
|----------|------|----------|
| Detection | `test-detection.yml` | `azure-deploy` skill, `tests/detection/` |
| Node.js Production | `test-nodejs-production.yml` | `azure-nodejs-production` skill, `tests/nodejs-production/` |
| Validation | `test-validation.yml` | `azure-validation`, `azure-deployment-preflight` skills, `tests/validation/` |

All workflows run on Node.js 20 and 22, with coverage uploads to Codecov.

---

## Adding Tests

⚠️ **Only add tests to existing suites. Do not create new test areas.**

See individual suite READMEs for details:
- [Detection README](detection/README.md)
- [Node.js Production README](nodejs-production/README.md)
- [Validation README](validation/README.md)
