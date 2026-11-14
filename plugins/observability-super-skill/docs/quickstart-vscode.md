# Quickstart: Investigate an Azure application in VS Code

In this quickstart, you install Azure Observability Skill Plugin, describe a symptom
in an existing application, and review the first bounded telemetry check.
You'll either obtain source-labeled evidence or identify a specific prerequisite
to resolve.

> [!IMPORTANT]
> Version **0.3.38** is an experimental candidate. Plugin commands depend on your
> VS Code build, Copilot chat experience, and organization policy. Installation
> doesn't establish telemetry access or application health.
> See [current support](overview.md#current-support).

## Prerequisites

- VS Code with a Copilot chat experience that supports plugins, skill loading,
  and tool calls.
- A materialized plugin folder or an extracted copy of an approved built distribution.
- An existing deployed web application, API, or Foundry agent.
- For live reads, existing approved telemetry tools and appropriate access.
  You can instead provide evidence with sensitive details removed.
- Permission under your organization's policy to install and use the plugin.

No Python, Azure Developer CLI (`azd`), saved mapping, or write access
is required for evidence review. Preparing this source composition for installation
requires the receiving repository's build; end users need only its built payload.
Foundry isn't required for web/API scenarios.
Git is needed only if you choose to obtain the package by cloning a repository.

## 1. Install and enable the plugin

If you received a built archive, extract it first. This source repository keeps
skills at the top level and a composing manifest under
`plugins/observability-super-skill`. The receiving repository materializes an
installable plugin from those references. Do not select the unbuilt composition
folder or the repository root. The selected built folder must contain:

```text
plugin.json
README.md
skills/
```

1. Open the VS Code Command Palette.
2. Run **Chat: Install Plugin from Source** and select that folder.
3. Open **Chat: Open Customizations**, select **Plugins**, and confirm the plugin
   is enabled.
4. If necessary, disable older duplicate copies of this plugin. Leave unrelated
   plugins unchanged.

If these commands aren't available, follow
[installation troubleshooting](troubleshoot.md#the-install-command-or-plugins-view-is-unavailable).
Don't add unrelated extensions or change providers to work around an unsupported
host.

Keep the selected folder available while the host may depend on it.
Installation doesn't approve tool calls, sign-in, or external service access.

### Update an existing installation

Use the host's supported refresh or reinstall flow, then start a fresh chat.
Where the host exposes the installed location, inspect its `plugin.json` and
confirm version **0.3.38**. A source-folder version doesn't prove which copy
loaded. Don't edit installed caches.

If loading is in doubt, verify actual skill-load events and locations rather
than relying on the response text. The package has six entries; six physical
directories alone don't prove six registered skills.

## 2. Describe the symptom

Open a fresh chat in your application's workspace, outside the plugin source
repository. If the application repository isn't available, provide nonsecret
application and environment context instead.

Start with an ordinary question:

```text
My existing web API in <environment> has slow requests.
Help me investigate it end to end.
```

For an agent, use:

```text
My existing Foundry agent <agent-name> in <project/environment>
has <observed symptom>. Help me investigate it end to end.
```

You don't need an alert, skill name, KQL query, or MCP server name.
Copilot should ask for missing context, propose the next bounded action, or
explain a concrete blocker. Confirm the application if multiple deployments
could match.

For an evidence-only review, provide the relevant evidence with sensitive
details removed and say:

```text
Use only the evidence I provide. Do not query Azure, run scripts,
install anything, edit files, or save data.
```

**Expected result:** Copilot follows the current question and minimum scope
needed. A known symptom can go directly to investigation. General coding or
resource creation shouldn't trigger telemetry discovery.

## 3. Confirm scope and review the proposed reads

For live investigation, confirm only the missing facts, such as the application,
environment, subscription/resource scope, telemetry source, and observation
window. Names and resource-group co-location alone don't prove source linkage.
Never paste credentials, connection strings, full application settings, or
sensitive prompt content.

Before approving a read, review:

- The question, target, source, and explicit UTC start/end times.
- Source association and any missing schema or access checks.
- Returned fields, row/query limits, and allowed retries or corrections.
- Sensitive-content exclusions and expected data handling.

Metadata and schema reads consume the approved budget too. If additional
permission is needed, approve only the next scoped action. Keep host approvals
enabled; don't choose blanket automatic approval.

**Expected result:** confirmed source association and bounded read access,
or a specific ambiguity, authorization, schema, or tooling blocker.
If tools are missing, use the
[missing-tool guidance](troubleshoot.md#telemetry-tools-are-missing).
Setup and supported sign-in require their own approval.

## 4. Review the evidence

Copilot should report source-labeled observations with the interval, counts,
units, completeness information, and explicit gaps. Inspect actual tool events
when available.

Check that empty data isn't called healthy or missing instrumentation, null
values aren't replaced with zero, and partial results aren't presented as a
complete population. A successful read doesn't establish application health.
Insufficient required evidence must remain **INCONCLUSIVE**.

If a material trace parent or handoff gap remains, Copilot should compare the
current retrieval with relevant exposed Trace Store operations. It shouldn't
require you to request MCP by name or install a separate server when the Monitor
route already fits. New-source reads still need applicable approval.

An existing connected SRE Agent may receive a review-only recommendation if its
verified coverage offers a specific advantage. **Review SRE option** doesn't
authorize reads, delegation, thread creation, transfer, or persistence.
See [optional capabilities](overview.md#use-the-smallest-sufficient-capability).

## 5. Choose the next step

For a broad health assessment, select a finding to investigate. Copilot should
retain the completed assessment rather than repeat it.

After an actionable investigation, Copilot can offer review of a supported fix
and rollback plan. Accepting the review doesn't approve edits or deployment.
If a concrete edit is needed, review the target and proposed diff before giving
separate approval.

After an actual approved change takes effect, provide comparable original and
post-change evidence for recovery comparison. Deployment success alone isn't
recovery proof. Missing or noncomparable evidence yields **INCONCLUSIVE**.

Stop or decline a proposed next action when appropriate. Copilot should retain
your decision and remaining limits across handoffs.

## Troubleshoot instruction loading

If the plugin is enabled but the expected instructions don't load, use this
diagnostic prompt in a separate fresh chat:

```text
Use troubleshoot-observability, then connect-observability,
for prerequisites only. Identify visible tools and the scope or evidence
you need. Do not query Azure, discover remote schemas, sign in,
install anything, run scripts, edit files, or save data.
```

Check actual load events and installed-resource paths where available.
A response naming a skill doesn't prove it loaded. This explicit diagnostic
doesn't establish that natural-language selection passed.
See [loading troubleshooting](troubleshoot.md#the-plugin-is-enabled-but-skills-do-not-load).

## Next steps

- [Understand capabilities, permissions, and results](overview.md).
- [Resolve installation and telemetry access problems](troubleshoot.md).
- [Review the included skill identifiers](../README.md#included-capabilities).
- [Run host acceptance cases](../skills/troubleshoot-observability/references/host-tests.md)
  separately in VS Code and Copilot CLI.
