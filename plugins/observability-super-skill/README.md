# Azure Observability Skill Plugin

Use this six-skill GitHub Copilot plugin to investigate an existing Azure
application. Start with a failed request, slow operation, or agent issue.
Copilot helps confirm the telemetry source, investigate the affected path,
review an approved fix, and compare recovery evidence. Copilot also identifies
additional capabilities that can help with an unresolved question, such as
Trace Store operations exposed through Azure Monitor MCP or an existing
connected Azure SRE Agent. It explains the advantage, checks availability and
access, and requests applicable approval before use. SRE recommendations open
review first, not automatic service execution.

**Detect -> Investigate -> Remediate -> Validate**

Start with your troubleshooting question. Copilot proposes the next useful
step using the available evidence and tools. You confirm the target and approve
applicable actions.

## Prerequisites

- A Copilot chat experience that supports plugin installation and skill loading.
- An existing deployed web application, API, or Microsoft Foundry agent.
- Existing approved telemetry tools and source access for live investigation,
  or evidence you provide with sensitive details removed.

Initial web/API analysis doesn't require Foundry, Python, Azure Developer CLI
(`azd`), a saved mapping, or write permissions. The plugin contains instructions
and optional helpers, not a telemetry backend or an MCP server.

## Install and start

### Installation after marketplace publication

The following steps apply once this plugin is published in Awesome Copilot.
It isn't listed yet.

**VS Code:** Open Extensions and search for `@agentPlugins`, or run
**Chat: Plugins** from the Command Palette. Find **Azure Observability Skill
Plugin** and install it.

**Copilot CLI:**

```bash
copilot plugin install observability-super-skill@awesome-copilot
```

After installation, open your application's workspace and start a fresh chat.

Describe your question:

```text
My existing web API in <environment> has intermittent failures.
Help me investigate it end to end.
```

For Foundry, identify the existing project/agent and symptom instead. For
evidence-only analysis, provide the relevant evidence and say not to query Azure.
You don't need to name skills or tools for the ordinary starting path.

Copilot should ask for missing context, explain the next scoped operation, and
request applicable approval before accessing telemetry. Installation doesn't
grant that approval.

See the [VS Code quickstart](docs/quickstart-vscode.md) for a local source tryout,
including how to verify the loaded version. Host commands vary; use
[installation and access troubleshooting](docs/troubleshoot.md) if blocked.
Installation commands depend on your host and organization policy.

## Scenarios to try

<details>
<summary>Explore example prompts for common troubleshooting questions</summary>

Start with a simple question in your application's workspace. You don't need
to name a skill, choose a tool, or write a query. Copilot uses the conversation
context and asks for missing details, such as the affected resource or time
window, then proposes the next scoped action for applicable approval.

### Investigate an alert

```text
Investigate this alert that just fired on my app.
```

### Rank agent health issues by impact

```text
Review the health of my agent and its dependencies, and prioritize the top issues by customer impact.
```

### Investigate AKS memory failures and review a fix

```text
Why is my AKS workload getting OOMKilled? Help me fix it.
```

### Analyze tool performance and usage

```text
Show me how this tool is being used and what's making its calls slow.
```

### Analyze supplied evidence only

```text
Explain these failed requests using only the evidence I've shared. Don't query Azure.
```

### Compare recovery evidence

```text
I've applied the approved fix. Does the before-and-after evidence show recovery?
```

For "this alert," "my agent," or "this tool," share the relevant context if it
isn't already in the conversation. Live reads need available authorized
telemetry tools; supplied-evidence review can proceed without cloud access.
Copilot agrees a bounded source/time window rather than fetching every trace,
reports coverage gaps, and asks before changes. Recovery comparison needs an
actual effective change and comparable evidence.

</details>

## Included capabilities

| Skill | Role |
|---|---|
| `troubleshoot-observability` | Azure Observability Skill Plugin coordinator |
| `connect-observability` | Connect your application |
| `assess-observability-health` | Detect health issues |
| `azure-diagnostics` | Investigate the affected path |
| `microsoft-foundry` | Investigate optional AI-specific evidence |
| `verify-observability-fix` | Validate recovery after an actual approved change |

Use a specialist directly when you already know the task. A named symptom can
go directly to investigation; a broad health assessment isn't mandatory.
Conceptual questions receive direct answers. General coding or resource
creation doesn't start a troubleshooting journey solely because it uses Azure.

For missing parent spans or handoff links, Copilot compares the current evidence
with relevant exposed Trace Store operations. A separate trace server isn't
required when Azure MCP Monitor exposes a suitable operation. Sufficient
authorized KQL remains valid, and new-source reads need applicable approval.

If an existing connected SRE Agent has verified relevant coverage and a specific
advantage for an unresolved question, Copilot may offer **Review SRE option /
Continue direct**. Accepting review doesn't approve new reads, service execution,
thread creation, evidence transfer, or persistence. Unknown or unenforceable
action restrictions block execution.

See the [overview](docs/overview.md) for capability prerequisites and scope.

## Permissions and evidence

Read-only investigation is the default. Copilot chooses and loads instructions;
existing tools execute approved operations; you confirm scope and approve
applicable actions. The host controls tool invocation and approvals.

> [!WARNING]
> Instructions don't enforce permissions. Keep host approvals and least
> privilege enabled. A read-only prompt is not a security sandbox for an
> external service.

Approve setup, sign-in, scripts, sensitive content, persistence, jobs, traffic,
local edits, and deployment separately when applicable. Reviewing a fix plan
doesn't authorize an edit. A local edit doesn't establish deployment or recovery.

Don't include credentials, connection strings, sensitive prompts, or unredacted
telemetry in chat or feedback. Insufficient required evidence yields
**INCONCLUSIVE**. Empty telemetry isn't proof of health or missing instrumentation;
correlation isn't causation.

## Scope and known limitations

- The default investigation uses supplied evidence or existing authorized public
  telemetry operations. No restricted service is required.
- Retained specialist lifecycle workflows and helpers require their own
  prerequisites and approvals. They don't run as part of installation.
- Trace retrieval and SRE review depend on actual connected capabilities,
  source association, access, and effective action controls. Additional spans
  don't by themselves establish a complete critical path.
- A recovery result compares supplied evidence against agreed criteria.
  It isn't continuous monitoring or a production recovery certification.

## Attribution and reuse

Four project-built skills, including integrated contributed health assessment,
compose with two adapted Microsoft specialists. The complete affected-path
investigation workflow is nested under `azure-diagnostics`, not a seventh skill.

See [diagnostics provenance](skills/troubleshoot-observability/references/azure-diagnostics/references/provenance.md),
[Foundry provenance](skills/troubleshoot-observability/references/microsoft-foundry/references/provenance.md),
[health provenance](skills/assess-observability-health/references/provenance.md),
and [nested investigation provenance](skills/troubleshoot-observability/references/azure-diagnostics/investigation/references/provenance.md).
The Microsoft specialists retain their license notices. Recorded contribution
permission isn't a repository-wide MIT license.

<details>
<summary>Contributor information and verification status</summary>

Source version: **0.3.38**. This composition isn't yet a published marketplace
entry. The Awesome Copilot build materializes the installable package from
top-level skill references; the unbuilt composition folder isn't an installable
payload. Offline checks establish package and helper behavior, not Copilot routing
or live service execution. Fresh VS Code and Copilot CLI checks remain separate.
See [verification status](docs/overview.md#current-support) and
[source and release checks](docs/source-readme.md#validate-the-package-locally).

</details>

## Next steps

- [Install the built plugin and investigate a symptom](docs/quickstart-vscode.md).
- [Understand capabilities, permissions, and results](docs/overview.md).
- [Troubleshoot installation and telemetry access](docs/troubleshoot.md).

## Receiving-repository draft status

> Added for the local GitHub-Copilot-for-Azure draft; the content above is the
> source README imported verbatim from revision
> `18f482ad23660251933e91fd7d61e61d76b876ef` (links remapped only).

This local draft is being prepared for
[issue #3510](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues/3510).
It registers four skills: `troubleshoot-observability`, `connect-observability`,
`assess-observability-health` and `verify-observability-fix`. The source's
adapted `azure-diagnostics` and `microsoft-foundry` specialist trees are carried
as references under `skills/troubleshoot-observability/references/` and are not
registered as separate skills in this plugin. References above to a six-skill
package describe the source composition and have not yet been refactored.

Contributor: Nuzhat Minhaz.

**Not ready for publication:** licensing and public attribution require review
(see [NOTICE](NOTICE.md)). CODEOWNERS entries and the token-limit/guideline
refactor also remain open.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.
