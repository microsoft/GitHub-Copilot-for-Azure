# Run tests in CI

Follow these steps to add a skill's Vally suites to the CI test workflow so they run nightly and publish results. Because LLM behavior is statistical, accumulating test run results gives us better data to refine skills over time.

## Prerequisites

- The skill's Vally suites are implemented under `evals/<skill-name>/eval.yaml` (or split across multiple YAML files).
- The Vally suites use the `integration-test-agent-runner` custom executor.
- The test results can be made public.

## Required setup

The scheduled CI test workflow determines which skills to test by reading `tests/skills.json`. That file lists all skills and their test schedules. To include a new skill in scheduled runs, **add it** to the skill list and to one of the schedule slots. By convention, `microsoft-foundry` and `azure-deploy` run in their own slots, while new skills are added to another shared slot.

### Use shared job template

Most skills use a shared job template to run eval suites. This template is defined as the `test` job in `.github/workflows/test-all-integration.yml`.

If you use the shared job template, add the skill in the workflow’s `VALLY_SKILLS` list. Otherwise the job will run Jest-based integration tests instead of `npm run test:vally`. The CI workflow creates one job per skill from this template and runs all eval suites with `npm run test:vally`.

Reuse this template whenever possible. It provisions a test environment, installs common tools (for example, Azure CLI and Azure Developer CLI), connects to a test Azure subscription, and includes utility steps that collect and publish test results to a well-known storage location for downstream processing.

### Create dedicated workflow

In some cases, you may need a dedicated workflow for a skill. Common reasons include:

- The skill requires uncommon environment configuration, such as additional environment variables or secrets, a special Azure subscription, or installation of uncommon tools.
- The test suite is too large for a single job. GitHub Actions has a hard 6-hour runtime limit per job. For example, `azure-deploy` uses a dedicated workflow that splits tests across multiple jobs.
- Test results must be published to a custom destination for downstream processing and consumption. If your team owns a data pipeline, implement publishing steps in the dedicated workflow. You can still publish to the well-known location so our reporting tools continue to work.

If you create a dedicated workflow, update `test-all-integration.yml` so it triggers the dedicated workflow when that skill is included in the input. Then implement the dedicated workflow to run tests and collect results. Work with GitHub-Copilot-for-Azure repo contributors to configure any required environment variables or secrets.