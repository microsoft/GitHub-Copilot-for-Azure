# Skills Test Suite

Automated testing framework for Azure Copilot Skills using **Jest**. This system validates that skills have correct metadata, trigger on appropriate prompts, and interact properly with Azure MCP tools.

---

## Table of Contents

- [How the Test System Works](#how-the-test-system-works)
- [When Tests Run](#when-tests-run)
- [What Tests Validate](#what-tests-validate)
- [Running Tests Locally](#running-tests-locally)
- [Adding Tests for a New Skill](#adding-tests-for-a-new-skill)
- [Directory Structure](#directory-structure)
- [Skills Coverage Grid](#skills-coverage-grid)

---

## How the Test System Works

### Overview

Each skill in `/plugin/skills/{skill-name}/` can have a corresponding test suite in `/tests/{skill-name}/`. Tests use **Jest** as the test runner with these key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Execution                           │
├─────────────────────────────────────────────────────────────────┤
│  jest.config.js     → Configures Jest (reporters, coverage)     │
│  jest.setup.js      → Global test utilities & custom matchers   │
│  utils/             → Shared helpers (skill-loader, mcp-mock)   │
│  {skill}/           → Per-skill test files                      │
└─────────────────────────────────────────────────────────────────┘
```

### Test Flow

1. **Jest discovers tests** matching `**/*.test.js` (excluding `_template/`)
2. **`jest.setup.js` runs first** - sets up global paths and custom matchers
3. **Each test file loads its skill** via `utils/skill-loader.js`
4. **Tests execute** - validating metadata, triggers, and MCP interactions
5. **Results output** to console (human-readable) and `reports/junit.xml` (CI)

### Key Utilities

| Utility | Purpose |
|---------|---------|
| `utils/skill-loader.js` | Parses `SKILL.md` frontmatter and content |
| `utils/trigger-matcher.js` | Tests if prompts should activate a skill |
| `utils/mcp-mock.js` | Mocks Azure MCP tool responses for testing |
| `utils/fixtures.js` | Loads test data from `fixtures/` folders |

---

## When Tests Run

### Automatic (CI/CD)

| Trigger | What Runs | Workflow File |
|---------|-----------|---------------|
| **Push to `main`** affecting `tests/**` or `plugin/skills/**` | Full test suite | `test-all-skills.yml` |
| **Pull Request** affecting `tests/**` or `plugin/skills/**` | Full test suite | `test-all-skills.yml` |
| **Manual dispatch** | Full test suite | `test-all-skills.yml` |

### Per-Skill Workflows (Optional)

You can generate per-skill workflows that only run when that skill changes:

```bash
node scripts/generate-skill-workflows.js
```

This creates `.github/workflows/test-skill-{name}.yml` files that trigger on:
- Changes to `plugin/skills/{skill-name}/**`
- Changes to `tests/{skill-name}/**`

### Local Development

Run tests manually anytime during development (see [Running Tests Locally](#running-tests-locally)).

---

## What Tests Validate

### 1. Unit Tests (`unit.test.js`)

**Purpose:** Validate skill metadata and any embedded logic.

**What it checks:**
- ✅ `SKILL.md` exists and has valid frontmatter (`name`, `description`)
- ✅ Description is meaningful (not empty, appropriate length)
- ✅ Content contains expected sections
- ✅ Any validation rules documented in the skill work correctly

**Example from `azure-validation`:**
```javascript
test('has valid SKILL.md with required fields', () => {
  expect(skill.metadata.name).toBe('azure-validation');
  expect(skill.metadata.description).toBeDefined();
  expect(skill.metadata.description.length).toBeGreaterThan(10);
});

test('documents storage account limits', () => {
  expect(skill.content).toContain('Storage Account');
  expect(skill.content).toMatch(/24/); // 24 char limit
});
```

### 2. Trigger Tests (`triggers.test.js`)

**Purpose:** Verify the skill activates on correct prompts and ignores unrelated ones.

**What it checks:**
- ✅ Prompts mentioning skill-relevant keywords trigger the skill
- ✅ Unrelated prompts do NOT trigger the skill
- ✅ Edge cases (empty input, very long input) are handled
- ✅ Snapshot of extracted keywords (catches unintended changes)

**Example:**
```javascript
const shouldTriggerPrompts = [
  'Validate my Azure storage account name',
  'What are the naming constraints for Azure Key Vault?',
];

test.each(shouldTriggerPrompts)('triggers on: "%s"', (prompt) => {
  const result = triggerMatcher.shouldTrigger(prompt);
  expect(result.triggered).toBe(true);
});
```

**Snapshots:** Trigger tests use Jest snapshots to detect keyword changes. If you intentionally change a skill's trigger behavior, update snapshots with:
```bash
npm run update:snapshots -- --testPathPattern={skill-name}
```

### 3. Integration Tests (`integration.test.js`)

**Purpose:** Test skill behavior when interacting with Azure MCP tools (using mocks).

**What it checks:**
- ✅ Correct MCP tools are called with expected parameters
- ✅ Responses are processed correctly
- ✅ Errors from MCP tools are handled gracefully

**Example:**
```javascript
test('can mock bicep schema for storage account', async () => {
  mcpMock.mockResponse('azure__bicepschema', {
    type: 'Microsoft.Storage/storageAccounts',
    properties: { name: { maxLength: 24 } }
  });

  const result = await mcpMock.call('azure__bicepschema', {
    'resource-type': 'Microsoft.Storage/storageAccounts'
  });

  expect(result.properties.name.maxLength).toBe(24);
  expect(mcpMock.wasCalled('azure__bicepschema')).toBe(true);
});
```

---

## Running Tests Locally

### Setup (First Time)

```bash
cd tests
npm install
```

### Commands

| Command | Use Case |
|---------|----------|
| `npm test` | Run all tests |
| `npm test -- --testPathPattern=azure-validation` | Run tests for one skill |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:verbose` | Show individual test names |
| `npm run update:snapshots` | Update Jest snapshots after intentional changes |

### Example: Test a Specific Skill

```bash
cd tests
npm test -- --testPathPattern=azure-validation

# Output:
# PASS azure-validation/unit.test.js
# PASS azure-validation/triggers.test.js
# PASS azure-validation/integration.test.js
# Test Suites: 3 passed, 3 total
# Tests:       40 passed, 40 total
```

### Reading Test Output

**Console output:**
```
PASS SKILLS azure-validation/unit.test.js
  azure-validation - Unit Tests
    Skill Metadata
      ✓ has valid SKILL.md with required fields (2 ms)
      ✓ description mentions validation or pre-deployment
```

**CI output:** JUnit XML at `tests/reports/junit.xml` - parsed by GitHub Actions for PR annotations.

---

## Adding Tests for a New Skill

### Step 1: Copy the Template

```bash
cd tests
cp -r _template {skill-name}
# Example: cp -r _template azure-redis
```

### Step 2: Update the Skill Name

Edit each test file and change the `SKILL_NAME` constant:

```javascript
// In unit.test.js, triggers.test.js, integration.test.js
const SKILL_NAME = 'azure-redis';  // ← Change this to match your skill folder
```

### Step 3: Add Trigger Prompts

In `triggers.test.js`, add prompts that should and should NOT trigger your skill:

```javascript
const shouldTriggerPrompts = [
  'How do I configure Azure Redis cache?',
  'Set up Redis caching for my Azure app',
  'Azure Redis connection string',
  // Add at least 5 prompts
];

const shouldNotTriggerPrompts = [
  'What is the weather today?',
  'Help me with AWS ElastiCache',  // Wrong cloud
  'Configure PostgreSQL database',  // Wrong service
  // Add at least 5 prompts
];
```

### Step 4: Customize Unit Tests

In `unit.test.js`, add tests specific to your skill's content:

```javascript
test('documents cache tiers', () => {
  expect(skill.content).toContain('Basic');
  expect(skill.content).toContain('Standard');
  expect(skill.content).toContain('Premium');
});
```

### Step 5: Add Integration Tests (If Applicable)

If your skill uses MCP tools, add integration tests with mocks:

```javascript
test('calls redis list tool', async () => {
  mcpMock.mockResponse('azure__redis', {
    caches: [{ name: 'my-cache', tier: 'Standard' }]
  });
  
  const result = await mcpMock.call('azure__redis');
  expect(result.caches).toHaveLength(1);
});
```

### Step 6: Run and Verify

```bash
npm test -- --testPathPattern={skill-name}
```

### Step 7: Update Coverage Grid

```bash
npm run coverage:grid
```

This updates the Skills Coverage Grid in this README.

### Checklist for New Skill Tests

- [ ] Copied `_template/` to `tests/{skill-name}/`
- [ ] Updated `SKILL_NAME` in all test files
- [ ] Added 5+ prompts that SHOULD trigger
- [ ] Added 5+ prompts that should NOT trigger
- [ ] Added unit tests for skill-specific content
- [ ] Added integration tests (if skill uses MCP tools)
- [ ] All tests pass locally
- [ ] Ran `npm run coverage:grid` to update README

---

## Directory Structure

```
tests/
├── README.md                 # This file - developer guide
├── AGENTS.md                 # AI agent testing patterns
├── package.json              # Dependencies (jest, jest-junit)
├── jest.config.js            # Jest configuration
├── jest.setup.js             # Global setup, custom matchers
│
├── _template/                # 📋 Copy this for new skills
│   ├── unit.test.js          #    Metadata & logic tests
│   ├── triggers.test.js      #    Prompt activation tests
│   ├── integration.test.js   #    MCP tool interaction tests
│   ├── fixtures/             #    Test data
│   └── README.md             #    Template usage guide
│
├── utils/                    # 🔧 Shared test utilities
│   ├── skill-loader.js       #    Load & parse SKILL.md
│   ├── trigger-matcher.js    #    Test prompt → skill matching
│   ├── mcp-mock.js           #    Mock Azure MCP tools
│   └── fixtures.js           #    Load test fixtures
│
├── scripts/                  # 📜 Helper scripts
│   ├── generate-coverage-grid.js    # Update README coverage table
│   └── generate-skill-workflows.js  # Create per-skill CI workflows
│
├── azure-validation/         # ✅ Example: fully tested skill
│   ├── unit.test.js
│   ├── triggers.test.js
│   ├── integration.test.js
│   └── __snapshots__/        # Jest snapshot files
│
├── reports/                  # 📊 Generated test reports
│   └── junit.xml             #    CI-compatible test results
│
└── coverage/                 # 📈 Generated coverage reports
    └── index.html            #    HTML coverage viewer
```

---

## Skills Coverage Grid

<!-- COVERAGE_GRID_START -->
| Skill | Tests | Unit | Triggers | Integration | Coverage |
|-------|-------|------|----------|-------------|----------|
| appinsights-instrumentation | ❌ | - | - | - | - |
| azure-ai | ❌ | - | - | - | - |
| azure-aigateway | ❌ | - | - | - | - |
| azure-cli | ❌ | - | - | - | - |
| azure-cosmos-db | ❌ | - | - | - | - |
| azure-cost-optimization | ❌ | - | - | - | - |
| azure-deploy | ❌ | - | - | - | - |
| azure-deployment-preflight | ❌ | - | - | - | - |
| azure-diagnostics | ❌ | - | - | - | - |
| azure-functions | ❌ | - | - | - | - |
| azure-keyvault-expiration-audit | ❌ | - | - | - | - |
| azure-kusto | ❌ | - | - | - | - |
| azure-mcp | ❌ | - | - | - | - |
| azure-networking | ❌ | - | - | - | - |
| azure-nodejs-production | ❌ | - | - | - | - |
| azure-observability | ❌ | - | - | - | - |
| azure-postgres-entra-rbac-setup | ❌ | - | - | - | - |
| azure-quick-review | ❌ | - | - | - | - |
| azure-redis | ❌ | - | - | - | - |
| azure-resource-visualizer | ❌ | - | - | - | - |
| azure-role-selector | ❌ | - | - | - | - |
| azure-security | ❌ | - | - | - | - |
| azure-security-hardening | ❌ | - | - | - | - |
| azure-sql-database | ❌ | - | - | - | - |
| azure-storage | ❌ | - | - | - | - |
| azure-validation | ✅ | ✅ | ✅ | ✅ | - |
| entra-app-registration | ❌ | - | - | - | - |
| microsoft-foundry | ❌ | - | - | - | - |

**Legend:** ✅ Exists | ❌ Missing | Coverage shown as percentage
<!-- COVERAGE_GRID_END -->

---

## Troubleshooting

### "Cannot find module '../utils/skill-loader'"

You're running tests from the wrong directory. Always run from `/tests`:
```bash
cd tests
npm test
```

### Snapshot Test Failures

If trigger keywords changed intentionally:
```bash
npm run update:snapshots -- --testPathPattern={skill-name}
git diff  # Review changes before committing
```

If the change was unintentional, investigate why keywords changed.

### "SKILL.md not found"

Ensure the skill name in your test matches the folder name in `/plugin/skills/`:
```javascript
const SKILL_NAME = 'azure-validation';  // Must match folder exactly
```

### Tests Pass Locally but Fail in CI

1. Check Node.js version (CI uses Node 20)
2. Ensure `package-lock.json` is committed
3. Look for environment-dependent code

---

## Additional Resources

- **[AGENTS.md](./AGENTS.md)** - Detailed testing patterns for AI agents
- **[_template/README.md](./_template/README.md)** - Template usage guide
- **[Jest Documentation](https://jestjs.io/docs/getting-started)** - Jest testing framework
