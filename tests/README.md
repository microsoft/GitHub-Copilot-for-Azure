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
