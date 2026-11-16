# Selected guidance: Expected env-var fingerprint (post-provision); Common Guidelines; Non-Interactive / YOLO Mode; Error Handling

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

## Expected env-var fingerprint (post-provision)

After `azd provision` completes for an `azd ai agent`-scaffolded project (default Basic Agent Setup), `azd env get-values` should show this canonical state. Verify before debugging deployment or runtime issues.

| Variable | Expected value | Notes |
|----------|----------------|-------|
| `ENABLE_HOSTED_AGENTS` | `true` | Set automatically by `azd ai agent init`. |
| `ENABLE_CAPABILITY_HOST` | `false` | Set automatically by `azd ai agent init`. Leave as-is unless you are intentionally targeting Standard Agent Setup. |
| `FOUNDRY_PROJECT_ENDPOINT` | `https://<account>.services.ai.azure.com/api/projects/<project>` | Populated by provision (or pre-set if reusing an existing project). |
| `AZURE_AI_PROJECT_ID` | Full ARM resource ID of the Foundry project | Populated by provision; required for deploy. |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model deployment name (e.g. `gpt-4o`) | Set automatically by `azd ai agent init` from the first entry in `azure.yaml services.ai-project.deployments[]`. Required for local run and deploy. |
| `AI_PROJECT_DEPLOYMENTS` | escaped JSON array, e.g. `[{\"name\":\"gpt-4o\",...}]` | **Internal extension state.** Managed by `azd ai agent init` from `azure.yaml services.ai-project.deployments[]`. Carries deployments into the Bicep parameter `aiProjectDeploymentsJson`. **Never** set with `azd env set` — manual edits single-escape the JSON and break Bicep `json()` parsing. |
| `AI_AGENT_PENDING_PROVISION` | *(empty / unset)* | Non-empty means provision is still mid-flight; do not deploy. |

`Microsoft.CognitiveServices/accounts/capabilityHosts/agents` is **not** provisioned by `azd ai agent init` (Basic Agent Setup). Its absence is expected. The resource only appears under Standard Agent Setup, which is documented separately in [references/standard-agent-setup.md](../../references/standard-agent-setup.md).

Both `ENABLE_HOSTED_AGENTS` and `ENABLE_CAPABILITY_HOST` are set automatically by `azd ai agent init` — you do not need to manage them. If you ever set them manually outside this flow, see [project/create/create-foundry-project.md](../../project/create/create-foundry-project.md#step-3-create-directory-and-initialize) for the manual-flag procedure.

See the canonical env-var registry: [azure-dev/cli/azd/docs/environment-variables.md](https://github.com/Azure/azure-dev/blob/main/cli/azd/docs/environment-variables.md).

## Common Guidelines

1. **Sample-first** -- select the sample and capture its `manifestUrl` according to the [azd Sample Selection Guidance](create-hosted--quick-reference-when-to-use-this-skill-hosted-vs-prompt.md#azd-sample-selection-guidance).
2. **Prefer azd over az** -- fall back to `az` only as a last resort, with explicit consent.
3. **Don't auto-login** -- `az login` and `azd auth login` are user-owned browser flows; ask the user and stop.
4. **JSON output** -- add `--output json` only to read-only `azd ai agent` commands such as `show`. Do not add it to `azd ai agent invoke`; invoke supports `default` and `raw`, not `json`.
5. **One file** -- the agent is defined as a service block in `azure.yaml` (`host: azure.ai.agent`). See [azd-ai-cli](../azd-guidance/references/azd-ai-cli.md).
6. **Reserved env vars** -- `FOUNDRY_*` and `AGENT_*` are platform-injected at runtime; `AI_PROJECT_DEPLOYMENTS`, `AI_PROJECT_RESOURCES`, and `AI_PROJECT_TOOL_CONNECTIONS` are extension-managed transport for Bicep. Never set any of these with `azd env set` -- edit `azure.yaml` and re-run `azd ai agent init`.

## Non-Interactive / YOLO Mode

> Even in `--no-prompt` / `--yolo` mode, don't skip these two:
> - **Project:** if the user named a project or asked to create one, go ahead; otherwise stop and ask before provisioning.
> - **Toolbox/connection:** create it only when the user asked you to; otherwise leave the configs as placeholders and ask.

Defaults when unspecified: greenfield + Python + `azd ai agent sample list --language python --output json`, choose the samples based on [azd Sample Selection Guidance](create-hosted--quick-reference-when-to-use-this-skill-hosted-vs-prompt.md#azd-sample-selection-guidance), plus `--no-prompt` on every write. Always set the subscription and location after init as shown in Step 4a. If creating a new project and the user did not provide a project name, auto-generate one using the pattern `ai-project-<random>` (6-8 lowercase alphanumeric characters). Show the generated name to the user but do not block on confirmation. If using an existing project, ensure `azd ai agent init` receives `--project-id`: use the supplied ARM ID, or run the Step 2 resolve script for the supplied Foundry project endpoint and pass the returned `id`. If the user did not ask to create a new project and did not supply an existing one (ARM ID / endpoint), stop and ask which to use before provisioning. If `az` or `azd` is missing, ask before installing in interactive mode; install directly in non-interactive mode. In any mode, never run `az login` or `azd auth login`; stop and ask the user to log in manually before re-running Step 1. If the manifest declares secret parameters, collect them with `ask_user` and set them via `azd env set PARAM_...` before init -- keep `--no-prompt` (do not fall into azd's interactive prompts).

## Error Handling

| Error | Fix |
|-------|-----|
| `extension not installed` | `azd extension install azure.ai.agents` |
| `not_logged_in` / `login_expired` | Ask user to run `az login` and `azd auth login`; never run those commands for them. |
| `unknown flag: --subscription` / `--location` on `azd ai agent init` | After init, set both values with `azd env set AZURE_SUBSCRIPTION_ID=<id> AZURE_LOCATION=<region>`. |
| the agent service's `environmentVariables` contain literal `{{AZURE_AI_MODEL_DEPLOYMENT_NAME}}` placeholder after init | Init deferred model resolution. **Do not blindly re-run init** (default prompt = `<name>-2`; `--no-prompt` silently auto-suffixes). Pick one of the three [recovery paths](create-hosted--quick-reference-when-to-use-this-skill-hosted-vs-prompt.md#model-deployments-azd-golden-path): clean re-init after deleting `src/<name>/`, interactive overwrite, or hand-fix `azure.yaml` + replace `{{...}}` with `${AZURE_AI_MODEL_DEPLOYMENT_NAME}` and `azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME <name>`, then `azd provision`. |
| `azure.yaml` has duplicate `<service>-2` entry after re-running init | Init is not idempotent: interactive default is "Use a different service name" and `--no-prompt` silently appends `-2`. To recover, delete the `<service>-2` entry from `azure.yaml`, remove `src/<service>-2/`, then `azd provision`. |
| `invalid character 'n' after object key:value pair` during `azd provision` | You used `azd env set AI_PROJECT_DEPLOYMENTS '[...]'` (single-escaped JSON breaks Bicep `json()`). Clear it (`azd env set AI_PROJECT_DEPLOYMENTS ""`), declare the deployment in `azure.yaml services.ai-project.deployments[]` instead, then re-run `azd provision` (its `preprovision` hook re-syncs `AI_PROJECT_DEPLOYMENTS` with the correct double-escaping). |
| `missing_project_endpoint` | Run `azd provision`, or `azd env set AZURE_AI_PROJECT_ENDPOINT <url>` |
| `project_not_found` | cwd has no `azure.yaml`; move to project root or run init |
| Secret parameter prompt under `--no-prompt` | In an empty workspace, choose a simpler sample without secret parameters. In an existing azd project, set `PARAM_<CONN>_<KEY>` with `azd env set` before init; keep `--no-prompt`. |
| `cannot use --version with --local` | Drop `--version`, or drop `--local` to hit the deployed agent |
| `could not detect project type` | Set `startupCommand` in `azure.yaml` or pass `--start-command` |
| Local run issue | Follow [local-run](references/local-run.md) common failures |

Run `azd ai agent doctor --output json` to surface failing checks with `suggestion` fields.

