# Selected guidance: Step 1: Discover Agent Roots and azd Context; Step 2: Resolve Environment and Deployment Context

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

**Investigation override:** use the coordinator's confirmed context or supplied
evidence first. No local metadata/cache, azd or sign-in is required for analysis.
The optional legacy resolution below applies only to missing nonsecret values;
skip initialization, registration and metadata writes unless separately approved.
Never use broad environment dumps. Conflicting target hints require clarification,
not switching targets or silently broadening scope.

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

