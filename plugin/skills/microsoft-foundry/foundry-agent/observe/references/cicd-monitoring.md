# Step 11 — Enable CI/CD Evals & Continuous Monitoring

After confirming the final agent version, prompt with two options:

## Option 1 — CI/CD Evaluations

*"Would you like to add automated evaluations to your CI/CD pipeline so every deployment is evaluated before going live?"*

If yes, generate a GitHub Actions workflow (for example, `.github/workflows/agent-eval.yml`) that:

1. Triggers on push to `main` or on pull request
2. Accepts a metadata-file input or environment variable such as `FOUNDRY_METADATA_FILE` and defaults it to `.foundry/agent-metadata.yaml`
3. Reads test-suite definitions from the selected metadata file (for example, `.foundry/agent-metadata.prod.yaml` for prod CI)
4. Reads evaluator definitions from `.foundry/evaluators/` and test datasets from `.foundry/datasets/`
5. Runs `evaluation_agent_batch_eval_create` against the newly deployed agent version
6. Fails the workflow if any evaluator score falls below the configured thresholds for the environment and test suite resolved from that metadata file
7. Posts a summary as a PR comment or workflow annotation

Use repository secrets for the selected environment's project endpoint and Azure credentials, and keep the metadata filename explicit in the workflow so prod rollouts do not depend on the local/dev default file. Confirm the workflow file with the user before committing.

## Option 2 — Continuous Production Monitoring

*"Would you like to set up continuous evaluations to monitor your agent's quality in production?"*

If yes, generate a scheduled GitHub Actions workflow (for example, `.github/workflows/agent-eval-scheduled.yml`) that:

1. Runs on a cron schedule (ask the user preference: daily, weekly, and so on)
2. Accepts or hard-codes the production metadata file path (for example, `.foundry/agent-metadata.prod.yaml`)
3. Evaluates the current production agent version using stored test suites, evaluators, and datasets
4. Saves results to `.foundry/results/<environment>/`
5. Opens a GitHub issue or sends a notification if any score degrades below thresholds

The user may choose one, both, or neither.

## Reference

- [Azure AI Foundry Cloud Evaluation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/cloud-evaluation)
- [Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents)
