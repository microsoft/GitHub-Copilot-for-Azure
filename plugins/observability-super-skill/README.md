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
- Choose evidence-backed correction, mitigation, or recurrence-detection options,
  including a reviewed code/config PR proposal or alert guidance.
- Compare original and post-change evidence against agreed recovery criteria.
- After the recovery result, choose an AMG dashboard, alert guidance, a later
  health check, or finish. Monitoring setup is optional and separately approved.
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

### Local development installation

This is a local draft imported from source candidate **0.3.39**, not a published
marketplace entry. From this repository's root, build the plugin and load its
versioned output.

**PowerShell:**

```powershell
npm run build
copilot --plugin-dir .\output\observability-super-skill
```

**Bash:**

```bash
npm run build
copilot --plugin-dir ./output/observability-super-skill
```

For VS Code, use the host's supported plugin installation flow (for example,
**Chat: Install Plugin from Source**) and select the built
`output/observability-super-skill` folder. Commands such as **Chat: Plugins**
and `@agentPlugins` depend on the host and organization policy.
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

See the [VS Code quickstart](docs/quickstart-vscode.md) for a local source tryout,
approval, and evidence-review steps. If your host doesn't expose the documented
commands, use [installation troubleshooting](docs/troubleshoot.md).
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
pass through all stages. See [capabilities and permissions](docs/overview.md)
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
[safe feedback guidance](docs/troubleshoot.md#report-a-problem-safely).

## Validate the package locally

<details>
<summary>Contributor information: source layout, validation, and release checks</summary>

Imported source candidate: **0.3.39**. NBGV computes this repository's package
versions; source manifests and skill entries use `0.0.0-placeholder`.

The source follows this repository's per-plugin layout:

```text
plugins/observability-super-skill/skills/<skill-name>/SKILL.md
plugins/observability-super-skill/plugin.json
plugins/observability-super-skill/README.md
evals/observability-super-skill/<skill-name>/eval.yaml
tests/skills/observability-super-skill/test_*.py
```

The portable manifest and Copilot, Claude, and Cursor manifests describe the
same plugin. The build copies the complete skill directories, stamps versions,
and assembles the shared telemetry hooks with the plugin-local path patterns.
The scaffold includes routing smoke evaluations; scenario evaluations and
replacement of the CODEOWNERS placeholders remain onboarding work.

From the repository root, use Python 3.12+ and Git. Create an isolated development
environment, install the pinned test dependency, and run the offline suite plus
named-tokenizer checks:

```powershell
python -m venv tmp\observability-super-skill\venv
tmp\observability-super-skill\venv\Scripts\python.exe -m pip install -r tests\skills\observability-super-skill\requirements-dev.txt
tmp\observability-super-skill\venv\Scripts\python.exe -B plugins\observability-super-skill\scripts\validate.py
```

```bash
python -m venv tmp/observability-super-skill/venv
tmp/observability-super-skill/venv/bin/python -m pip install -r tests/skills/observability-super-skill/requirements-dev.txt
tmp/observability-super-skill/venv/bin/python -B plugins/observability-super-skill/scripts/validate.py
```

The helper tests use local Git operations and mocked service responses. The
context-budget checks additionally require the pinned development-only tokenizer
dependency documented with the offline tests. Tokenizer vocabulary files may
download on first use; source text is tokenized locally. Customers do not need
this dependency. Don't run retained cloud scripts as offline validation.

Tests check the six entry instructions, local links, packaging,
public-content gates, and helper success/failure paths. Test results
don't prove model selection, live access, host rendering, or production recovery.
Detailed host-acceptance specifications and natural-language journey cases live
under `tests/skills/observability-super-skill/` in this repository, outside the
runtime payload. These are specifications, not measured VS Code or CLI outcomes.
The repository's Vitest runner does not automatically execute Python tests;
agree an automated validation path before submission.

### Review before submitting a public PR

- Run this repository's `npm run build`, frontmatter and reference validators,
  token checks, and relevant tests, then review generated changes.
  Local structure checks do not replace receiving CI.
- Resolve how the target repository reuses its existing diagnostics and Foundry
  specialists, rather than automatically adding duplicate copies.
- Review attribution with the receiving project. The plugin uses MIT with the
  contributor's confirmed authorization; the adapted Microsoft specialists
  retain their original copyright and MIT notices.
- Record installed-host results separately from offline package checks.
  Natural Trace Store selection and proactive SRE recommendations remain
  unverified in a fresh installed candidate.

See [NOTICE](NOTICE.md) for source pins, contribution permissions, and the
adaptation summary. Candidate inventories retained with the imported offline
tests are historical source evidence, not a byte-parity claim for this adapted
plugin or proof of catalog acceptance.

</details>

## License

This plugin is licensed under the [MIT License](LICENSE). See [NOTICE](NOTICE.md)
for upstream copyright notices, source pins, and contribution authorization.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.
