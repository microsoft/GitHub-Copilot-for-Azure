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
│  jest.config.ts     → Configures Jest (reporters, coverage)     │
│  jest.setup.ts      → Global test utilities & custom matchers   │
│  utils/             → Shared helpers (skill-loader, mcp-mock)   │
│  {skill}/           → Per-skill test files                      │
└─────────────────────────────────────────────────────────────────┘
```

### Test Flow

1. **Jest discovers tests** matching `**/*.test.ts` (excluding `_template/`)
2. **`jest.setup.ts` runs first** - sets up global paths and custom matchers
3. **Each test file loads its skill** via `utils/skill-loader.ts`
4. **Tests execute** - validating metadata, triggers, and MCP interactions
5. **Results output** to console (human-readable) and `reports/junit.xml` (CI)

### Key Utilities

| Utility | Purpose |
|---------|---------|
| `utils/skill-loader.ts` | Parses `SKILL.md` frontmatter and content |
| `utils/trigger-matcher.ts` | Tests if prompts should activate a skill |
| `utils/fixtures.ts` | Loads test data from `fixtures/` folders |
| `utils/agent-runner.ts` | Copilot SDK agent runner for integration tests |

---

## When Tests Run

### Automatic (CI/CD)

| Trigger | What Runs | Workflow File |
|---------|-----------|---------------|
| **Push to `main`** affecting `tests/**` or `plugin/skills/**` | Full test suite | `test-all-skills.yml` |
| **Pull Request** affecting `tests/**` or `plugin/skills/**` | Full test suite | `test-all-skills.yml` |
| **Manual dispatch** | Full suite or single skill | `test-all-skills.yml` |

### Running a Single Skill in CI

Use the **workflow_dispatch** trigger with the `skill-name` input:

1. Go to **Actions** → **Test All Skills**
2. Click **Run workflow**
3. Enter a skill name (e.g., `azure-validation`) or leave empty for all skills

### Local Development

Run tests manually anytime during development (see [Running Tests Locally](#running-tests-locally)).

---

## What Tests Validate

### 1. Unit Tests (`unit.test.ts`)

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

### 2. Trigger Tests (`triggers.test.ts`)

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

**Purpose:** Test skill behavior with a real Copilot agent session.

**What it checks:**
- ✅ Skill is invoked by the agent for relevant prompts
- ✅ Agent response contains expected content
- ✅ Azure MCP tool calls succeed

**Prerequisites:**
1. Install Copilot CLI: `npm install -g @github/copilot-cli`
2. Authenticate: Run `copilot` and follow prompts

**Example:**
```typescript
import { run, isSkillInvoked, doesAssistantMessageIncludeKeyword, shouldSkipIntegrationTests } from '../utils/agent-runner';

const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration('azure-role-selector - Integration Tests', () => {
  test('invokes skill for relevant prompt', async () => {
    const agentMetadata = await run({
      prompt: 'What role should I assign for Azure Container Registry access?'
    });

    expect(isSkillInvoked(agentMetadata, 'azure-role-selector')).toBe(true);
    expect(doesAssistantMessageIncludeKeyword(agentMetadata, 'AcrPull')).toBe(true);
  });
});
```

**Note:** Integration tests are skipped in CI (no auth) and when `SKIP_INTEGRATION_TESTS=true`.

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
| `npm test` | Run all tests (unit + trigger) |
| `npm run test:unit` | Run unit and trigger tests only (fast, no auth) |
| `npm run test:integration` | Run integration tests (requires Copilot CLI auth) |
| `npm run test:ci` | Run tests for CI (excludes integration tests) |
| `npm test -- --testPathPattern=azure-validation` | Run tests for one skill |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:verbose` | Show individual test names |
| `npm run update:snapshots` | Update Jest snapshots after intentional changes |

### Integration Tests

Integration tests run **automatically when possible** but skip gracefully when:
- Running in CI (`CI=true`)
- `@github/copilot-sdk` is not installed
- Copilot CLI is not authenticated

When skipped, a message explains why:
```
⏭️  Skipping integration tests: Running in CI environment
```

To run integration tests locally:

```bash
# 1. Ensure you're authenticated
copilot --help  # Should show help, not login prompt

# 2. Run tests (integration will run automatically if SDK is available)
npm test
```

Environment variables:
- `SKIP_INTEGRATION_TESTS=true` - Force skip integration tests
- `CI=true` - Automatically set in CI; always skips integration tests

### Example: Test a Specific Skill

```bash
cd tests
npm test -- --testPathPattern=azure-validation

# Output:
# PASS azure-validation/unit.test.ts
# PASS azure-validation/triggers.test.ts
# Test Suites: 2 passed, 2 total
```

### Reading Test Output

**Console output:**
```
PASS SKILLS azure-validation/unit.test.ts
  azure-validation - Unit Tests
    Skill Metadata
      ✓ has valid SKILL.md with required fields (2 ms)
      ✓ description mentions validation or pre-deployment
```

**CI output:** JUnit XML at `tests/reports/junit.xml` - parsed by GitHub Actions for PR annotations.

---

## Adding Tests for a New Skill

### 🤖 Quick Scaffold with Copilot

Just run this prompt in GitHub Copilot CLI:

```
Scaffold tests for the skill "azure-redis"
```

That's it. Copilot will read `tests/AGENTS.md` and create a complete test suite following all the patterns.

> **Tip:** Replace `azure-redis` with any skill name from `/plugin/skills/`

---

### Manual Steps

If you prefer to create tests manually:

#### Step 1: Copy the Template

```bash
cd tests
cp -r _template {skill-name}
# Example: cp -r _template azure-redis
```

#### Step 2: Update the Skill Name

Edit each test file and change the `SKILL_NAME` constant:

```javascript
// In unit.test.ts, triggers.test.ts, integration.test.ts
const SKILL_NAME = 'azure-redis';  // ← Change this to match your skill folder
```

#### Step 3: Add Trigger Prompts

In `triggers.test.ts`, add prompts that should and should NOT trigger your skill:

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

#### Step 4: Customize Unit Tests

In `unit.test.ts`, add tests specific to your skill's content:

```javascript
test('documents cache tiers', () => {
  expect(skill.content).toContain('Basic');
  expect(skill.content).toContain('Standard');
  expect(skill.content).toContain('Premium');
});
```

#### Step 5: Run and Verify

```bash
npm test -- --testPathPattern={skill-name}
```

#### Step 6: Update Coverage Grid

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
- [ ] All tests pass locally
- [ ] Ran `npm run coverage:grid` to update README

---

## Directory Structure

```
tests/
├── README.md                 # This file - developer guide
├── AGENTS.md                 # AI agent testing patterns
├── package.json              # Dependencies (jest, jest-junit, @github/copilot-sdk)
├── jest.config.ts            # Jest configuration
├── jest.setup.ts             # Global setup, custom matchers
│
├── _template/                # 📋 Copy this for new skills
│   ├── unit.test.ts          #    Metadata & logic tests
│   ├── triggers.test.ts      #    Prompt activation tests
│   ├── integration.test.ts   #    Real agent tests (optional)
│   ├── fixtures/             #    Test data
│   └── README.md             #    Template usage guide
│
├── utils/                    # 🔧 Shared test utilities
│   ├── skill-loader.ts       #    Load & parse SKILL.md
│   ├── trigger-matcher.ts    #    Test prompt → skill matching
│   ├── fixtures.ts           #    Load test fixtures
│   └── agent-runner.ts       #    Copilot SDK agent runner
│
├── scripts/                  # 📜 Helper scripts
│   └── generate-coverage-grid.js    # Update README coverage table
│
├── azure-validation/         # ✅ Example: fully tested skill
│   ├── unit.test.ts
│   ├── triggers.test.ts
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
| appinsights-instrumentation | ✅ | ✅ | ✅ | ✅ | - |
| azure-ai | ✅ | ✅ | ✅ | ✅ | - |
| azure-aigateway | ✅ | ✅ | ✅ | ✅ | - |
| azure-cost-estimation | ✅ | ✅ | ✅ | ✅ | - |
| azure-cost-optimization | ✅ | ✅ | ✅ | ✅ | - |
| azure-deploy | ✅ | - | - | ✅ | - |
| azure-diagnostics | ✅ | - | - | ✅ | - |
| azure-functions | ✅ | - | - | ✅ | - |
| azure-keyvault-expiration-audit | ✅ | ✅ | ✅ | ✅ | - |
| azure-kusto | ✅ | - | - | ✅ | - |
| azure-networking | ✅ | - | - | ✅ | - |
| azure-nodejs-production | ✅ | - | - | ✅ | - |
| azure-observability | ✅ | - | - | ✅ | - |
| azure-postgres | ✅ | - | - | ✅ | - |
| azure-prepare | ✅ | - | - | ✅ | - |
| azure-quick-review | ✅ | ✅ | ✅ | ✅ | - |
| azure-resource-visualizer | ✅ | - | - | ✅ | - |
| azure-role-selector | ✅ | ✅ | ✅ | ✅ | - |
| azure-security | ✅ | - | - | ✅ | - |
| azure-security-hardening | ✅ | - | - | ✅ | - |
| azure-storage | ✅ | - | - | ✅ | - |
| azure-validate | ✅ | ✅ | ✅ | ✅ | - |
| entra-app-registration | ✅ | ✅ | ✅ | ✅ | - |
| microsoft-foundry | ✅ | ✅ | ✅ | ✅ | - |

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
