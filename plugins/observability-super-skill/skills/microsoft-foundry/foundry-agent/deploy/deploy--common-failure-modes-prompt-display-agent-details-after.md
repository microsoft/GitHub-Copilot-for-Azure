# Selected guidance: Common failure modes -- Prompt; Display agent details; After Deployment — Auto-Generate Evaluation Suite; 1. Inspect existing eval.yaml; 2.

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../references/execution-boundaries.md) apply to the selected action.

## Common failure modes -- Prompt

| Error | Fix |
|-------|-----|
| Schema fetch failed | Verify endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>`. |
| Agent creation failed | Use `agent_definition_schema_get` to verify the definition. |
| Permission denied | User needs `Foundry User` role on the project. |
| Model not found | Deploy the model first via [models/deploy-model](../../models/deploy-model/SKILL.md). |

## Display agent details

After a successful deploy, show the agent's name, version, status, and endpoints in a table. Include a Playground link:

```
https://ai.azure.com/nextgen/r/{encodedSubId},{resourceGroup},,{accountName},{projectName}/build/agents/{agentName}/build?version={agentVersion}
```

`encodedSubId` is the subscription GUID as URL-safe base64 (no `=`):

```bash
python -c "import base64,uuid;print(base64.urlsafe_b64encode(uuid.UUID('<SUBSCRIPTION_ID>').bytes).rstrip(b'=').decode())"
```

For hosted agents, `playground_url` is in `azd ai agent show --output json`.

## After Deployment — Auto-Generate Evaluation Suite

> Reference for Step 6 options (a) and (b) — start `generate` right after deploy so its server-side generation overlaps with invoke/test steps and finishes faster. Options (c) and (d) skip `generate` and go straight to section 3 (run) or stop.

### 1. Inspect existing eval.yaml

Check the selected agent root for `eval.yaml`:

- **Exists and matches the selected agent** → skip `generate`; go to step 3 (run).
- **Missing or stale** → continue to step 2.

### 2. Submit generation (asynchronous, server-side)

Run `azd ai agent eval generate --no-wait` with the user's chosen flags (see the Step 6 table). The command:

- Submits dataset + evaluator generation jobs server-side.
- Returns in seconds.
- Writes pending operation IDs to local azd state.
- Writes a placeholder `eval.yaml` at the agent root (override with `--out-file <path>`).

No skill-side polling, terminal handle, or later-turn re-check is needed. `azd ai agent eval run` (section 3) automatically resumes a pending generation, downloads artifacts, finalizes `eval.yaml`, then runs the eval.

If the user wants to wait synchronously instead (e.g., to inspect `eval.yaml` before running), drop `--no-wait` — `generate` will then submit the jobs, wait for completion, download review artifacts, and write the finalized `eval.yaml` before returning (typically several minutes).

### 3. Run the suite

```bash
azd ai agent eval run
```

Use `azd ai agent eval show -O results.json` to inspect run details, or `azd ai agent eval list` to see history.

### 4. Refresh datasets/evaluators (later)

When local files under `datasets/<suite>/` or `evaluators/<suite>/` change, run `azd ai agent eval update --dataset-only` or `--evaluator-only` to upload new versions. azd bumps the `version` fields in `eval.yaml`.

### 5. Prompt User

*"Your agent is deployed and evaluation suite generation is **submitted server-side** (still running, takes several minutes). Would you like to run an evaluation now? `azd ai agent eval run` will wait for generation to finish, then execute the eval."*

- **Yes** → run `azd ai agent eval run` (this resumes the pending generation, then runs the eval — may take several minutes the first time), then follow the [observe skill](../observe/observe.md) to interpret results.
- **No** → stop. The user can return later via `azd ai agent eval run` — it will pick up wherever the pending generation is.
- **Production trace analysis** → follow the [trace skill](../trace/trace.md).

## Non-Interactive / YOLO Mode

> Even in `--no-prompt` / `--yolo` mode: if the user named a foundry project or asked to create one, go ahead; otherwise stop and ask before provisioning.

- Hosted: always pass `--no-prompt`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
