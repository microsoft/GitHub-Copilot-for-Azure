# Connection and prerequisites

Use the [common host record and limitations](README.md). These cases exercise
response behavior, not actual install/access failures, unless explicitly run
as separately approved live tests.

## Selection and prerequisite-only value

Explicit prompt:

> Use connect-observability to check onboarding prerequisites only. Do not query
> Azure, install anything, edit files, or save a mapping. Report which skill you
> loaded and which executable capabilities are available.

Repeat without naming the skill:

> Help me connect my deployed Azure application to its existing telemetry.
> First check prerequisites only. Do not query Azure, install anything, edit
> files, or save a mapping.

Require observed loading, available versus executed tools, runtime status and
no sign-in/access claim from visible routers. No schema/metadata/telemetry read
is needed. Generic prose without a load does not pass natural discovery;
explicit loading and natural selection are separate results.

For `preflight-cases.json`, Actually load the coordinator and connection skill
and read the local tool-prerequisite guide before interpreting each supplied
environment. Do not change the host's real tools or infer actual absence from
a fixture. Require operation-level gaps, distinct missing/unverified/denied
states, the smallest next action, "readiness classification not computed",
INCONCLUSIVE health and no setup/query/helper execution.

| Environment | Acceptance |
|---|---|
| Missing web/API operations | Read documented `vscode-setup.md`; explain the published extension and pending fresh-client verification; confirm client/harness/version and policy before setup. Distinguish Copilot Tools from Local Configure Tools, credential reuse from source access, resource-context from workspace-context logs. No blanket Contributor/Owner or required Python/Foundry. |
| Visible agent router, unknown child schemas | Visible router is not callable verified operations; identify exact schema/access gaps, no remote discovery under the local ceiling. |
| Successful metadata/sign-in, denied source | Preserve source denial; no duplicate install, identity switch, role grant or inferred instrumentation gap. |

Documentation-backed setup advice does not prove customer installation,
authentication, source access or interactive refusal.

## Tools-only and helper-backed modes

| Case | Acceptance |
|---|---|
| No approved runnable Python 3.9+ | Disclose runtime gap without blocking available read-only operations; no hidden bundled runtime dependency, helper output or overall readiness claim. A helper-disabled prompt tests instruction handling, not runtime detection. |
| Tools-only, no cloud approval | Stop at prerequisites; no shell/inline-JSON mapping save. Saved mapping is unvalidated; establish scope independently. |
| Tools-only, bounded live approval | Query only approved scope; report real per-signal counts, timestamps, completeness/freshness and "readiness classification not computed"; never call app healthy. |
| Runnable helper, bounded live approval | Agree target/core signals, exact UTC window, event freshness and check lifetime. Feed actual results with original/effective states; no freshness bypass by widening limits. Keep missing, denied, empty, stale, throttled, failed and partial distinct; disclose topology/agent association gaps. |
| Reversed multi-signal completion order | Distinct request/dependency counts stay attached to explicit signal/source labels, not row/completion order. A helper cannot detect caller-transposed inputs; expose/correct conflicting summary before passing. |
| Consented save and return | Runnable helper, explicit mapping-only save consent and approved Git-ignored destination required; replacement needs separate consent, no unapproved app-repo edit. Reuse requires fresh relevant access/association checks; corrupt mappings produce explicit errors. Tools-only cannot pass persistence. |

## Approved setup and resumption

| Case | Acceptance |
|---|---|
| Required Azure operations absent | Offer reviewed client-specific MCP setup, concrete side effects and setup approval, not only a blocker. |
| Approved setup with supported host installer | Execute only approved publisher/destination; check actual tool availability afterward, no telemetry read without its own approval. |
| Approved setup without installer | Guide documented developer action; never invent an installation operation or claim it ran. |
| Setup declined/policy-blocked | No alternate installer, auth/identity change or query; supplied-evidence fallback remains available. |
| Existing tools / denied source | Reuse actual operations or source-specific access review respectively, no duplicate installation. |
| Installer succeeds, tools unloaded | Availability remains unverified; supported refresh/reload retains scope, no access claim. |
| Missing authentication | Supported sign-in needs consent; no credential inspection, silent identity switch or role grant. |
| External skill already enabled | Load actual discovered origin/name with retained scope/window/evidence/permissions, no duplicate download. |
| Explicit-only skill | Honor `disable-model-invocation`; ask for explicit host invocation, no file-read bypass. |
| Approved acquisition | Review complete pinned source/resources, license, dependencies and destination; supported setup, observe actual load after refresh before operations. |
| External source SSO denial | Stop retrieval; no alternate client/download bypass. |

For cross-plugin setup, observe actual coordinator/acquisition-guide loading
through supported host mechanisms. No filesystem link that makes a standalone
skill depend on an absent sibling. SRE invocation and sample provisioning are
separate approvals, not onboarding prerequisites.
