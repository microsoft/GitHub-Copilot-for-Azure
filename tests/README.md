# Skills Test Suite

Automated testing framework for Azure Copilot Skills using **Jest**. This system validates that skills have correct metadata, trigger on appropriate prompts, and interact with an Agent properly using Copilot SDK.

---

## Table of Contents

- [How the Test System Works](#how-the-test-system-works)
- [When Tests Run](#when-tests-run)
- [What Tests Validate](#what-tests-validate)
- [Running Tests Locally](#running-tests-locally)
- [Running Tests on CI](#running-tests-on-ci)
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
4. **Tests execute** - execute test code and generate output

There are 3 types of tests.

- unit test: tests that validate the file structure of a skill and the content.
- trigger test: tests that validate if the description of a skill can trigger or not trigger a given prompt using a heuristic.
- integration test: tests that validate if the skill can lead to successful completion of a task by running a given prompt against a Copilot SDK agent.

See [What Tests Validate](#what-tests-validate) for more details.

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
- `SKILL.md` exists and has valid frontmatter (`name`, `description`)
- Description is meaningful (not empty, appropriate length)
- Content contains expected sections
- Any validation rules documented in the skill work correctly

### 2. Trigger Tests (`triggers.test.ts`)

**Purpose:** Verify the skill activates on correct prompts and ignores unrelated ones.

**What it checks:**
- Prompts mentioning skill-relevant keywords trigger the skill
- Unrelated prompts do NOT trigger the skill
- Edge cases (empty input, very long input) are handled
- Snapshot of extracted keywords (catches unintended changes)

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

### Waza Eval Mode (Alternative)

Skills can also be evaluated using [waza](https://github.com/spboyer/waza), a Go CLI for skill benchmarking.

```bash
# Install waza via azd extension
azd ext source add -n waza -t url -l https://raw.githubusercontent.com/spboyer/waza/main/registry.json
azd ext install microsoft.azd.waza

# Or via Go
go install github.com/spboyer/waza/cmd/waza@latest
```

**Hybrid model**: Key skills have committed (hand-tuned) eval suites. All other skills auto-generate evals from their SKILL.md at runtime.

| Command | Use Case |
|---------|----------|
| `npm run waza -- azure-prepare` | Run committed eval for a key skill |
| `npm run waza -- azure-storage` | Auto-generate + run eval from SKILL.md |
| `npm run waza -- --all` | Run all skills (committed + generated) |
| `npm run waza:live -- azure-prepare` | Run with real Copilot SDK |
| `waza run tests/azure-prepare/eval/eval.yaml -v` | Run directly with waza CLI |
| `waza run eval.yaml --cache` | Cached re-runs (skip unchanged tasks) |
| `waza compare results-a.json results-b.json` | Compare results across models |
| `waza check plugin/skills/azure-prepare` | Check skill readiness for submission |

**Committed eval suites** (⬢ customized graders, fixtures, and assertions):
- `azure-prepare` — template selection, recipe composition, plan-first workflow

**Auto-generated** (⬡ from SKILL.md frontmatter): all other skills

See [tests/azure-prepare/eval/README.md](azure-prepare/eval/README.md) for the committed eval suite documentation.

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

**AgentMetadata:** Integration tests will write an AgentMetadata markdown file to `tests/reports/test-run-{timestamp or TEST_RUN_ID}/...` capturing events during the test execution.

### Generating Report
You can generate a report on the **Debug** logs using:

| Command | Use Case |
|---------|----------|
| `npm run report -- --skill skill-name` | Generates a report for a skill of the most recent run. |

---

## Running Tests on CI

All workflows are defined in `.github/workflows/`. Trigger them from the **Actions** tab in GitHub.

| Pipeline | Workflow File | Trigger | What It Runs |
|----------|---------------|---------|--------------|
| Test All Skills - non-integration | `test-all-skills.yml` | Push to `main`, PRs, or manual | Unit + trigger tests (no Azure auth) |
| Integration Tests - all | `test-all-integration.yml` | Manual only | Integration tests for selected skills |
| Integration Tests - azure-deploy | `test-azure-deploy.yml` | Manual only | Deployment tests for `azure-deploy` |

### How to Manually Trigger Each Workflow

**Test All Skills - non-integration:** Go to **Actions → Test All Skills - non-integration → Run workflow**. Optionally enter a skill name to scope the run, or leave empty for all skills.

**Integration Tests - all:** Go to **Actions → Integration Tests - all → Run workflow**. Enter a comma-separated list of skills (e.g. `azure-validate,azure-storage,azure-ai`). Skill names must match test folder names under `tests/`. If `azure-deploy` is included in the input, you can optionally enter a comma delimited list of test patterns to filter its tests to run. Optionally enable `debug` for detailed logs.

**Integration Tests - azure-deploy:** Go to **Actions → Integration Tests - azure-deploy → Run workflow**. Optionally enter a comma delimited list of test patterns to filter by test name or `describe` block (e.g. `static-web-apps-deploy`, `Terraform`, `"creates todo list"`). Leave empty to run all deploy tests.

> **⏱ Deploy test timing:** Each deploy test can take up to **30 minutes**, and brownfield tests up to **45 minutes**. Each pipeline job has a **6-hour maximum** execution time limit. The workflows by default breaks down the tests and run them in separate jobs. If you added more tests and made any of the default group of tests exceeding the time limit, consider further breaking down them.

### CI Notes

- Integration workflows require Azure OIDC credentials (`cideploytest` environment) and a `COPILOT_CLI_TOKEN` secret.
- OIDC tokens are auto-refreshed every 5 minutes to avoid auth expiry during long runs.
- Each skill step uses `continue-on-error: true`, so one failure won't block others.
- Enable the `debug` input to write per-test agent logs under `tests/reports/test-run-{id}/`.
- Skill reports are appended to the **Job Summary** tab and uploaded as artifacts (retained 30 days).

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

```typescript
// In unit.test.ts, triggers.test.ts, integration.test.ts
const SKILL_NAME = 'azure-redis';  // ← Change this to match your skill folder
```

#### Step 3: Add Trigger Prompts

In `triggers.test.ts`, add prompts that should and should NOT trigger your skill:

```typescript
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

```typescript
test('documents cache tiers', () => {
  expect(skill.content).toContain('Basic');
  expect(skill.content).toContain('Standard');
  expect(skill.content).toContain('Premium');
});
```

#### Step 5: Run and Verify

```bash
npm run test:skill -- {skill-name}
```

#### Step 6: Update Coverage Grid

```bash
npm run coverage:grid
```

This updates the Skills Coverage Grid in this README.

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
| azure-hosted-copilot-sdk | ✅ | ✅ | ✅ | ✅ | - |
| azure-keyvault-expiration-audit | ✅ | ✅ | ✅ | ✅ | - |
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

1. Check Node.js version
2. Ensure `package-lock.json` is committed
3. Look for environment-dependent code

---

## Additional Resources

- **[AGENTS.md](./AGENTS.md)** - Detailed testing patterns for AI agents
- **[_template/README.md](./_template/README.md)** - Template usage guide
- **[Jest Documentation](https://jestjs.io/docs/getting-started)** - Jest testing framework
