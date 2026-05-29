---
name: vally-eval
description: "Author, validate, and run Vally eval.yaml evaluation suites for agent skills. TRIGGERS: create eval, write eval, add eval, run eval, validate eval, vally eval, eval.yaml, add stimulus, map test to eval, migrate test to eval, eval graders, eval scoring."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Vally eval suites

Skills in the azure-skills plugin are required to have integration tests that run prompts against an LLM agent to evaluate whether they help the agent accomplish goals in target scenarios. Such integration tests are written as vally eval suites, using vally as the underlying tool for running tests and grading the agent outcome.

## Write vally eval suites

Vally eval suites are written as yaml documents. All eval suites share eval spec.

Refer to the official documentation on the schema of the spec and the schema of the eval suites [writing-eval-specs](https://literate-engine-r3wnl4v.pages.github.io/guides/writing-eval-specs/).

Vally eval suites for azure-skills plugin have the following file layout. The shared eval spec is located at `<repo-root>/.vally.yaml`. The eval suites are categorized by skills. The eval suites for each skill are located at `<repo-root>/evals/<skill-name>/eval.yaml`, e.g. `<repo-root>/evals/azure-ai/eval.yaml`. If a skill needs fixture files for its eval suites, it should organize such fixture files in a `fixture` directory under its directory, e.g. `<repo-root>/evals/azure-ai/fixture/`.

## Migrate integration tests

azure-skills plugin have implemented JavaScript integration test using Jest as the underlying test runner. All such integration tests are under `tests/**/integration.test.ts` files.

To migrate integration test for a skill to vally suites, create its eval suite spec at `<repo-root>/evals/<skill-name>/eval.yaml`, add a suite that runs the same prompt and uses vally's built-in graders to grade the trajectory of the agent run. If the integration test grades the agent run in a way that vally's built-in graders don't support, refer to the official documentation on how to create a custom grader [writing-custom-grader](https://literate-engine-r3wnl4v.pages.github.io/guides/writing-custom-graders/).

## Why is there a custom executor

The legacy Jest based integration test framework implemented features that vally doesn't support yet, such as early termination, follow up, system prompt modification, screenshot taking, etc. Besides, the azure-skills plugin runs automated integration tests, collects its exported data and feeds the data to a dashboard web app under `<repo-root>/dashboard/` to monitor skill integration test results.

If you intend to have your vally suites use any of the extended features or have their results be consumed by the dashboard, you **MUST** use the custom executor in your vally suites.

### Use tags to control the custom executor

The custom executor in azure-skills plugin uses special tag values to control the behavior of the custom executor. See [tag-helpers.ts](../../../tests/vally/tag-helpers.ts) to learn what special tags are supported.

## Validate vally eval suites

Vally eval suites for azure-skills plugin follow certain conventions. For example, all eval suites must have a `type`, `tier`, `cost` and `area` tag so they can be run for a corresponding target group. To ensure all eval suites follow the conventions, a script is added to validate the eval suites and report errors when it sees any violation. To run the script, execute this command from the `scripts/` directory.

```bash
# cwd as <repo-root>/scripts/
npm run vally validate-stimulus
```

Extended features such as early termination are implemented using tags and many of them use serialized JSON objects as input. This validation script also validates the values of these special tags.

## Run vally eval suites

Use vally-cli to run vally eval suites. In most cases, you would like to use a command like this.

```bash
# In tests/
npm run test:vally -- --skill $SKILL
```

`--eval-spec ../evals/<skill-name>/eval.yaml` tells vally which eval spec to run. The path is relative to the current working directory of the process running the command. `--output-dir ./results` tells vally to write its output to a `results/` directory relative to the current working directory of the process running the command. `--executor-plugin ../../tests/vally/vally-executor.ts` tells vally to load and execute the code in this module, which registers the custom executor used by azure-skill vally eval suites. Note that this path is relative to the parent directory of the eval spec to run. For example, if the eval spec to run is `<repo-root>/evals/azure-ai/eval.yaml`, resolving this relative path ends at `<repo-root>/tests/vally/vally-executor.ts`.

## Re-grade an existing trajectory

Test authors commonly need to fine-tune grader configurations to reduce result flakiness. Vally supports re-grading an existing trajectory using a command like this:

```bash
# in tests/
npx @microsoft/vally-cli grade --eval-spec ../evals/<skill-name>/eval.yaml --verbose < results/<test-date>/results.jsonl
```

You can keep tuning the grader config in the eval.yaml and re-grade the trajectory until the result meets your expectation.

### Collect test results

When running locally, the test results can be found at the following directories:

- `tests/reports/<test-run-name>/`
- `tests/results/<test-run-name>/`

When running in CI, the test results can be found in the GitHub Action artifacts or at a storage account that the workflow publishes to. You can also use the [integration tests dashboard](https://aka.ms/azure-skills-tests) to view the test results from nightly test runs.