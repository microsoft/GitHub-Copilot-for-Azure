# Selected guidance: Step 10 — Local smoke test; Step 11 — Deploy; Step 12 — Verify + remote smoke; Step 13 — Submit eval suite generation (async, fire-and-forge

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

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "<endpoint>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<deployment-name>"
```

### Step 10 — Local smoke test

Set up a venv with `uv` installed first. `azd ai agent run` installs Python dependencies on first start; with an activated venv that has `uv` available, it uses `uv` (seconds) instead of plain `pip` (minutes).

> **Important:** the venv must live in `src/<agent-name>/` (next to `pyproject.toml` / `requirements.txt`). `azd ai agent run` resolves the venv relative to the service source directory; a venv at the project root is ignored and azd silently creates a second one without `uv`, wasting the speedup.
>
> **Private package index:** If the sample has a `uv.lock`, the user has the `UV_DEFAULT_INDEX` environment variable set to a private index, and public PyPI is unreachable, `azd ai agent run` fails with `uv.lock needs to be updated`. Back up `uv.lock` first, then run `uv lock` in `src/<agent-name>/` and continue the local test. The re-locked file is for local run only; see [Step 11](quick-start-hosted--step-10-local-smoke-test-step-11-deploy-step-12-verify-.md#step-11--deploy) before deploying.

**Python:**
```bash
cd src/<agent-name>
python -m venv .venv
# Activate the venv — pick the line for your shell:
.\.venv\Scripts\Activate.ps1                    # Windows pwsh
source .venv/bin/activate                       # macOS / Linux
python -m pip install uv
cd -                                             # back to project root for the azd commands below
```

**.NET:** no pre-install step — `azd ai agent run` runs `dotnet restore` itself on first start.

The examples below use the default port `8088`. Confirm it is free; if occupied, choose another port and add the same `--port <n>` to both `run` and `invoke --local` below. Run the agent locally. For Python, do this **with the service-dir venv still activated** — activation is what lets `azd ai agent run` find `uv` for the fast dependency install. `azd ai agent run` **is** the local server — a foreground process holding the selected port that must stay alive from start, through every `invoke --local`, until you explicitly stop it.

Start it in a **managed** background session your shell tool can poll and stop (most tools detect a long-running foreground process and return a session/shell id — use that id). Do **not** use job operators (`bash &`, `nohup`, `start /B`, popped windows): on Linux/macOS the child gets `SIGHUP` and **dies when its parent bash exits**, so the next command sees `could not connect` even though `ss` from inside the *same* bash just showed `:8088` bound.

```bash
azd ai agent run --no-client
```

> **Readiness gate — required before local invocation.**
> - Start checking TCP connections to `localhost:<port>` immediately after launching the agent in the background; retry failed connections every 2–5 seconds.
> - In the same loop, check whether the `azd ai agent run` process has exited. **If it exited, stop polling immediately**, read its output, and fix that specific cause (for example, a dependency install failure) before restarting.
> - **Keep each startup wait at 5 seconds or less**, including sleeps and shell-tool output reads.
> - **Proceed to the smoke invocation as soon as TCP connects**, keeping the server running.
> - If the startup timeout expires before a connection succeeds, inspect the server logs and resolve the cause before retrying.

Smoke-invoke (local):

```bash
azd ai agent invoke --local "<short representative prompt for the agent's purpose>"
```

Stop the local server via the managed session's stop primitive before continuing — a lingering process holds files in the project and breaks later cleanup.

### Step 11 — Deploy

Once local invocation succeeds, if the user does not explicitly ask to deploy, tell them the agent is ready and ask if they want to deploy.

If you re-ran `uv lock` against a private index in Step 10, the remote build cannot use that lock. If dependencies did not change, restore the backed-up `uv.lock` before deploying. If dependencies changed, guide the user to regenerate `uv.lock` using the public PyPI index, or export the locked dependencies to a `requirements.txt` file with pinned versions, and then proceed with deployment.

To deploy:

```bash
azd deploy --no-prompt
```

⏳ May take time — zips `src/<agent-name>/` (respecting `.agentignore`), uploads to Foundry, builds runtime remotely, registers agent version. Wait for the prompt to return; do not interrupt.

### Step 12 — Verify + remote smoke

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map.

Remote invoke (billed):

```bash
azd ai agent invoke "<short representative prompt>"
```

Run the smoke invocation only as part of the requested deployment or test.

### Step 13 — Submit eval suite generation (async, fire-and-forget)

> ⚠️ **Pre-summary gate.** Do not write the Step 14 final summary until this step has been submitted. The eval suite is part of the deployment artifact; skipping it ships an incomplete result.

Directly submit the eval suite generation asynchronously, do not ask the user for confirmation.

Read the agent service's `description:` from `azure.yaml` (the value you set in Step 5) and pass it as `--gen-instruction`:

```bash
azd ai agent eval generate --gen-instruction "<agent service description>" --no-wait --no-prompt
```

Expected output:

```
Eval generate submitted (async)
   dataset generation: datagen-<id> (queued)
   evaluator generation: evaluatorgen-<id> (in_progress)
   Config written to: src/<agent-name>/eval.yaml
   When ready, run:
     azd ai agent eval run
```

Generation runs server-side and takes several minutes. Tell the user:

> *"Eval suite generation submitted. Run `azd ai agent eval run` whenever you're ready — it'll wait for generation to finish and execute the eval in one step."*

Run `azd ai agent eval run` only after the user explicitly agrees.

### Step 14 — Final summary

Produce a concise summary covering: agent name/version/status/endpoints, a Playground link, the resources created, the eval suite generation submission, and the three follow-up commands below. Read `playground_url` directly from `azd ai agent show --output json`. If it is absent, construct the Playground URL from `azd env get-values`:

```
https://ai.azure.com/nextgen/r/{encodedSubId},{resourceGroup},,{accountName},{projectName}/build/agents/{agentName}/build?version={agentVersion}
```

`encodedSubId` = URL-safe base64 of the subscription GUID, padding stripped:

```bash
python -c "import base64,uuid;print(base64.urlsafe_b64encode(uuid.UUID('<SUBSCRIPTION_ID>').bytes).rstrip(b'=').decode())"
```

Three follow-up commands to include:

```bash
azd ai agent invoke "<follow-up message>"   # chat with the deployed agent (billed)
azd ai agent eval run                       # finalize + run the eval suite (Step 13)
azd down                                    # tear down all resources when done
```

## Error Handling

| Symptom | Fix |
|---------|-----|
| `azd ai agent init` fails with `--runtime must be one of: python_3_13, python_3_14, dotnet_10` | You passed a bare value like `python`. Use the full runtime token (e.g. `python_3_13`). |
| `azd ai agent init` fails with `--entry-point is required when using --deploy-mode code with --no-prompt` | Pass `--entry-point <filename>` matching the entry-point file the sample declares (from Step 3). |
| `codeConfiguration.entryPoint` doesn't match any file in `src/<agent-name>/` | You guessed the entry-point in Step 4. Edit the agent service in `azure.yaml` to the real filename (verify with `ls src/<agent-name>/`). No re-init needed. |
| `azd deploy` postdeploy hook fails with missing `AZURE_TENANT_ID` | Run `az account show --query tenantId -o tsv` and `azd env set AZURE_TENANT_ID <tenant-id>`, then re-run `azd deploy --no-prompt`. The deployed agent version from the first deploy is still valid; the postdeploy hook just registers env vars. |
| Scaffold sanity check fails (Step 7) | Pick a recovery path from Step 7. If still failing → [create-hosted.md](create-hosted.md). |
| Local invoke returns model `404` / wrong deployment | Stale `AZURE_AI_MODEL_DEPLOYMENT_NAME` in azd env overrides `.env`. Re-run Step 9 to sync both. |
| Anything else | Escape to [create-hosted.md](create-hosted.md). |

