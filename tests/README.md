# Skills Test Suite

This directory contains the runners, custom Vally extensions, reporting utilities, and CI configuration used to test the repository's agent skills.

Skills have deterministic unit tests and non-deterministic integration tests.

Skill unit tests are Vitest test cases. They are optional. They can be helpful in validating scripts to make sure they produce expected results when executed in the expected ways by the agent.

```text
tests/<plugin-dirname>/<skill-name>/*.test.ts
```

Skill integration tests are Vally eval suites. They are required. Their source files live under [../evals](../evals), organized by plugin and skill:

```text
evals/<plugin-dirname>/<skill-name>/*.yaml
```

Vitest is also used for unit tests of the testing infrastructure in this directory.

## Project Layout

| Path | Purpose |
| --- | --- |
| [../evals](../evals) | Vally eval suites and fixtures |
| [run-vally-test.ts](./run-vally-test.ts) | Repository wrapper for running skill evals |
| [vally](./vally) | Custom executor, graders, tag helpers, and Vally utilities |
| [skills.json](./skills.json) | Plugin and skill inventory with nightly schedules |
| [comparison](./comparison) | Comparison-run tooling |
| [scripts](./scripts) | Unit-test, reporting, and artifact utilities |
| `results/` | Raw local Vally results and trajectories |
| `reports/` | Processed local reports and dashboard-compatible artifacts |

## Authoring Evals

Use [AGENTS.md](./AGENTS.md) as the repository guide for creating and maintaining skill evals. It covers test design, fixtures, graders, required tags, local execution, and nightly test registration.

Eval files belong in [../evals](../evals), not in this directory. Prefer extending an existing skill suite over creating overlapping coverage.

Validate eval definitions from the repository's `scripts` directory:

```bash
cd scripts
npm run vally validate-stimulus
```

## Running Evals

Install the test dependencies and authenticate the GitHub Copilot CLI before running evals locally. Then run a skill from this directory:

```bash
cd tests
npm install
npm run test:vally -- --plugin azure-skills --skill azure-ai
```

The runner accepts additional Vally arguments. It manages output directories and converts results into the format consumed by the integration-test dashboard.

Local artifacts are written to `results/<test-run-name>/` and `reports/<test-run-name>/`.

### Azure permissions

Add `azurePermission: read` to a stimulus's tags to use read-only Azure
permissions for its agent run in CI. Use this for tests that inspect resources without
creating, modifying or deleting them.

```yaml
tags:
  type: integration
  tier: full
  cost: llm
  area: response-quality
  azurePermission: read
```

Use `azurePermission: none` for tests whose agent should not use the test subscription's Azure login. In CI, this overrides `AZURE_CONFIG_DIR` with a unique, nonexistent temporary path for each run and sets `AZURE_CLIENT_ID` to an empty string, so Azure CLI and Azure MCP do not use the authenticated Azure config or inherit the test identity's client ID. No read-only profile is required.

Local runs ignore both values and use the available local Azure credentials.
In CI, omitting the tag preserves the default Azure permissions, and a `read`
run fails if read-only access is not configured. Only `read` and `none` are
supported; other values are rejected by eval validation.

CI runs `npx tsx discover-azure-permissions.ts` from `tests/` after installing
dependencies. It scans nested `.yaml` files for each selected skill and builds
permission-specific matrices. Invalid YAML or stimuli shapes are logged and skipped.
Unsupported permission strings fail discovery.

The three reusable workflows run only the stimuli in their group:

| Stimulus tag | Workflow | Available Azure identity |
|---|---|---|
| `azurePermission: read` | `test-integration-read.yml` | `AZURE_READ_CLIENT_ID`, exposed as `AZURE_CLIENT_ID` |
| No tag (`""`) | `test-integration-default.yml` | `AZURE_CLIENT_ID` |
| `azurePermission: none` | `test-integration-none.yml` | No Azure login, no Azure OIDC permission |

Each job installs dependencies and uses its fresh runner's default Azure CLI and azd profiles.
Authenticated jobs log in to only their selected identity and refresh its CLI
token in a dedicated background-refresh step. The test command uses native Vally
filters: `--tag azurePermission=read`, `--tag azurePermission=none`, or both
`--tag 'azurePermission!=read' --tag 'azurePermission!=none'` for untagged tests.
The unchanged Vally wrapper discovers suites using `--plugin` and `--skill`.
`TEST_AZURE_PERMISSION` rejects stimuli assigned to another job
without switching profiles. Local runs without this variable are unchanged.

Every job uploads its reports tree and execution manifest, even on test
failure. A per-skill reporting job downloads the artifacts and runs
`npx tsx aggregate-permission-results.ts`. It merges test results and per-test files
into `reports/test-run-all-integration/`. The `results.jsonl` and
`token-summary.jsonl` files from each permission's reports directory are
concatenated into one file of each name. Nothing from `results/` is uploaded.
Duplicate test keys fail aggregation. Missing groups produce an explicitly
incomplete summary and fail the reporting job while preserving available results.
One skill report is generated from the merged reports before artifact/storage
publication and usage uploads.

## Testing This Project

Run the unit tests, type checker, and linter for the runner and support code:

```bash
cd tests
npm test
npm run typecheck
npm run lint
```

To run or collect comparison tests:

```bash
npm run compare:run
npm run compare:collect
```

## CI And Nightly Runs

The [test-all-integration workflow](../.github/workflows/test-all-integration.yml) runs skill evals in CI. [skills.json](./skills.json) defines the skills included in scheduled runs and their schedule groups.

Nightly results are published to the [integration tests dashboard](https://aka.ms/azure-skills-tests). CI artifacts and the local `reports/` directory contain the detailed results used by the dashboard and reporting tools.
All new integration test authoring must use Vally eval suites under [../evals](../evals).

Use [AGENTS.md](./AGENTS.md) as the primary guide for how to create, update, and run Vally tests in this repository.

## Related References

- Vally eval suites: [../evals](../evals)
- Vally migration context: [../evals/README.md](../evals/README.md)
- Test authoring guide: [AGENTS.md](./AGENTS.md)
