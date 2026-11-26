# Deep Research migration E2E

This opt-in case uses the exact original Deep Research sample from the public Deep Agents repository and the Foundry skill from the checkout being evaluated. It reuses the fixed T01–T07 assessor without changing the assertions. Vally records migration time and usage separately from acceptance; a completed migration alone is not a pass.

## GitHub Actions

Run **Foundry Deep Research migration** from the default branch. The workflow is manual and leaves the existing Foundry E2E and PR smoke jobs unchanged.

1. Select `generate` to run the pinned Vally case with `gpt-5.6-sol`. The job has Copilot access but no Azure or assessor credentials. It verifies completion and skill invocation, then uploads `foundry-deep-research-candidate`: a source archive and a manifest with the generation revision and archive SHA-256. It does not publish the raw trajectory, `.venv/`, local Azure environments, or other generated caches.
2. Select `accept` with the successful `generation_run_id`. This skips generation and restores the verified artifact from that run. It authenticates to the disposable test project, creates a fresh `azd` context, and runs the fixed T01–T07 assessor. The independent T05 observer uses the current candidate, installed SDK, and exact deployed agent version and identity. The runtime evidence requirements remain unchanged.

For setup, quota, provider, or assessor failures, retry `accept` with the **same run ID**. Regenerate only if the generated sample must change. The archive is retained for up to 90 days. An expired or missing artifact fails acceptance; it never triggers generation.

### One-time acceptance setup

Maintainers must configure the protected GitHub environment `foundry-deep-research-e2e` for the default branch, with a required reviewer and Azure OIDC credentials scoped to a disposable Foundry test project. The job does not create test infrastructure or grant IAM. The project needs the model, search toolbox, hosted identity, State Store and read access to deployment/runtime evidence used by the fixed tests. It must not have a pre-existing version of the candidate agent. Use the approved external-provider fixture profile from the original seven-case assessor.

- Environment variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `FOUNDRY_MIGRATION_ASSESSOR_REPOSITORY`, and `FOUNDRY_MIGRATION_ASSESSOR_REVISION` (the full reviewed commit SHA of the fixed assessor repository containing `02-tests/archive/phase331`).
- Environment secrets: `FOUNDRY_MIGRATION_ASSESSOR_TOKEN` (read access to that private repository) and `FOUNDRY_MIGRATION_EVAL_CONFIG` (reviewed operator JSON with `project_endpoint`, `project_id`, `environment`, and `providers`; see the fixed assessor's fixture contract). The evaluator creates its own `azd_context` and `credential_chain_audit` paths.
- Keep raw logs, operator settings, runtime receipts, and authentication caches private. The evaluator cleans up only a deployment version it can prove this run created. An ambiguous deployment after a timeout requires operator inspection before retrying.

## Local generation and replay

Use a clean actor environment with Python 3.13, the required development tools, and Copilot model access. Do not mount the private assessor, its resource settings, other workspaces, or Azure credentials. From `tests/`, after `npm ci`:

```bash
spec=../evals/azure-skills/microsoft-foundry/e2e.eval.yaml
npx --no-install vally eval --eval-spec "$spec" --executor copilot-sdk \
  --model gpt-5.6-sol --tag id=migration-deep-research-to-foundry --skip-grade \
  --workspace "$PWD/deep-research-workspaces" --output jsonl > migration.jsonl
python -I -B ../evals/azure-skills/microsoft-foundry/graders/deep-research-artifact.py freeze \
  --trajectory migration.jsonl --workspace "$PWD/deep-research-workspaces" \
  --revision "$(git rev-parse HEAD)" --output frozen-candidate
```

Stop the actor before freezing. Use `restore --artifact frozen-candidate --revision <generation-commit> --output <candidate-directory>` on the independent evaluator. It can restore to a different absolute path and requires no replay of the model trajectory. Do not transfer actor authentication state.

After authorizing deployment to the disposable test project, use Python 3.13, the fixed assessor's dependencies, `az`, `azd` with the Foundry extension, `uv` and Podman. Set `AZURE_SUBSCRIPTION_ID` for the approved subscription and authenticate `az` and `azd`. Invoke the same grader as CI with absolute paths:

```bash
graders="$PWD/../evals/azure-skills/microsoft-foundry/graders"
EVALUATE_WORKSPACE="$candidate_directory" \
FOUNDRY_MIGRATION_EVALUATOR="$graders/deep-research-ci.py" \
FOUNDRY_MIGRATION_ASSESSOR_DIR="$assessor_archive_directory" \
FOUNDRY_MIGRATION_EVAL_CONFIG="$private_operator_json" \
FOUNDRY_MIGRATION_RECEIPTS="$existing_private_receipts_directory" \
FOUNDRY_MIGRATION_ALLOW_LIVE=1 python -I -B "$graders/deep-research-migration.py"
```

Use the JSON `passed` field as the verdict; an unexecuted or missing case never passes. Run acceptance serially against a test project. Keep the candidate unchanged for retries and review private receipts to distinguish sample failures from environment or evaluator failures.
