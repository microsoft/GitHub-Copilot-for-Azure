# Copilot Instructions for GitHub Copilot for Azure

## Repository Overview

This repository contains agent skills for GitHub Copilot's Azure integration. Skills provide specialized capabilities for deployment, validation, diagnostics, and Azure service management.

---

## Directory Structure

```
plugin/
└── skills/
    └── <skill-name>/
        ├── SKILL.md          # Skill definition (required)
        └── reference/        # Reference guides (optional)

tests/
├── detection/                # App type detection tests (264 tests)
│   ├── __tests__/
│   ├── fixtures/
│   ├── src/
│   └── package.json
├── nodejs-production/        # Node.js production readiness tests (83 tests)
│   ├── __tests__/
│   ├── fixtures/
│   ├── src/
│   └── package.json
├── validation/               # Azure validation tests (165 tests)
│   ├── __tests__/
│   ├── fixtures/
│   ├── src/
│   └── package.json
└── README.md

.github/
├── agents/                   # Custom agent definitions
├── workflows/                # CI/CD workflows
└── ISSUE_TEMPLATE/
```

---

## Skill Development

### Skill File Format

Every skill requires a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: Brief description of what the skill does. Include trigger phrases.
---

## Skill content and instructions...
```

### Key Guidelines

- **Use `azd` for deployments** - Azure Developer CLI, not `az` CLI
- **Reference guides** - Place detailed service-specific docs in `reference/` subdirectory
- **MCP tools** - Document which Azure MCP tools the skill uses
- **Detection logic** - If the skill involves app detection, follow patterns in `azure-deploy`

---

## Testing

### Test Structure

Tests are organized into focused suites, each with its own `package.json`:

| Suite | Location | Tests | Purpose |
|-------|----------|-------|---------|
| **Detection** | `tests/detection/` | 264 | App type detection, service selection |
| **Node.js Production** | `tests/nodejs-production/` | 83 | Production readiness validation |
| **Validation** | `tests/validation/` | 165 | Azure resource validation, Bicep, preflight |

### Running Tests

```bash
# Detection tests
cd tests/detection && npm test

# Node.js production tests
cd tests/nodejs-production && npm test

# Validation tests
cd tests/validation && npm test
```

### Test Expectations

- **Detection tests**: 264+ tests, all should pass
- **Node.js production tests**: 83+ tests
- **Validation tests**: 165+ tests

---

## Adding Tests

### ⚠️ IMPORTANT: Only Add Tests to Existing Suites

**DO NOT create new test suites or test areas.** Add tests only to existing coverage areas:

- `tests/__tests__/detection/` - Detection logic tests
- `tests/nodejs-production/` - Node.js production readiness
- `tests/validation/` - Azure validation (naming, Bicep, preflight)

### When to Add Tests

Add tests when:
- ✅ A new skill is added that affects detection logic
- ✅ A new function is added to an existing tested module
- ✅ A bug is fixed in tested code
- ✅ A new framework or service needs detection

Do NOT add tests when:
- ❌ The change is in an untested area (e.g., AI skills, database skills)
- ❌ Creating a new test suite would be required
- ❌ The skill doesn't have detection or validation logic

### Adding Detection Tests

1. **Add fixture** (if testing a new project type):
   ```bash
   mkdir -p tests/fixtures/projects/my-new-framework
   # Add minimal config files for detection
   ```

2. **Update expectations** in `tests/fixtures/expectations.json`:
   ```json
   {
     "my-new-framework": {
       "service": "app-service",
       "skill": "azure-deploy",
       "confidence": "MEDIUM",
       "framework": "MyFramework"
     }
   }
   ```

3. **Update detection logic** (if new pattern):
   - `tests/src/detection/filePatterns.js` - Add file patterns
   - `tests/src/detection/appTypeDetector.js` - Add detection logic

4. **Run tests** to verify:
   ```bash
   cd tests && npm test
   ```

### Adding Validation Tests

Add to existing test files in `tests/validation/__tests__/`:
- `resourceNameValidator.test.js` - Azure resource naming
- `bicepValidator.test.js` - Bicep file validation
- `preflightValidator.test.js` - Preflight checks
- `integration.test.js` - End-to-end scenarios

### Keeping Tests Updated

When making changes to skills or detection logic:

1. **Check if tests exist** for the affected area
2. **Update tests** to match new behavior
3. **Update expectations.json** if service mappings change
4. **Run all test suites** before committing:
   ```bash
   cd tests && npm test
   cd tests/nodejs-production && npm test
   cd tests/validation && npm test
   ```

---

## Skill Routing

All deployment scenarios route to `azure-deploy` skill with reference guides:

| Detection Signal | Service | Reference Guide |
|------------------|---------|-----------------|
| `azure.yaml` | Azure Developer CLI | - |
| `Dockerfile`, `docker-compose.yml` | Container Apps | `reference/container-apps.md` |
| `host.json`, `function.json` | Azure Functions | `reference/functions.md` |
| `staticwebapp.config.json` | Static Web Apps | `reference/static-web-apps.md` |
| Express, Flask, Django, etc. | App Service | `reference/app-service.md` |

---

## Code Style

- **JavaScript/Node.js** - Use ES modules, Jest for testing
- **Markdown** - Use ATX-style headers (`#`), fenced code blocks
- **YAML** - 2-space indentation
- **Avoid over-commenting** - Code should be self-documenting

---

## Pull Requests

- Include test updates when changing detection or validation logic
- Verify all existing tests pass
- Update README files if adding new test coverage
- Reference related issues or PRs in commit messages
