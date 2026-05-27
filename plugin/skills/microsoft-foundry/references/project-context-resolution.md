# Project Context Resolution

> **Scope:** Applies to **deploy, invoke, observe, trace, troubleshoot, eval-datasets, faos-optimize** workflows. Does **not** apply to **create** (which uses `azd ai agent` CLI -- see [create](../foundry-agent/create/create-hosted.md)).

Run this procedure **only when you need configuration values you don't already have**. If a value (for example, agent root, environment, project endpoint, or agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

## Step 1: Discover Agent Roots

Search the workspace for `.foundry/` folders that contain `agent-metadata.yaml` or `agent-metadata.<env>.yaml`.

- **One match** -> use that agent root.
- **Multiple matches** -> require the user to choose the target agent folder.
- **No matches** -> for deploy workflows, seed a new `.foundry/` folder during setup; for all other workflows, stop and ask the user which agent source folder to initialize.

After selecting an agent root, keep all local `.foundry` cache inspection, source inspection, evaluator suggestions, dataset suggestions, and prompt-optimization context inside that folder only. Do **not** scan sibling agent folders unless the user explicitly switches roots.

## Step 2: Select Metadata File and Resolve Environment

Inside the selected agent root, choose the metadata file in this order:
1. Metadata filename or path explicitly provided by the user or workflow
2. If an explicit environment is already known and `.foundry/agent-metadata.<env>.yaml` exists, use that file
3. `.foundry/agent-metadata.yaml`
4. If multiple metadata files remain and no rule above selects one, prompt the user to choose

Read the selected metadata file and resolve the environment in this order:
1. Environment explicitly named by the user
2. If the selected metadata file defines exactly one environment, use it
3. Environment already selected earlier in the session
4. `defaultEnvironment` from metadata

If the selected metadata file still contains multiple environments and none of the rules above selects one, prompt the user to choose. Keep the selected agent root, metadata file, and environment visible in every workflow summary.

### Legacy metadata migration (observe / eval-datasets only)

If the selected environment exposes older `testSuites[]` metadata but not `evaluationSuites[]`, treat `testSuites[]` as the source for this session and normalize each entry in memory to the `evaluationSuites[]` shape before continuing. If the metadata is older still and only exposes legacy `testCases[]`, normalize that list the same way. Preserve dataset and evaluator fields, keep any existing `tags`, and map legacy `priority` to `tags.tier` only when `tags.tier` is missing: `P0` -> `smoke`, `P1` -> `regression`, `P2` -> `coverage`.

## Step 3: Resolve Common Configuration

Use the selected environment in the selected metadata file as the primary source:

| Metadata Field | Resolves To | Used By |
|----------------|-------------|---------|
| `environments.<env>.projectEndpoint` | Project endpoint | deploy, invoke, observe, trace, troubleshoot |
| `environments.<env>.agentName` | Agent name | invoke, observe, trace, troubleshoot |
| `environments.<env>.azureContainerRegistry` | ACR registry name / image URL prefix | deploy |
| `environments.<env>.evaluationSuites[]` | Dataset + evaluator + tag bundles | observe, eval-datasets |

## Step 4: Bootstrap Missing Metadata (Deploy Only)

If deploy is initializing a new `.foundry` workspace and metadata fields are still missing, check if `azure.yaml` exists in the project root. If found, run `azd env get-values` and use it to seed `agent-metadata.yaml` by default, or `agent-metadata.<env>.yaml` when the workflow explicitly targets a separate environment-specific file.

| azd Variable | Seeds |
|-------------|-------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | `environments.<env>.projectEndpoint` |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | `environments.<env>.azureContainerRegistry` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription for trace/troubleshoot lookups |

### Metadata write rules (observe / eval-datasets only)

On any metadata write (deploy, auto-setup, dataset refresh, or trace-to-dataset update), persist only `evaluationSuites[]` in the selected metadata file. If the selected file is a preferred single-environment file, rewrite only that one environment block. If the selected file is a legacy multi-environment file, rewrite only the selected environment block. Never copy or merge environments across sibling metadata files automatically. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite it to `evaluationSuites[]` and remove migrated `priority` fields from the rewritten entries.

## Step 5: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, metadata, or azd bootstrap. Common values skills may need:
- **Agent root** -- Target folder containing `.foundry/agent-metadata*.yaml`
- **Metadata file** -- `agent-metadata.yaml` for local/dev, or an explicit sidecar such as `agent-metadata.prod.yaml`
- **Environment** -- `dev`, `prod`, or another environment key from metadata
- **Project endpoint** -- AI Foundry project endpoint URL
- **Agent name** -- Name of the target agent

> **Tip:** If the user already provides the agent path, environment, project endpoint, or agent name, extract it directly -- do not ask again.
