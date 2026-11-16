# Selected guidance: Pre-Execution Requirements; Dependency Check and Setup; Workflow Guidance; Foundry MCP; azd; Sub-Skills

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

## Pre-Execution Requirements

Follow each applicable subsection below before starting its corresponding action or workflow.

### Dependency Check and Setup

No dependency check or setup script runs on load. The retained
`scripts/check-and-setup-dependencies.sh` and `.ps1` can install the
`microsoft.foundry` azd extension; they are **not read-only probes**.
azd is optional only for an explicitly selected eligible workflow with
separately approved CLI use. Review dependencies and side effects first.
No automatic installs, authentication changes or script execution are allowed.

### Workflow Guidance

**MANDATORY:** Before executing ANY workflow-specific steps, you MUST read the corresponding sub-skill document. Do not call workflow-specific MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters — the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

### Foundry MCP

For an approved live-tool workflow, discover the actually available Foundry,
Foundry extensions or Monitor operations and their schemas through the host's
supported help/discovery surface. Upstream names are examples, not proof that
an operation exists. Missing operations are blockers, not permission to install
tools, change identity, or replace them with scripts/REST.

### azd

**MANDATORY:** Before executing ANY azd command, you MUST read [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) and strictly follow the shared rules defined in it, especially the `AZURE_DEV_USER_AGENT` setting rules.

## Sub-Skills

