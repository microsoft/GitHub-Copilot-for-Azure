# Azure Observability Skills

Investigate an existing Azure application or Foundry agent from a symptom,
identify relevant observability capabilities, review a scoped fix, and compare
recovery evidence. Start with a question, not a product or tool name.

## Install or update

When this plugin is available in the Azure skills marketplace, use Copilot CLI:

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install: `/plugin install azure-observability-skills@azure-skills`
3. Update: `/plugin update azure-observability-skills@azure-skills`

Availability depends on marketplace publication and your host/organization
policy. If the plugin is not listed, it has not been made available there yet.
For other supported clients, use their Azure skills marketplace installation
flow. Installing the plugin does not grant Azure permissions.

## Skills

| Skill | Purpose |
|---|---|
| `troubleshoot-observability` | Select the next useful step and investigate a bounded affected path. |
| `connect-observability` | Confirm application-to-telemetry associations and task-specific readiness. |
| `assess-observability-health` | Assess health once, rank findings, and preserve your choice of investigation. |
| `verify-observability-fix` | Compare supplied before/after evidence for an actual confirmed change. |

Existing `azure-diagnostics` and `microsoft-foundry` skills from the Azure skills
plugin provide optional broader platform and AI-specific investigation guidance.
They are not duplicated in this plugin. Copilot checks availability before
using them and explains missing prerequisites; installation is never automatic.
Supplied-evidence analysis remains usable without them.

## Try it

```text
My existing web API has slow requests. Help me investigate the affected path.
```

```text
Review my Foundry agent's model and tool latency using this sanitized evidence.
Do not query Azure, run scripts, or save files.
```

```text
I applied the approved fix. Does this before-and-after evidence show recovery?
```

For live reads, provide the relevant application/environment and use authorized
telemetry tools. Copilot confirms the source, UTC window and bounded next action.
You can instead supply evidence with sensitive details removed. Python and saved
mappings are not required for conversation-based analysis. Optional local
validation/rendering helpers require an already approved Python 3.9+ interpreter;
mapping persistence also requires Git and separate consent.

## Permissions and limits

Read-only investigation is the default guidance, not a security sandbox.
Keep host approvals and least-privilege service access enabled. Sign-in,
connections, persistence, external-agent delegation, traffic, jobs, edits,
alerts and deployment require their own applicable approval.

Never provide secrets, connection strings, raw prompts or unredacted telemetry.
Missing, denied, empty, stale and partial evidence remain distinct.
Insufficient recovery evidence is **INCONCLUSIVE**; deployment success,
dashboards and quiet alerts alone are not proof of recovery or causation.
For problems, report the skill, host, sanitized steps and expected/actual
behavior through the repository's issue tracker without attaching sensitive data.

## License

[MIT](LICENSE).

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.
