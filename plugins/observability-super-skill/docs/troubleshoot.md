# Troubleshoot installation and telemetry access

Use this guide when installation, instruction loading or a scoped evidence
check is blocked. Start with the reported state rather than repeating setup
or broadening access.

## The install command or Plugins view is unavailable

Check your VS Code build, selected Copilot chat experience and organization
policy for plugin support. The documented commands were observed in one
Copilot SDK environment; they are not universal across hosts.

Do not silently switch chat providers, create MCP configuration or install
unrelated extensions. Record the host/version and unavailable command, then
ask the project maintainers for a supported installation path.

## The plugin is enabled but skills do not load

1. Confirm the selected built folder has a root manifest and complete skill
   directories. The source composition folder requires materialization first.
2. Check that the intended package version is enabled.
3. Disable only older duplicate copies of this plugin. Check workspace source
   skills too; duplicate names can change selection.
4. Start a fresh chat and request the coordinator explicitly.
5. Inspect actual skill-load events and resource locations, if exposed.

No obvious completion notification does not necessarily mean installation failed.
Check the Plugins list before retrying. Keep the installation's source folder.
An answer that merely mentions a skill does not prove it loaded.

On Windows, long checkout/cache paths can affect file inspection or loading.
Use a short extraction/checkout location and inspect the specific failure.
Do not repair caches, change system settings or copy individual missing
resources without reviewing the actual problem and approving the action.

## Telemetry tools are missing

Ask Copilot to identify required operations from visible descriptions first.
Distinguish missing operations from routers whose child schemas are unverified.
Schema discovery is a separate step from querying application data.

Reuse approved integrations. Microsoft documents the
[Azure MCP Server extension for VS Code](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started/tools/visual-studio-code),
`ms-azuretools.vscode-azure-mcp-server`. GitHub Copilot for Azure includes it;
check existing integrations before adding another copy. This setup route is
documented, but fresh-client setup was not established by the plugin tests.

Copilot should offer to help connect Azure MCP rather than only report missing
tools. After setup approval, it may use a real host installation/configuration
operation if available; otherwise it guides you through the documented action.
Confirm tools actually appear before proceeding. A link or successful installer
response alone does not establish tool loading or telemetry access.
If you decline setup or policy blocks it, Copilot can still analyze evidence you
provide, with sensitive details removed. It must not try another installer to
evade the restriction.

Review publisher requirements and organization policy, and separately approve
installation, server trust/startup and supported sign-in. Tool-control labels
vary by chat experience; verify them against the
[VS Code tool documentation](https://code.visualstudio.com/docs/agents/run/tools).
Keep approvals and least privilege enabled rather than selecting blanket
Always Allow. Python installation cannot supply missing Azure operations.

## Metadata works but logs are denied

For AMG evidence views, dashboard access and datasource query access are also
separate. A saved dashboard does not prove its panels ran successfully.

Treat metadata access and source-specific query access separately.
Resource-context and workspace-context logs have different access requirements.
Reader on an application does not automatically grant workspace-wide queries.

Review the confirmed source, query context, workspace access mode and applicable
resource/table permissions through your normal access process. See
[Azure Monitor permissions](https://learn.microsoft.com/azure/azure-monitor/fundamentals/roles-permissions-security)
and [Log Analytics access modes](https://learn.microsoft.com/azure/azure-monitor/logs/manage-access).

Do not install duplicate tools, switch identity, widen to another workspace or
grant Contributor/Owner to work around a denial. A denied query is not evidence
that instrumentation is absent.

## A query cannot resolve a table or column

Record the failed query context and error category. A table-resolution failure
is different from an empty result or an explicit access denial.

Application Insights component-native queries can use `requests`, `dependencies`,
`timestamp` and `cloud_RoleName`. Workspace queries commonly use `AppRequests`,
`AppDependencies`, `TimeGenerated` and `AppRoleName`. Verify the actual operation
and source rather than applying either convention universally.

Propose one concrete schema correction within the approved scope and retry
budget. If the previous approval allowed no retries or corrections, obtain separate approval.
Retain the original failed attempt and the correction as distinct evidence.
Do not keep retrying, switch identity or broaden scope silently.

## The query returns empty, stale or partial data

| State | What to check | Interpretation |
|---|---|---|
| Empty | Source/role linkage, fixed interval, expected activity, ingestion and permissions | No returned activity does not prove missing instrumentation or health. |
| Stale | Latest event against agreed freshness and whether the task is historical | Historical evidence may answer a past question; it cannot establish current health. |
| Partial or truncated | Response metadata, caps, omitted coverage and approved query budget | Report subset-only values; do not classify the subset as complete. |
| Completeness unverified | Whether the response exposes completeness information | Success or rows below the cap are insufficient to certify completeness. |
| Throttled or failed | Actual service category and permitted next action | Preserve the blocker; do not substitute a successful-looking empty result. |

Do not generate application traffic, change collection settings or relax
freshness limits to turn a blocked check into a pass without separate approval.
If earlier summaries disagree, expose and reconcile the conflict before use;
an additional bounded read needs its applicable approval.

## Foundry lookup needs an endpoint or safe response contract

A project ARM ID, application name and agent name have distinct meanings.
Do not derive an endpoint or version from names. An application can call
Foundry models without being a persisted Foundry Agent Service agent.

Inspect actual input/output contracts before reading agent definitions or
connections. A filter or metadata-like operation name does not guarantee
credential, prompt or instruction exclusion. An unverified response contract
is not an access denial.

Use developer-confirmed identifiers with sensitive details removed, or a supported projected metadata
path. Existing application telemetry can be a candidate AI-evidence source, but
field presence, name annotations and shared operation keys do not independently
confirm top-level Foundry identity/version. Keep runtime and evaluation-quality
evidence separate. Do not invoke an agent or create evaluations to demonstrate
access.

## Trace Store is available but the trace is incomplete

Tool availability, source eligibility, query access, and application association
are separate checks. A successful account or field listing doesn't establish
that the source contains your application's trace.

The Azure MCP Monitor route can expose Trace Store operations without a separate
trace server. Inspect the actual operation and schema; don't assume the local
server and Monitor route provide identical analysis features.

For missing parents or handoff links, compare the current retrieval with the
smallest relevant approved lookup. Preserve source/identity uncertainty:
an Application Insights operation ID isn't automatically a verified Trace Store
trace ID. Returned trace rows can contain multiple nested spans, and requested
row limits might not be hard backend-page caps.

An HTTP 500 doesn't establish an authorization denial, missing instrumentation,
or absent traces. Retain the actual failure and approved retry limits. Don't
automatically resume, vary the query, or expand the window.
See [trace routing](overview.md#trace-store-and-distributed-traces).

## Copilot suggests reviewing an SRE Agent

Ask what verified connection, relevant configured coverage, and specific
advantage support the recommendation. A visible tool or running agent alone
isn't enough. If direct evidence is sufficient, no recommendation is needed.

**Review SRE option** opens plan review only. It doesn't authorize new reads,
delegation, thread creation, evidence transfer, or persistence. Before execution,
verify actual permissions and effective action restrictions, then separately
approve the exact bounded action. A read-only prompt isn't a security sandbox.
Unknown or unenforceable controls block service execution.

You can choose **Continue direct**. Copilot should retain the choice and existing
budgets, not create a connection, switch identity, or repeatedly offer the same
option. See the [SRE review boundary](overview.md#existing-connected-sre-agent).

## A result is INCONCLUSIVE

Look at the named gaps: source linkage, access, completeness, activity,
freshness, outcome criteria or representative customer evidence.
Choose the smallest permitted step that could resolve one gap.

Successful requests alone cannot prove business success, handled-failure absence
or correct agent outcomes. Shared operation IDs are correlation evidence, not
causation. Continue a selected investigation only with appropriate scope and
approval; do not force remediation without evidence supporting a change.

## Report a problem safely

Use the project's approved feedback channel. Include package/host
versions, the workflow, actual instruction-load events, operation names, error
categories and expected versus observed behavior. Distinguish proposed from
executed operations. The exact version may matter even if skill names match.

Omit credentials, full resource/correlation IDs, raw payloads, prompts,
conversations and unredacted screenshots. No public issue tracker or official
support commitment is established for this candidate.

## Next step

[Return to the VS Code quickstart](quickstart-vscode.md).
