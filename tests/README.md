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

Use `azurePermission: none` for tests whose agent should not use a managed identity.
In CI, the agent receives an empty `AZURE_CLIENT_ID` and an unauthenticated
`AZURE_NONE_CONFIG_DIR` and `AZD_NONE_CONFIG_DIR` profiles. Fixture provisioning
authenticates separately when required; neither CLI logs in for `none` tests.

Use `azurePermission: write` or `azurePermission: admin` for tests that require
the corresponding managed identity.

Local runs ignore permission tags and use the available local Azure credentials.
In CI, untagged tests use the admin test identity. Tagged runs select
`AZURE_CLIENT_ID` from `AZURE_READ_CLIENT_ID`, `AZURE_WRITE_CLIENT_ID`, or
`AZURE_ADMIN_CLIENT_ID` and fail if the selected variable is missing or blank.
The agent's `AZURE_CONFIG_DIR` and `AZD_CONFIG_DIR` select matching CLI profiles. Missing or
relative profile paths fail rather than falling back to default credentials.
Only `read`, `write`, `admin`, and `none` are
supported; other values are rejected by eval validation.

CI runs `npx tsx discover-azure-permissions.ts` from `tests/` after installing
dependencies. It scans the same nested `.yaml` suites as the runner, excluding
`fixture/` directories, and honors inherited tags and the selected deployment
category. Invalid suites and unsupported permissions fail discovery.

The shared test action runs every evaluation for a skill in one job, without
permission filters. Azure-deploy retains its category matrix for runtime limits.
Each run authenticates only the discovered identities with separate az and azd
profiles. When a selected stimulus declares `azureFixture`, the write identity
also authenticates for provisioning, post-test scripts and cleanup. Fixture-only
write profiles do not log in to azd. CLI tokens refresh every 240 seconds until
tests finish. Neither CLI ever logs in with its default profile.

| Purpose | Client ID variable | Subscription variable | CLI profile variable |
|---|---|---|---|
| Report Blob/Table storage | `AZURE_STAGE_CLIENT_ID` | `AZURE_STAGE_SUBSCRIPTION_ID` | `AZURE_STAGE_CONFIG_DIR` |
| Fixtures and write tests | `AZURE_WRITE_CLIENT_ID` | `AZURE_SUBSCRIPTION_ID` | `AZURE_WRITE_CONFIG_DIR` |
| Read tests | `AZURE_READ_CLIENT_ID` | `AZURE_SUBSCRIPTION_ID` | `AZURE_READ_CONFIG_DIR` |
| Admin tests | `AZURE_ADMIN_CLIENT_ID` | `AZURE_SUBSCRIPTION_ID` | `AZURE_ADMIN_CONFIG_DIR` |

Configure these variables in the `cideploytest` environment. Workflows use
job `env` mappings to pass configuration to composite actions;
composite action manifests use `env`, not the unsupported `vars` context.
Integration workflows do not consume the legacy `AZURE_CLIENT_ID` configuration
variable; it remains available to other workflows. The executor sets the runtime
`AZURE_CLIENT_ID` separately for each stimulus from its selected test identity.
All identities use
`AZURE_TENANT_ID` and need GitHub federated credentials. The stage identity needs
Blob read/write and Table write access. Configure
`AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT` and
`AZURE_FIXTURE_COORDINATION_CONTAINER` for fixture coordination in the test
subscription. Resource locks and lease renewal use the test write identity,
which needs Blob write/lease access to this coordination storage.
The authentication action creates profile paths under the runner's temp
directory and exposes them to child processes. Storage SDKs request tokens
through the explicit stage CLI profile for reports and usage uploads, or the
test write profile for fixture coordination, not `DefaultAzureCredential` in CI.
Fixture child processes always select the write profile, and the executor
selects the agent profile per stimulus without modifying the parent's environment.
Only read/write/admin test identities are used for azd login, with separate
`AZD_READ_CONFIG_DIR`, `AZD_WRITE_CONFIG_DIR` and `AZD_ADMIN_CONFIG_DIR` paths.
The executor selects both CLI profiles per stimulus without changing global
environment variables, so concurrent stimuli can use different identities.
Fixture principal resolution receives that stimulus's selected client ID, while
fixture commands continue to use the write profile.

In CI, the profile action exports `TEST_PERMISSION=""` to enable explicit profile
selection. When this variable is undefined, or outside CI, the executor preserves
inherited local credentials.

After tests, the job generates a report and logs in to the dedicated report
identity immediately before publishing, using `AZURE_STAGE_CONFIG_DIR`. Test runs
never authenticate this identity beforehand. Reports and usage-table uploads use
this explicit profile. GitHub artifacts are never uploaded.
`REPORT_STORAGE_ACCOUNT` is required. Scheduled runs use `REPORT_STORAGE_CONTAINER`
(default `integration-reports`); other runs use `MANUAL_REPORT_STORAGE_CONTAINER`
(default `manual-integration-reports`). Containers must already exist and must
not permit public access.

All report files are already in `reports/test-run-all-integration/`.
`npx tsx report-storage.ts` publishes this directory directly, including available
results after test failures. There is no temporary Blob transfer or aggregation.
Nothing from `results/` is uploaded. Final reports retain the dashboard's
`<UTC-date>/<run-id>/<skill>/` prefix; azure-deploy adds `<category>/` to isolate
its parallel category runs.

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
