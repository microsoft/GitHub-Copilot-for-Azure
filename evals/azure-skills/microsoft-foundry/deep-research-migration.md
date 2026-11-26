# Deep Research migration E2E

This opt-in case uses the exact original Deep Research sample from the public Deep Agents repository and the Foundry skill from the checkout being evaluated. It reuses the fixed T01–T07 assessor without changing the assertions. Vally records migration time and usage separately from acceptance; a completed migration alone is not a pass.

## 1. Migrate without grading

Use a clean actor environment with Python 3.13, the required development tools, and Copilot model access. Do not mount the private assessor, its resource settings, other workspaces, or Azure credentials. From `tests/`, after `npm ci`:

```bash
spec=../evals/azure-skills/microsoft-foundry/e2e.eval.yaml
npx --no-install vally eval --eval-spec "$spec" --executor copilot-sdk \
  --tag id=migration-deep-research-to-foundry --skip-grade \
  --workspace "$PWD/deep-research-workspaces" --output jsonl > migration.jsonl
```

Stop the actor and transfer its trajectory and unchanged candidate to a separate evaluator environment. Preserve the absolute trial `workDir` recorded in the trajectory, and mount the candidate read-only there. Do not transfer the actor's authentication state. The repository's default executor skips this case, so it does not run in regular CI.

## 2. Grade the frozen candidate

On the evaluator only, prepare the dependencies, CLI authentication and freshly reviewed runtime configuration for the original fixed seven-case assessor. Use a disposable Foundry test project with the required model, search, hosted identity and State Store support. The following variables must point to absolute paths outside the actor workspace:

- `FOUNDRY_MIGRATION_EVALUATOR`: `evaluate.py` from the fixed T01–T07 assessor, with its supporting files intact. Do not use a historical operator script.
- `FOUNDRY_MIGRATION_EVAL_CONFIG`: The assessor's operator JSON for this test project and provider configuration.
- `FOUNDRY_MIGRATION_RECEIPTS`: An existing private directory for raw evaluator receipts and logs; keep it out of CI artifacts.

From `tests/`, with the assessor's Python environment active, run only after authorizing live Azure calls and deployment:

```bash
spec=../evals/azure-skills/microsoft-foundry/e2e.eval.yaml
FOUNDRY_MIGRATION_ALLOW_LIVE=1 npx --no-install vally grade --eval-spec "$spec" \
  --param "FOUNDRY_MIGRATION_GRADER=$PWD/../evals/azure-skills/microsoft-foundry/graders/deep-research-migration.py" \
  --require-pass --verbose < migration.jsonl
```

Run acceptance serially, and clean up the test project and any resources created for the run, including after a timeout or interrupted deployment. Vally reports only the seven case statuses and aggregate pass/fail. An unexecuted or missing case never passes. The assessor retains full evidence in the private receipts directory.
