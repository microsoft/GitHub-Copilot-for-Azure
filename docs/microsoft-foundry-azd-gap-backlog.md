# Microsoft Foundry skill: azd coverage gap backlog

## Contents

- [1. Purpose](#1-purpose)
- [2. Bundle-defined audit scope](#2-bundle-defined-audit-scope)
- [3. Priority summary](#3-priority-summary)
- [4. Concise next-stage plan](#4-concise-next-stage-plan)
- [5. P0 — Fix inconsistent logic](#5-p0--fix-inconsistent-logic)
- [6. P1 — Complete high-value bundled workflows](#6-p1--complete-high-value-bundled-workflows)
- [7. Explicitly out of scope](#7-explicitly-out-of-scope)
- [8. Recommended delivery order](#8-recommended-delivery-order)
- [9. Validation plan](#9-validation-plan)

## 1. Purpose

This document identifies azd capabilities that are already implemented in the `azure-dev` source but are missing, incomplete, or inconsistent in the `microsoft-foundry` skill.

The goal is not to turn the skill into a complete azd command reference. The goal is to make the skill reliable for Microsoft Foundry workflows while keeping its routing description and runtime instructions concise.

This is a planning artifact only. It does not modify the skill or represent completed implementation work.

The backlog follows these rules:

1. Correct misleading instructions before adding new functionality.
2. Prioritize source capabilities by user value and fit with the Foundry skill.
3. Prefer complete user workflows over command enumeration.
4. Keep one canonical explanation for each command or lifecycle rule and link to it from other workflows.
5. Keep detailed CLI syntax in workflow or reference files rather than expanding the main `SKILL.md` description.

## 2. Bundle-defined audit scope

| Item | Baseline |
|---|---|
| Target skill | `plugin/skills/microsoft-foundry` in this repository |
| azd source | `C:\Users\anchenyi\projects\azure-dev` |
| azd commit | `105d7e9fa41eece4c563b3b56e51526937eb1fdd` |
| azd version | `1.27.1` |
| Audit date | 2026-07-13 |

The azd scope is defined by the dependencies in `microsoft.foundry/extension.yaml`:

| Bundled extension | In scope capability |
|---|---|
| `azure.ai.agents` | Agent initialization, local run, invoke, deploy integration, lifecycle, evaluation/optimization commands, files, and sessions |
| `azure.ai.connections` | Project connection CRUD and declarative connection services; expanded authentication documentation is excluded from this pass |
| `azure.ai.inspector` | Bundled, but standalone `azd ai inspector launch` is excluded from this planning pass; only Agent `run` integration is relevant to P0 consistency |
| `azure.ai.projects` | `azure.ai.project` service behavior used by the declarative lifecycle; context/default commands are excluded from this pass |
| `azure.ai.routines` | Routine CRUD, dispatch, run history, and declarative routine services |
| `azure.ai.skills` | Foundry skill CRUD/versioning and declarative skill services |
| `azure.ai.toolboxes` | Toolbox CRUD/versioning, connections/skills, and declarative toolbox services |

Source: [`microsoft.foundry/extension.yaml`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/microsoft.foundry/extension.yaml#L10)

The comparison includes:

- core azd behavior used directly by Foundry workflows;
- capabilities owned by the bundled extensions above;
- the actual `azure.yaml` service-target lifecycle;
- command and flag behavior implemented in source.

Capabilities owned by non-bundled extensions are outside this planning scope. Priority is based on correctness, user value, and fit with the existing Foundry Agent workflow.

## 3. Priority summary

| Priority | ID | Work item | Why it matters |
|---|---|---|---|
| P0 | P0-1 | Fix inconsistent invoke confirmation logic | The skill can generate an invalid `azd ai agent invoke --force` command. |
| P0 | P0-2 | Fix inconsistent agent command inventory | The documented `files show` and `sessions update` commands do not exist. |
| P0 | P0-3 | Fix inconsistent local-run guidance | The skill recommends a deprecated flag and omits Node.js support. |
| P0 | P0-4 | Fix inconsistent named local invoke logic | The skill rejects a scenario that azd now explicitly supports. |
| P0 | P0-5 | Fix inconsistent init deploy-mode logic | The documented non-interactive default is the opposite of the implemented default when code deployment is available. |
| P0 | P0-6 | Fix inconsistent declarative resource lifecycle | Existing connection/toolbox guidance disagrees on the schema and on whether provision or deploy applies each resource. |
| P0 | P0-7 | Fix inconsistent protocol naming | The skill treats `invocations` as A2A even though they are distinct protocols. |
| P1 | P1-1 | Add A2A and activity protocol workflows | The skill does not cover these two azd-supported protocol paths. |
| P1 | P1-2 | Add agent lifecycle management | Delete, endpoint inspection, and code download are missing. |

## 4. Concise next-stage plan

### P0 — Fix inconsistent logic

- Fix invoke confirmation logic and unsupported flags
- Fix agent command inventory and file operations
- Fix local-run guidance across supported runtimes
- Fix named local invocation for multi-agent projects
- Fix init deploy-mode defaults and selection
- Fix declarative connection and toolbox lifecycle
- Fix protocol naming and invocation guidance

### P1 — Add missing azd workflows

- Add A2A and activity protocol workflows
- Add agent lifecycle commands: delete, endpoint show, and code download

## 5. P0 — Fix inconsistent logic

P0 is correctness work. These changes should land before new coverage because the current skill can produce commands or configuration that conflict with the current azd implementation.

### P0-1 — Fix inconsistent invoke confirmation logic

**Current inconsistency**

- `foundry-agent/create/quick-start-hosted.md` correctly states that `azd ai agent invoke` has no `--force` flag.
- `foundry-agent/deploy/deploy.md` instructs the agent to rerun `azd ai agent invoke` with `--force` after consent.
- The troubleshooting table in the quick start already recognizes `unknown flag: --force` as an error.

**azd source behavior**

The invoke command registers flags for local invocation, input files, protocol, port, timeout, session, conversation, identity, call ID, client headers, endpoint, version, and output. It does not register `--force`.

Source: [`invoke.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/invoke.go#L267)

**Required change**

The current `azure.ai.agents` source does not define a `confirmation_required` or `confirmCommand` contract. Those terms currently come from the skill/orchestration layer, so they must not be attributed to the CLI implementation.

Use one confirmation rule everywhere:

1. Run the invoke command without inventing confirmation flags.
2. If the surrounding skill/orchestration layer returns a confirmation contract, summarize its changes and cost implications.
3. Continue only after the user has authorized the remote invocation.
4. Follow an exact `confirmCommand` when the active orchestration contract provides one; do not synthesize one.
5. Never append `--force` to `azd ai agent invoke`.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/deploy/deploy.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/quick-start-hosted.md`
- `plugin/skills/microsoft-foundry/foundry-agent/invoke/invoke.md`

**Acceptance criteria**

- No positive instruction recommends `azd ai agent invoke --force`.
- Negative troubleshooting examples may mention the invalid flag only to explain its removal.
- Deploy, quick-start, and invoke workflows use the same confirmation policy.

### P0-2 — Fix inconsistent agent command inventory

**Current inconsistency**

`foundry-agent/create/references/azd-ai-cli.md` lists:

- `azd ai agent files ... show ...`
- `azd ai agent sessions ... update ...`

Neither subcommand exists in the current agent extension.

**azd source behavior**

The implemented command groups are:

```text
azd ai agent files
├─ upload
├─ download
├─ list
├─ delete
├─ mkdir
└─ stat

azd ai agent sessions
├─ create
├─ show
├─ stop
├─ delete
└─ list
```

Sources:

- [`files.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/files.go#L49)
- [`session.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/session.go#L53)

`sessions stop` stops session compute while preserving its filesystem. `sessions delete` removes both compute and filesystem state. The distinction is operationally important and should not be represented as a generic update operation.

**Required change**

- Replace `files show` with `files stat` where metadata inspection is intended.
- Replace `sessions update` with `sessions stop`.
- Add a concise azd file-operations section covering `upload`, `download`, `list`, `stat`, `mkdir`, and `delete`.
- Explain that `stat` inspects a remote path and that recursive delete must be explicit.
- Keep sessions limited to the corrected command inventory and one sentence distinguishing stop from delete; do not create a separate sessions workflow.
- Treat the command inventory in `azd-ai-cli.md` as canonical and link to it instead of copying the tree into multiple workflow files.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/create/references/azd-ai-cli.md`

**Acceptance criteria**

- Every documented files and sessions subcommand exists in the source command tree.
- The reference includes one compact, accurate azd file-operations section.
- Stop and delete are not presented as interchangeable operations.

### P0-3 — Fix inconsistent local-run guidance

**Current inconsistency**

- The local-run reference says azd detects Python and .NET projects but omits Node.js.
- Several files actively recommend `--no-inspector`.
- The current CLI keeps `--no-inspector` only as a hidden deprecated alias.

**azd source behavior**

`azd ai agent run` detects Python, .NET, and Node.js. The protocol-neutral flag is `--no-client`; `--no-inspector` is deprecated and retained only for backward compatibility. For the activity protocol, the local client is Microsoft 365 Agents Playground rather than Agent Inspector.

Source: [`run.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/run.go#L59)

**Required change**

- Describe local project detection as Python, .NET, and Node.js.
- Use `--no-client` in active instructions and examples.
- Mention `--no-inspector` only as a deprecated compatibility alias when troubleshooting older commands.
- Describe the client by protocol: Agent Inspector for responses/invocations and Microsoft 365 Agents Playground for the activity protocol.
- Do not imply that Node.js supports direct ZIP code deployment; current direct code deployment runtimes remain Python and .NET, while Node.js uses the container path.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/create/references/local-run.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/quick-start-hosted.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/skills/skill-attach.md`

**Acceptance criteria**

- Active commands use `--no-client`.
- Node.js is included in runtime detection guidance.
- Inspector-specific wording is not incorrectly applied to the activity protocol.

### P0-4 — Fix inconsistent named local invoke logic

**Current inconsistency**

The local-run troubleshooting table says a named agent cannot be used with `--local` and instructs the caller to drop the name.

**azd source behavior**

Named local invocation is explicitly supported for multi-agent projects:

```bash
azd ai agent invoke my-agent --local "Hello!"
```

Source: [`invoke.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/invoke.go#L144)

The support was introduced in the agent extension changelog under PR `#8771`.

**Required change**

- Remove the obsolete `cannot use --local with a named agent` troubleshooting entry.
- Add the named form as the preferred example when a project contains multiple agent services.
- Keep the unnamed form for single-agent projects.

**Target file**

- `plugin/skills/microsoft-foundry/foundry-agent/create/references/local-run.md`

**Acceptance criteria**

- The skill no longer rejects named local invocation.
- Multi-agent local-run guidance selects the intended service explicitly.

### P0-5 — Fix inconsistent init deploy-mode logic

**Current inconsistency**

The create workflow and azd CLI reference state that non-interactive init defaults to container deployment unless `--deploy-mode code` is supplied.

**azd source behavior**

The implemented resolution order is:

1. An explicit `--deploy-mode` wins.
2. If code deployment is unsupported for the detected project, use container deployment.
3. A user-provided manifest selects code deployment by default.
4. `--no-prompt` selects code deployment by default when code deployment is available.
5. Interactive selection defaults to code deployment.

Source: [`init_from_code.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/init_from_code.go#L1030)

**Required change**

Replace the unconditional container-default statement with conditional guidance:

- Code deployment is the default for eligible Python/.NET source.
- Container deployment remains the fallback for unsupported project types, including Node.js deployment, and the explicit choice for Dockerfile/system-package requirements.
- For deterministic automation, pass the desired deploy mode explicitly.
- Use `--image` only with container deployment.

Do not move all flag details into the quick start. Keep the quick start opinionated and place the full resolution rules in the advanced create reference.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/create/create-hosted.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/azd-ai-cli.md`

**Acceptance criteria**

- No instruction claims that non-interactive init always defaults to container deployment.
- The quick start still recommends one clear default path.
- Advanced guidance explains when container deployment is selected.

### P0-6 — Fix inconsistent declarative resource lifecycle

**Current inconsistency**

The skill already covers the declarative agent/project path, a declarative connection/toolbox path, skill lifecycle, and a complete declarative routine path. The gap is not a missing end-to-end capability. It is conflicting guidance inside that existing coverage:

1. `azd-ai-cli.md` says `azd provision` applies connection and toolbox services through Bicep.
2. `deploy.md` likewise says provision creates both declared connections and toolboxes.
3. `tools.md` says `azd deploy` never creates toolboxes and requires an entirely imperative lifecycle.
4. `use-toolbox-in-hosted-agent.md` shows a legacy top-level `params:` and `resources:` shape instead of the current split `services:` model, and names the injected variable `TOOLBOX_ENDPOINT`.

**azd source behavior**

Current source behavior is:

| Host | Lifecycle |
|---|---|
| `azure.ai.project` | Provisioned by the `microsoft.foundry` provisioning provider; deploy target is effectively a no-op. |
| `azure.ai.connection` | Created during provision; package, publish, and deploy are no-ops. |
| `azure.ai.toolbox` | Deploy creates a new toolbox version and writes its MCP endpoint to the azd environment. |
| `azure.ai.skill` | Deploy creates a new immutable version and makes it the default version. |
| `azure.ai.routine` | Deploy performs an idempotent upsert. |

Sources:

- [`connections/service_target.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.connections/internal/cmd/service_target.go#L87)
- [`toolboxes/service_target.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.toolboxes/internal/cmd/service_target.go#L106)
- [`skills/service_target.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.skills/internal/cmd/service_target.go#L102)
- [`routines/service_target.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.routines/internal/cmd/service_target.go#L95)

**Required change**

- Correct the existing references; do not add a synthetic example that combines every Foundry host.
- In `azd-ai-cli.md` and `deploy.md`, state that the connection service is created during provision while the toolbox service is applied during deploy.
- In `tools.md`, distinguish the imperative CLI path from an `azure.ai.toolbox` service deployed through azd.
- Replace the legacy toolbox snippet in `use-toolbox-in-hosted-agent.md` with the current sibling `azure.ai.connection` and `azure.ai.toolbox` service shape, using `uses:` only where the existing workflow needs the dependency.
- Correct the injected toolbox variable name to `TOOLBOX_<NORMALIZED_NAME>_MCP_ENDPOINT`.
- Leave the already complete declarative routine flow and the existing project/agent flow in place unless a concrete contradiction is found.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/create/references/azd-ai-cli.md`
- `plugin/skills/microsoft-foundry/foundry-agent/deploy/deploy.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/tools.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/use-toolbox-in-hosted-agent.md`

**Acceptance criteria**

- Existing declarative examples use the current split-service schema.
- Connection provision and toolbox deploy responsibilities match the current source behavior.
- Imperative and declarative paths are clearly separated.
- The same resource is not described as both automatically managed and never automatically managed.
- Toolbox environment-variable examples use the normalized per-toolbox key.
- No new all-host declarative workflow is added merely for schema completeness.

### P0-7 — Fix inconsistent protocol naming

**Current inconsistency**

`azd-ai-cli.md` describes `invocations` as A2A. Other parts of the skill discuss A2A tools, but the agent protocol matrix does not distinguish A2A from the generic invocations protocol.

**azd source behavior**

The deployment model recognizes distinct protocols including:

- `responses`
- `invocations`
- `invocations_ws`
- `activity`
- `a2a`

`azd ai agent invoke` directly supports `responses`, `invocations`, and `a2a`. A2A is remote-only and accepts either a plain message that azd wraps in JSON-RPC or a complete JSON-RPC input file. The activity protocol uses its local/deployment Playground path rather than `agent invoke`.

Sources:

- [`agent_api/models.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/pkg/agents/agent_api/models.go#L13)
- [`invoke.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/invoke.go#L133)

**Required change**

- Stop labeling `invocations` as A2A.
- Add a concise protocol selection matrix.
- State which protocols `agent invoke` can call directly.
- Route activity protocol testing to Microsoft 365 Agents Playground.
- Route A2A file input to complete JSON-RPC requests.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/create/references/azd-ai-cli.md`
- `plugin/skills/microsoft-foundry/foundry-agent/invoke/invoke.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/local-run.md`

**Acceptance criteria**

- `invocations` and `a2a` are represented as distinct values.
- Local/remote restrictions are correct for each protocol.
- The skill does not suggest `agent invoke` for activity protocol testing.

## 6. P1 — Complete high-value bundled workflows

### P1-1 — Add A2A and activity protocol workflows

**Current gap**

The skill has strong responses, invocations, and WebSocket material, but it does not provide complete A2A or activity protocol workflows.

**Available azd capability**

A2A:

- invoke a deployed endpoint with `azd ai agent invoke --protocol a2a`;
- pass a plain message and let azd create the JSON-RPC request;
- pass a complete JSON-RPC request with `--input-file`;
- use `--output raw` when the protocol response must be preserved;
- remote only; A2A is not supported with `--local`.

Activity protocol:

- declare the `activity` protocol for the agent;
- run it locally with `azd ai agent run`;
- test it through Microsoft 365 Agents Playground;
- use `--channel` for the Playground channel and `--no-client` when the Playground should not open;
- do not use `azd ai agent invoke` for activity protocol testing.

Sources:

- [`invoke.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/invoke.go#L75)
- [`run.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/run.go#L55)

**Recommended skill behavior**

- Add a protocol-selection table that separates A2A from the activity protocol.
- Add an A2A remote-invoke flow for plain messages and JSON-RPC input files.
- Add an activity protocol local-run flow using Microsoft 365 Agents Playground.
- Keep generic advanced invoke flags outside this work item.

**Target files**

- `plugin/skills/microsoft-foundry/foundry-agent/invoke/invoke.md`
- A focused `foundry-agent/invoke/references/a2a-protocol.md` for JSON-RPC framing and remote-only constraints
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/azd-ai-cli.md`
- `plugin/skills/microsoft-foundry/foundry-agent/create/references/local-run.md`

Do not reuse the existing RemoteA2A tool reference as the protocol reference: a toolbox RemoteA2A tool and an agent endpoint using `protocol: a2a` are different integration surfaces.

**Acceptance criteria**

- A2A uses `agent invoke --protocol a2a` and is documented as remote-only.
- Activity protocol testing uses `agent run` and Microsoft 365 Agents Playground, not `agent invoke`.
- The agent endpoint protocol is not confused with the RemoteA2A toolbox tool.

### P1-2 — Add agent lifecycle management

**Current gap**

The skill covers create, deploy, show, invoke, diagnose, and endpoint update, but omits several lifecycle commands already implemented in azd.

**Available azd capability**

| Command | Purpose |
|---|---|
| `azd ai agent delete [name]` | Delete an agent or one version; force can terminate active sessions. |
| `azd ai agent endpoint show [name]` | Show protocols, traffic selectors, authentication schemes, and A2A card data. |
| `azd ai agent code download [service]` | Download source for a code-deployed hosted agent, optionally as a ZIP or for a selected version; the command remains labeled Preview. |

Sources:

- [`agent/root.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/root.go#L48)
- [`agent/delete.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/delete.go#L30)
- [`agent/code.go`](https://github.com/Azure/azure-dev/blob/105d7e9fa41eece4c563b3b56e51526937eb1fdd/cli/azd/extensions/azure.ai.agents/internal/cmd/code.go#L21)

**Recommended skill behavior**

- Use endpoint show before diagnosing protocol or traffic-routing issues.
- Use code download for recovery/inspection of code-deployed versions, not as the normal source-control workflow.
- Treat deletion as destructive: inspect the target and version first, summarize active-session impact, and require explicit user authorization.
- Distinguish deleting one version from deleting the entire agent.

**Recommended placement**

- Extend the deploy workflow with a compact lifecycle section.
- Keep detailed delete/recovery behavior in one adjacent reference if the section becomes too large.

**Acceptance criteria**

- The skill can safely delete a selected version without implying full-agent deletion.
- Protocol troubleshooting inspects the deployed endpoint before rewriting configuration.
- Code download does not silently overwrite user source.

## 7. Explicitly out of scope

Anything outside the `microsoft.foundry` dependency bundle is outside this planning scope, including:

- `azure.ai.models` custom-model registration;
- `azure.ai.finetune`;
- `azure.ai.training`;
- `azure.ai.rle`;
- `microsoft.azd.ai.builder`;
- unrelated core surfaces such as `azd add` and `azd mcp start`.
- standalone `azd ai inspector launch`.

The following bundled conveniences are also intentionally excluded from the next-stage plan because they do not create a substantial user workflow:

- `azd ai project context` and `project unset` documentation;
- expanded connection-authentication CLI documentation;
- quota-aware routing and provision-error notes.
- a synthetic one-file example combining every supported Foundry service host; correct the existing workflow-specific references instead.

The main skill also explicitly excludes general Azure deployment. The following core azd surfaces should not be added merely for command completeness:

- `restore`, `build`, `package`, `publish`;
- generic `pipeline config`;
- generic template source management;
- generic hooks and `infra generate`;
- completion, update, and global config management;
- unrelated service hosts such as App Service, Functions, Container Apps, or AKS;
- hidden internal commands such as telemetry upload and extension host listeners.

If a Foundry workflow needs one of these commands, document only the narrow Foundry-specific use and link to the general Azure deployment skill for the rest.

## 8. Recommended delivery order

### Change set 1 — Correctness-only update

Implement P0-1 through P0-7 without adding new workflow scope. This should be independently reviewable and low risk.

Expected result:

- no invalid commands;
- current flags and defaults;
- one accurate command tree plus concise azd file-operation guidance;
- accurate connection/toolbox declarative lifecycle guidance;
- correct protocol names.

### Change set 2 — Agent protocols and lifecycle

Implement P1-1 and P1-2.

Expected result:

- A2A and activity protocol routing is correct;
- A2A remote invocation and activity protocol local testing are documented end to end;
- lifecycle deletion and recovery are safe.

## 9. Validation plan

### Static consistency checks

After updating the skill, verify at minimum:

```powershell
rg -n "azd ai agent invoke.*--force" plugin/skills/microsoft-foundry
rg -n "agent files.*show|agent sessions.*update" plugin/skills/microsoft-foundry
rg -n "--no-inspector" plugin/skills/microsoft-foundry
rg -n "defaults to container" plugin/skills/microsoft-foundry
rg -n "invocations.*A2A" plugin/skills/microsoft-foundry
```

Expected results:

- no positive `invoke --force` instruction;
- no nonexistent files/sessions subcommands;
- deprecated flags appear only in compatibility notes;
- no unconditional container-default statement;
- no protocol aliasing between invocations and A2A.

### Source-alignment checks

For every documented command group:

1. Compare the command tree with its current Cobra `AddCommand` registrations.
2. Compare documented flags with the corresponding `Flags()` registrations.
3. Compare declarative lifecycle language with service-target `Package`, `Publish`, and `Deploy` implementations.
4. Confirm that the required extension command and capability exist in the audited source baseline.
5. Record the azd commit/version used for the comparison.

### Forward-test scenarios

Use realistic prompts without providing expected commands to the validating agent:

1. Invoke a named local agent in a multi-agent azd project.
2. Invoke a remote A2A agent using a JSON-RPC request file.
3. Start an agent using the activity protocol locally without opening the Playground.
4. Upload, list, inspect, download, and delete a hosted file with the azd file commands.
5. Follow the existing declarative connection/toolbox path without using the legacy top-level `resources:` shape.
6. Delete one agent version without deleting the entire agent.

### Documentation quality checks

- Keep the main `SKILL.md` description concise and general.
- Put detailed commands in the nearest workflow/reference file.
- Avoid copying command trees or lifecycle rules into multiple files.
- Do not add conversation-specific wording to runtime skill instructions.
- Preserve any explicit feature gates and prerequisites found in the source.
