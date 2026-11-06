# Agent Metadata Contract

Use this contract for Microsoft Foundry agent folders. In azd projects, `.foundry/agent-metadata*.yaml` is an overlay/cache, not the source of truth for azd-owned deployment context.

## Local Layout

```text
<agent-root>/
  .foundry/
    agent-metadata.yaml
    agent-metadata.<env>.yaml
    suites/
    datasets/
    evaluators/
    results/
```

- `agent-metadata.yaml` is the preferred local/dev overlay.
- Optional `agent-metadata.<env>.yaml` files can hold a single prod or CI-targeted overlay.
- `suites/`, `datasets/`, `evaluators/`, and `results/` are local cache/result folders. Ask before overwriting user-edited files.

## Effective Context Model

Resolve deployment and evaluation context by layering sources in this order:

| Value | Preferred source | Fallbacks | Metadata write behavior |
|-------|------------------|-----------|-------------------------|
| Agent root | `azure.yaml` service `project` for `host: azure.ai.agent` | `.foundry` discovery, user path | Do not write except to initialize cache |
| Environment | user/session, then azd env/default | metadata `defaultEnvironment` | Store azd binding only when useful |
| Project endpoint | `azd env get-values` | metadata, user input | Do not duplicate azd values |
| Agent name/version | azd `AGENT_<SERVICE>_*` vars | `azure.yaml`, metadata, user input | Do not duplicate azd values |
| ACR | azd registry vars | metadata, user input | Do not duplicate azd values |
| Observability | azd App Insights vars | metadata, user input | Do not copy secrets if azd has them |
| Local eval draft | `eval.yaml` | metadata, user input | Sync to `.foundry` only after remote lookup/registration |
| Remote suite/cache refs | metadata | Foundry lookups | Persist in `.foundry` |

If azd and metadata both provide the same value and differ, stop and ask which source is authoritative. If they match, use the azd value and omit the duplicate on future metadata rewrites.

## Environment Overlay Model

| Field | Required when | Purpose |
|-------|---------------|---------|
| `defaultEnvironment` | Any metadata file exists | Default key inside this overlay file |
| `environments.<env>.azd.environmentName` | Optional | Binds overlay to an azd environment |
| `environments.<env>.azd.service` | Optional | Binds overlay to an `azure.yaml` service |
| `environments.<env>.projectEndpoint` | Required for non-azd/manual workflows | Explicit override when azd cannot resolve it |
| `environments.<env>.agentName` / `agentVersion` | `agentName` required for non-azd/manual workflows; `agentVersion` optional | Explicit override when azd cannot resolve it |
| `environments.<env>.azureContainerRegistry` | Required for non-azd/manual hosted-agent Docker/ACR deploy flow | Explicit override when azd cannot resolve it |
| `environments.<env>.observability.*` | Required only for trace workflows when azd cannot resolve observability | Trace lookup config when azd cannot resolve it |
| `environments.<env>.evaluationSuites[]` | Required after evaluation setup/sync | Remote suite/dataset/evaluator refs plus local cache paths |
| `environments.<env>.lastEval` | Optional | Last local result summary and result file path |

## Example azd Overlay

```yaml
defaultEnvironment: dev
environments:
  dev:
    azd:
      environmentName: <azd-env-name>
      service: <azure-yaml-service-name>
    evaluationSuites:
      - id: smoke-core
        suiteName: <foundry-suite-name>
        suiteVersion: "1"
        generationSource: eval-yaml
        tags:
          tier: smoke
          purpose: baseline
        suiteFile: .foundry/suites/<suite>-v1.json
        dataset: <dataset-name>
        datasetVersion: "1"
        datasetFile: .foundry/datasets/<agent>-<dataset>-v1.ref.json
        datasetUri: <foundry-dataset-uri>
        evaluators:
          - name: <evaluator-name>
            version: "1"
            threshold: 4
            definitionFile: .foundry/evaluators/<evaluator>-v1.json
```

## Example Manual Overlay

```yaml
defaultEnvironment: dev
environments:
  dev:
    projectEndpoint: https://<account>.services.ai.azure.com/api/projects/<project>
    agentName: <agent-name>
    azureContainerRegistry: <registry>.azurecr.io
    evaluationSuites:
      - id: smoke-core
        datasetFile: .foundry/datasets/<agent>-smoke-v1.ref.json
        evaluators:
          - name: relevance
            threshold: 4
```

## eval.yaml Mapping

When `eval.yaml` exists in the selected agent root, treat it as local evaluation intent, not proof of a Foundry suite.

| eval.yaml field | Use |
|-----------------|-----|
| `agent.name` | Candidate target agent; verify it matches selected context |
| `dataset.local_uri` | Local seed dataset candidate |
| `dataset.name`, `dataset.version` | Registered dataset candidate |
| `validation_dataset` | Optional validation dataset candidate |
| `evaluators[]` | Candidate evaluator names; verify with `evaluator_catalog_get` |
| `name` | Candidate eval/suite name; verify remotely before storing as `suiteName` |
| `options.eval_model` | Candidate judge/generation deployment |
| `options.optimization_model` | Candidate optimizer reasoning deployment |
| `options.max_candidates` | Candidate optimization iteration limit |
| `options.optimization_config.model_search_space` | Candidate target model search space |
| `options.pass_threshold` | Candidate evaluator threshold/default pass gate |
| `max_samples`, `trace_days`, `generation_instruction` | Suite setup defaults |

Legacy `dataset_file`, `dataset_reference`, and `validation_reference` keys may be normalized in memory when reading older files, but new files should use `dataset` and `validation_dataset`.

Persist eval.yaml-derived suite metadata only after the relevant dataset/evaluator/suite has been registered or found in Foundry. Use `generationSource: eval-yaml` for synced suite entries created from local eval config.

## Workflow Rules

1. Prefer azd service discovery before `.foundry` discovery when `azure.yaml` has `host: azure.ai.agent`.
2. Once an agent root is selected, use only that root's `.foundry`, source tree, `azure.yaml`, and `eval.yaml` unless the user switches roots.
3. Select metadata files in this order: explicit file/path, environment sidecar, `.foundry/agent-metadata.yaml`, then prompt if ambiguous.
4. Resolve environment from user/session, azd env/default, single-environment metadata, then `defaultEnvironment`.
5. Keep the selected root, environment, metadata overlay file, and primary context source visible in deploy/eval/trace summaries.
6. Treat metadata deployment fields as overrides when azd cannot resolve the value.
7. Treat `evaluationSuites[]` as the canonical synced suite model; normalize legacy fields in memory before use.
8. Writes target only the selected metadata file and selected environment. Never merge sibling metadata files automatically.
9. On metadata rewrites for azd projects, persist non-derivable overlay/cache state and omit azd-owned deployment duplicates.
10. Never silently overwrite cache files or metadata. Show a summary before refreshing, pruning duplicate fields, or replacing suite refs.

## Legacy Compatibility

If the selected environment has `testSuites[]` but no `evaluationSuites[]`, treat `testSuites[]` as the current suite source and migrate it on the next metadata write. If it has only legacy `testCases[]`, normalize that list the same way.

Preserve `id`, `suiteName`, `suiteVersion`, `generationJobId`, `generationSource`, `dataset`, `datasetVersion`, `datasetFile`, `datasetUri`, `evaluators`, and existing `tags`. Map legacy `priority` to `tags.tier` only when `tags.tier` is missing: `P0` -> `smoke`, `P1` -> `regression`, `P2` -> `coverage`.

## Evaluation Suite Guidance

Use `tags` as freeform key/value metadata. Suggested keys: `tier` (`smoke`, `regression`, `coverage`), `purpose` (`baseline`, `safety`, `tools`, `quality`), and `stage` (`local`, `generated`, `traces`, `curated`, `prod`).

Each synced suite should point to one dataset and one or more evaluators with thresholds. Store stable remote names separately from versions, keep local cache filenames versioned, and persist `suiteFile`, `datasetFile`, `datasetContentPath`, `datasetUri`, and evaluator `definitionFile` when available. Local dataset filenames should start with the effective Foundry agent name. Use evaluation-suite IDs in evaluation names, result folders, and regression summaries.

For generated Foundry suites, persist `suiteName`, `suiteVersion`, `generationJobId`, and `generationSource`. `suiteName` must start with a letter (`A-Z` or `a-z`); prefix derived numeric names with an alphabetic label such as `suite-`. A suite with `suiteName` still runs batch eval through `evaluation_agent_batch_eval_create`; use `evaluation_suite_get` only to resolve reviewed dataset/evaluator metadata.

## Detailed Context Resolution

Agent skills should run this step **only when they need configuration values they don't already have**. If a value (for example, agent root, environment, project endpoint, or agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

### Step 1: Discover Agent Roots and azd Context

First check whether the workspace has `azure.yaml` with services using `host: azure.ai.agent`.

- **One azd agent service** -> classify it from `kind`, `harness`, `modelType`, and `conversationEngine`, then use that service's `project` folder or the `azure.yaml` directory as the agent root.
- **Multiple azd agent services** -> check whether a Voice wrapper references a `kind: hosted` service via `conversationEngine.name`:
  - **Selecting the Hosted Voice wrapper** implies its named `kind: hosted` target as an upstream dependency (`uses: [<target>]`, `conversationEngine.name: <target>`); deploy and verification must report both services separately.
  - **Selecting the `kind: hosted` target alone** scopes changes/debugging to the target container and does not automatically modify the wrapper.
  - **Otherwise** -> require the user to choose the target service/folder.
- **No azd agent service** -> search the workspace for `.foundry/` folders that contain `agent-metadata.yaml` or `agent-metadata.<env>.yaml`.
  - **One match** -> use that agent root.
  - **Multiple matches** -> require the user to choose the target agent folder.
  - **No matches** -> for [insights](../foundry-agent/insights/insights.md), ask only for missing remote inputs without initializing local files; for create/deploy workflows, seed a new `.foundry/` folder during setup; for other workflows, stop and ask the user which agent source folder to initialize.

After selecting an agent root, keep all local `.foundry` cache inspection, source inspection, evaluator suggestions, dataset suggestions, and prompt-optimization context inside that folder only. Do **not** scan sibling agent folders unless the user explicitly switches roots.

### Step 2: Resolve Environment and Deployment Context

If `azure.yaml` is present, resolve the azd environment first:

1. Environment explicitly named by the user
2. `AZURE_ENV_NAME` from `azd env get-values`
3. azd default environment from `.azure/config.json`
4. Environment already selected earlier in the session

Run `azd env get-values` for the selected environment when project/deployment values are not already known. Prefer azd values for deployment context:

| azd Variable | Resolves To |
|-------------|-------------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | Project endpoint |
| `AGENT_<SERVICE>_NAME` | Agent name for the selected azd service |
| `AGENT_<SERVICE>_VERSION` | Agent version for the selected azd service |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry name / image URL prefix |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string for trace workflows |
| `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_AI_ACCOUNT_NAME`, `AZURE_AI_PROJECT_NAME` | Azure resource lookup and Playground links |

When azd supplies these values, use them as the source of truth and do not copy them into `.foundry/agent-metadata*.yaml` on metadata writes.

### Step 3: Select Metadata Overlay and Resolve Environment

Inside the selected agent root, choose the metadata file in this order:
1. Metadata filename or path explicitly provided by the user or workflow
2. If an explicit environment is already known and `.foundry/agent-metadata.<env>.yaml` exists, use that file
3. `.foundry/agent-metadata.yaml`
4. If multiple metadata files remain and no rule above selects one, prompt the user to choose

Read the selected metadata file and resolve any remaining environment choice in this order:
1. Environment explicitly named by the user
2. If the selected metadata file defines exactly one environment, use it
3. Environment already selected earlier in the session
4. `defaultEnvironment` from metadata

If the selected metadata file still contains multiple environments and none of the rules above selects one, prompt the user to choose. Keep the selected agent root, metadata file, environment, and whether context came from azd or metadata visible in every workflow summary.

If the selected environment exposes older `testSuites[]` metadata but not `evaluationSuites[]`, treat `testSuites[]` as the source for this session and normalize each entry in memory to the `evaluationSuites[]` shape before continuing. If the metadata is older still and only exposes legacy `testCases[]`, normalize that list the same way. Preserve dataset and evaluator fields, keep any existing `tags`, and map legacy `priority` to `tags.tier` only when `tags.tier` is missing: `P0` -> `smoke`, `P1` -> `regression`, `P2` -> `coverage`.

### Step 4: Resolve eval.yaml Local Evaluation Intent

If `eval.yaml` exists in the selected agent root, parse it before generating new suites:

- `agent.name` -> target agent candidate; verify it matches the selected azd/metadata agent before using it.
- `dataset.local_uri` -> local seed dataset candidate; legacy `dataset_file` may be normalized in memory.
- `dataset.name` / `dataset.version` -> registered dataset candidate.
- `validation_dataset` -> optional validation dataset candidate.
- `evaluators[]` -> candidate Foundry evaluator names; verify with `evaluator_catalog_get` before treating them as remote evaluators.
- `name` -> local eval/suite candidate; verify remotely before persisting as `suiteName`.
- `options.eval_model`, `options.optimization_model`, `options.max_candidates`, `options.optimization_config.model_search_space`, `options.pass_threshold`, `max_samples`, `trace_days`, and `generation_instruction` -> setup defaults.

Treat `eval.yaml` as local evaluation intent, not proof that a Foundry suite exists. Persist synced suite/dataset/evaluator references to `.foundry` only after remote lookup or registration succeeds.

### Step 5: Resolve Common Configuration

Layer sources in this order:

1. Explicit user input and values already selected in the session
2. azd environment values for deployment context
3. `.foundry/agent-metadata*.yaml` overlay values and remote suite/cache references
4. `azure.yaml` and `eval.yaml` local source configuration
5. User prompts for anything still missing

If azd and metadata both provide the same value and they differ, stop and ask which source is authoritative. If they match, use the azd value and avoid rewriting the duplicate on future metadata writes.

| Effective Value | Preferred Source | Used By |
|-----------------|------------------|---------|
| Project endpoint | azd env | deploy, invoke, observe, trace, troubleshoot |
| Agent name/version | azd agent variables, then `azure.yaml` | invoke, observe, trace, troubleshoot |
| ACR | azd env | deploy |
| Evaluation suites and cache paths | `.foundry/agent-metadata*.yaml` | observe, eval-datasets |
| Local seed dataset/evaluator intent | `eval.yaml` | observe, eval-datasets |

### Step 6: Write Metadata Overlay (Create/Deploy/Observe Only)

On any metadata write (deploy, auto-setup, dataset refresh, or trace-to-dataset update), persist only non-derivable overlay/cache state in the selected metadata file:

- azd binding (`azd.environmentName`, `azd.service`) when useful for future resolution
- `evaluationSuites[]` with remote suite/dataset/evaluator references and local cache paths
- `lastEval`, result files, comparison summaries, or explicit non-azd overrides

Do not copy azd-owned deployment values into metadata when azd already provides them. If the selected file is a preferred single-environment file, rewrite only that one environment block. If the selected file is a legacy multi-environment file, rewrite only the selected environment block. Never copy or merge environments across sibling metadata files automatically. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite it to `evaluationSuites[]` and remove migrated `priority` fields from the rewritten entries.

### Step 7: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, metadata, or azd bootstrap. Common values skills may need:
- **Agent root** — Target azd service project folder or folder containing `.foundry/agent-metadata*.yaml`
- **Metadata file** — `agent-metadata.yaml` for local/dev, or an explicit sidecar such as `agent-metadata.prod.yaml`
- **Environment** — azd environment, `dev`, `prod`, or another environment key from metadata
- **Project endpoint** — Microsoft Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user already provides the agent path, environment, project endpoint, or agent name, extract it directly — do not ask again.
