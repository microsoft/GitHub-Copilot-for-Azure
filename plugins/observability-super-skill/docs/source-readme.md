# Azure Observability Skill Plugin

Use Azure Observability Skill Plugin to investigate an existing Azure application
from a symptom, review an evidence-backed fix, and compare recovery evidence.
The plugin brings together six GitHub Copilot skills for web applications,
APIs, and Microsoft Foundry agents. Copilot also identifies additional
capabilities that can help with an unresolved question, such as Trace Store
operations exposed through Azure Monitor MCP or an existing connected Azure
SRE Agent. It explains the advantage, checks availability and access, and
requests applicable approval before use. SRE recommendations open review first,
not automatic service execution.

**Detect -> Investigate -> Remediate -> Validate**

Start with your troubleshooting question. Copilot helps identify the relevant
evidence and proposes a scoped next step. You review applicable actions before
tools execute them.

## What you can do

- Find the telemetry associated with an existing application.
- Assess health or investigate a specific failed request, slow operation, or
  agent/tool failure without running a broad health assessment first.
- Review a proposed fix before approving any edits or deployment.
- Compare original and post-change evidence against agreed recovery criteria.
- Analyze evidence you provide without querying Azure.
- Discover relevant additional capabilities when they offer an advantage over
  the current investigation path, without requiring you to name the integration.

Azure Monitor provides the operational foundation. Microsoft Foundry adds
AI-specific investigation when needed; it isn't required for web/API scenarios.
Copilot selects the instructions, existing tools execute approved operations,
and you confirm scope and approve applicable actions.

## Prerequisites

- A VS Code Copilot chat experience that supports plugins and skill loading.
  Command availability depends on your host and organization policy.
- An existing deployed application and a troubleshooting question.
- For live investigation, approved telemetry tools and access to the relevant
  sources. Alternatively, provide evidence with sensitive details removed.

Initial evidence review doesn't require Python, Azure Developer CLI (`azd`),
saved mappings, write access, or a new observability service.

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

Describe the symptom in your own words:

```text
My existing web API in <environment> has slow requests.
Help me investigate it end to end.
```

For an agent, describe the existing project, agent, and observed failure instead.
You don't need to name a skill, write a query, or request a particular MCP server.
Copilot should identify missing context and propose the next bounded action.

For a no-cloud review, start with:

```text
Review the evidence below to help explain these failed requests.
Do not query Azure, run scripts, edit files, or save data.
```

See the [VS Code quickstart](quickstart-vscode.md) for a local source tryout,
approval, and evidence-review steps. If your host doesn't expose the documented
commands, use [installation troubleshooting](troubleshoot.md).
Installation commands vary by host and organization policy.

## Scenarios to try

<details>
<summary>Explore example prompts for alerts, agent health, AKS memory failures, and tool performance</summary>

Start with a simple question in your application's workspace. You don't need
to name a skill, choose a tool, or write a query. Copilot uses the conversation
context and asks for missing details, such as the affected resource or time
window, then proposes the next scoped action for applicable approval.

### Investigate an application alert

```text
Investigate this alert that just fired on my app.
```

### Review an agent and its dependencies

```text
Review the health of my agent and its dependencies, and prioritize the top issues by customer impact.
```

### Investigate AKS out-of-memory failures

```text
Why is my AKS workload getting OOMKilled? Help me fix it.
```

### Understand a tool's performance and usage

```text
Show me how this tool is being used and what's making its calls slow.
```

### Review evidence without cloud access

```text
Explain these failed requests using only the evidence I've shared. Don't query Azure.
```

### Validate recovery after a change

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

## Included skills

| Skill | Purpose |
|---|---|
| `troubleshoot-observability` | Coordinate the next useful step in the troubleshooting journey. |
| `connect-observability` | Confirm the application, telemetry sources, and task-specific access. |
| `assess-observability-health` | Assess health and rank evidence-backed findings. |
| `azure-diagnostics` | Investigate the affected application, dependency, or resource path. |
| `microsoft-foundry` | Investigate agent, model, and tool behavior when AI-specific evidence is needed. |
| `verify-observability-fix` | Compare supplied recovery evidence after an actual approved change. |

You can use a specialist directly. The plugin doesn't require every request to
pass through all stages. See [capabilities and permissions](overview.md)
for conditional trace retrieval, SRE Agent review, and other optional workflows.

## Permissions and data handling

Read-only investigation is the default instruction path. Installation doesn't
authorize Azure queries, sign-in, scripts, new connections, local saves, traffic,
evaluation jobs, code changes, or deployment. Review each proposed action and
keep host approvals and least-privilege access enabled.

> [!WARNING]
> Skill instructions are not a security sandbox. The host controls tool
> invocation and approvals, and the connected service enforces permissions.
> A read-only prompt doesn't restrict an external service's effective identity.

Don't provide credentials, connection strings, sensitive prompts, or unredacted
telemetry. Missing, denied, empty, stale, and partial evidence are different
states. Insufficient evidence must remain **INCONCLUSIVE**, not healthy or
recovered. Recovery comparison doesn't establish causation.

To report a problem, follow the
[safe feedback guidance](troubleshoot.md#report-a-problem-safely).

## Validate the package locally

<details>
<summary>Contributor information: source layout, validation, and release checks</summary>

Source version: **0.3.38**.

The source follows the
[Awesome Copilot composition layout](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-plugins):

```text
skills/<skill-name>/SKILL.md
plugins/observability-super-skill/plugin.json
plugins/observability-super-skill/README.md
```

The manifest references all six skills through
`extensions.com.github.awesome-copilot`. The receiving build copies the complete
skill directories into the served plugin and removes the source-only namespace.
This package doesn't add the separate Azure repository's onboarding hooks or
evaluation infrastructure.

From the repository root, use an existing Python 3.12+ interpreter and Git:

```powershell
python -B -m unittest discover -s tests -v
```

The suite uses the standard library, local Git operations, and mocked service
responses. It requires no dependency installation or cloud access. Don't run
retained cloud scripts as an offline validation step.

Tests check the six entry instructions, local links, exact candidate hashes,
composition references, public-content gates, and helper success/failure paths. Test results
don't prove model selection, live access, host rendering, or production recovery.
See the [host acceptance cases](../skills/troubleshoot-observability/references/host-tests.md)
for the separate VS Code and CLI checks.

### Review before submitting a public PR

- Run the receiving repository's `skill:validate`, `plugin:validate`, and build
  commands in a reviewed contribution checkout, then review generated changes.
  Local structure checks do not replace those validators or receiving CI.
- Resolve how the target repository reuses its existing diagnostics and Foundry
  specialists, rather than automatically adding duplicate copies.
- Review license terms and attribution with the receiving project. The adapted
  Microsoft specialists include MIT notices; the contributed health and nested
  investigation resources have recorded permission to ship, not an invented
  MIT grant. No repository-wide license is declared.
- Record installed-host results separately from offline package checks.
  Natural Trace Store selection and proactive SRE recommendations remain
  unverified in a fresh installed candidate.

See [NOTICE](source-notice.md) for source pins, contribution permissions, and the
adaptation summary. The candidate inventory (`tests/candidate-inventory.json`, not imported)
records current source-file hashes; it doesn't claim byte parity with upstream
or that the plugin has been accepted into a catalog.

</details>
