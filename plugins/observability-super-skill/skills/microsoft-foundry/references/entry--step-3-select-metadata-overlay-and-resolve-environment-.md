# Selected guidance: Step 3: Select Metadata Overlay and Resolve Environment; Step 4: Resolve eval.yaml Local Evaluation Intent

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

Do not run `azd env get-values` or read a full environment file. If context is
missing, request only the required nonsecret identifier or use an approved,
selective metadata read. The variable names below are legacy hints, not
permission to retrieve secret values:

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
