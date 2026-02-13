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
| **Push to `main`** affecting `tests/**` or `plugin/skills/**` | non-integration test suite | `test-all-skills.yml` |
| **Pull Request** affecting `tests/**` or `plugin/skills/**` | non-integration test suite | `test-all-skills.yml` |
| **Manual dispatch** | non-integration test suite for all skills or single skill | `test-all-skills.yml` |
| **Manual dispatch** | integration test suite for azure-deploy tests | `test-azure-deploy.yml` |
| **Manual dispatch** | integration test for selected skills | `test-all-integration.yml` |

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

### 3. Integration Tests (`integration.test.ts`)

**Purpose:** Test skill behavior with a real Copilot agent session.

**What it checks:**
- Skill is invoked by the agent for relevant prompts
- Agent response contains expected content
- Azure MCP tool calls succeed
- Any change to the environment that you expect the agent to make, such as edits to files in the workspace, CLI commands executed in the terminal, etc.

**Prerequisites:**
1. Install Copilot CLI: `npm install -g @github/copilot-cli`
2. Authenticate: Run `copilot` and follow prompts

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
| `npm run test:integration` | Run integration tests (requires Copilot CLI auth, az auth, azd auth) |
| `npm run test:integration -- azure-deploy` | Run integration tests for a specific skill |
| `npm run test:integration -- azure-deploy static-web-apps-deploy` | Run integration tests for a specific describe group |
| `npm run test:integration -- azure-deploy "creates simple containerized Node.js"` | Run a specific test |
| `npm run test:skill -- azure-ai` | Run all tests for a specific skill |
| `npm run test:ci` | Run tests for CI (excludes integration tests) |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:verbose` | Show individual test names |
| `npm run update:snapshots` | Update Jest snapshots after intentional changes |

### Integration Tests

To run integration tests locally:

```bash
# 1. (Optional) Authenticate with tools if the test depends on them
az login
az account list --output table
az account set --subscription "x"   # Select a default subscription from the table. 
azd auth login

# 2. Run tests (integration will run automatically if SDK is available)
npm run test:integration skill-name [group-name]
```

### Example: Test a Specific Skill

```bash
cd tests
env:DEBUG="1"
npm run test:skill -- azure-validation
```

### Example: Test a Specific Subset of a Test
To run only the SWA tests from the deploy integration test suite: 

```bash
cd tests
npm run test:integration -- azure-deploy static-web-apps-deploy
```

Test cases are grouped under the `describe` groups. It's commonly useful to use the title of the `describe` group as the 2nd argument to run test cases of that group.

To learn more about how the CLI options work, check out `tests/scripts/run-tests.js`.

### Reading Test Output

**Console output:**

**CI output:** JUnit XML at `tests/reports/junit.xml` - parsed by GitHub Actions for PR annotations.

**Debug Mode:** When environment variable `DEBUG=1` is set, logs will be recorded under `tests/reports/test-run-{timestamp or TEST_RUN_ID}/...` (typically with per-test subdirectories).


### Generating Report
You can generate a report on the **Debug** logs using:

| Command | Use Case |
|---------|----------|
| `npm run report -- --skill skill-name` | Generates a report for a skill of the most recent run. |

---

## Adding Tests for a New Skill

### 🤖 Quick Scaffold with Copilot

Just run this prompt in GitHub Copilot CLI:

```
Scaffold tests for the skill "azure-redis"
```

That's it. Copilot will read `tests/AGENTS.md` and create a complete test suite following all the patterns.

> **Tip:** Replace `azure-redis` with any skill name from `/plugin/skills/`

### Review and fix the AI-generated tests

AI-generated tests commonly miss required setup for the agent to make sense. For example, asking an agent to deploy an app without giving an app to the agent won't make much sense. They also often don't have the fine-grained evaluation checks that would be useful. The test author needs to review the AI generated tests to make sure they are testing valid scenarios and the evaluation checks are sufficient.

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
npm test:skill -- {skill-name}
```

#### Step 6: Update Coverage Grid

```bash
npm run coverage:grid
```

This updates the Skills Coverage Grid in this README.

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
| azure-compliance | ✅ | ✅ | ✅ | ✅ | - |
| azure-cost-optimization | ✅ | ✅ | ✅ | ✅ | - |
| azure-deploy | ✅ | ✅ | ✅ | ✅ | - |
| azure-diagnostics | ✅ | ✅ | ✅ | ✅ | - |
| azure-kusto | ✅ | - | - | ✅ | - |
| azure-observability | ✅ | - | - | ✅ | - |
| azure-postgres | ✅ | - | - | ✅ | - |
| azure-prepare | ✅ | - | - | ✅ | - |
| azure-quick-review | ✅ | ✅ | ✅ | ✅ | - |
| azure-resource-visualizer | ✅ | - | - | ✅ | - |
| azure-rbac | ✅ | ✅ | ✅ | ✅ | - |
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
