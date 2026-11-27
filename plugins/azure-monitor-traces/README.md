# Azure Monitor Trace Store

Limited adaptation of the six-skill source associated with version `0.1.25-local`,
using the merged Azure MCP Monitor contract. This is not full parity with the
standalone server, nor a byte-verified copy of distributed NuGet Markdown.
Requires Node.js 22 or later and an Azure
identity with read access to a Trace Store-enabled Azure Monitor Workspace
in Azure public cloud. Azure China and Azure US Government are unsupported
by this preview.

## Install

After publication through the upstream marketplace sync, install in Copilot
CLI or Claude Code:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install azure-monitor-traces@azure-skills
```

For local development, run `npm run build` at the repository root, then:

```text
copilot --plugin-dir ./output/azure-monitor-traces
```

Cursor users can install the published plugin from the Azure Skills marketplace.
Skill-only installation does not configure MCP; install
`trace-investigation-contract` alongside any workflow skill and configure
Azure MCP separately.

The distinct `azure-monitor-traces` MCP server name avoids collisions with
the general Azure plugin. Installing both starts separate Azure MCP processes.
Authentication uses the configured Azure MCP identity; no bearer tokens
need to be copied into skills.

## Skills

| Skill | Question |
|---|---|
| `trace-investigation-contract` | Shared discovery, scope, query/resume, and evidence rules |
| `trace-triage-app` | Trace-only candidate observations; metric-first ranking and exact percentile bands are unavailable |
| `trace-latency-root-cause` | Example-trace child drill and ordinary CPA for complete supplied IDs; exact cohorts and independent contrasts are unavailable |
| `trace-error-blast-radius` | Error signature and propagation examples; exact impact-helper denominators and buckets are unavailable |
| `trace-what-changed` | Inspect supplied paired evidence; obtaining independent paired comparisons is unavailable |
| `trace-agent-behavior-regression` | Per-inference usage/cache accounting and selection/remainder associations; independent compare continuation is unavailable |

The five workflow names are prefixed with `trace-` rather than the original
`triage-app`, `latency-root-cause`, `error-blast-radius`, `what-changed`, and
`agent-behavior-regression` to distinguish Trace Store workflows from general
Azure diagnostics.

## Azure MCP differences and gates

The MCP configurations use `@azure/mcp@latest` so the plugin can receive new
Azure MCP releases without a plugin configuration update. This is intentionally
not reproducible across package updates. `4.0.0-beta.8` includes
`monitor traces account list`, `field list`, `query run`, `resume`, `cancel`,
`analyze-top-attributes` and `analyze-critical-path`.

The adaptation was checked against
[merged MCP source](https://github.com/microsoft/mcp/blob/375cff40084efe6a352eec44899476e913ad40a6/tools/Azure.Mcp.Tools.Monitor/src/MonitorSetup.cs).
Discover every command and parameter at runtime; `@latest` is not capability proof.

| Source behavior | Azure MCP adaptation |
|---|---|
| Standalone `az_*` tools and full ARM-ID account arguments | Discovered Monitor router and CLI kebab-case parameters; workspace name/group plus optional subscription/tenant |
| Query continuation through the original tool | Append first and subsequent pages using `query resume`, same operation ID and span projection |
| Query row budget up to 10000 | Per-call collection budget 1-1000, up to 180 seconds; whole pages retained |
| Success-rate error indicator | Discovered `error_rate > 0`; no business-failure or signature-equivalence claim |
| Syntax-discovery command and top-level trace summaries | Query-run dialect help; summaries in the final aggregation block |
| Selection/complement attributes and explicit-ID CPA | Mapped to released top attributes and ordinary CPA; keep selection semantics and the 1000-ID CPA limit |
| Metric-first PromQL and label discovery | Unavailable; no substitution with Azure resource metrics |
| Exact latency-cohort and impact helpers | Unavailable; no capped export/local reconstruction |
| Independent statistics, attributes and CPA comparisons | Unavailable; no unpaired or selection/remainder substitute |
| Structured/compact results and query-defined CPA | Removed unsupported switches; inspect actual payloads, explicit IDs only |
| KPI, Explorer and Details URL construction | Unavailable; no fabricated Portal URLs |
| Five generic workflow skill names | `trace-` prefixes; contract name unchanged |
| Large main instructions and root latency reference | Linked workflow resources; latency reference moved under `references/` |

At each missing required step, the workflow names the capability and the result
that cannot be claimed, while retaining supported queries, top attributes, CPA
and example inspection. To flip a gate, verify the merged registration and
published package, add its discovered schema at that step, and add a behavior eval.
Do not infer independent compare availability from top attributes.

The six routing/offline behavior suites do not establish live Azure or
standalone-server parity. Detailed workflow resources deliberately retain
the version-matched instructions rather than replacing them with a shorter
approximation. Source and manifest versions use build-stamped placeholders.

## Package execution

**Warning:** The MCP server uses `npx -y`, which can download and execute the
latest package and its dependencies. Review the package source and your npm
registry configuration before enabling it. A project or user `.npmrc` can
redirect package resolution to another registry; use trusted configuration.
`@latest` is a mutable registry tag, not an integrity or compatibility guarantee.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

The shared hooks report plugin/session, skill, and reference usage through
the native reporter. Their tool-invocation tracking currently recognizes
the standard `azure` server, not this plugin's distinct `azure-monitor-traces`
server; shared tool-usage events are therefore unavailable for this plugin.
Azure MCP has its own telemetry and uses the opt-out environment variable
above. Shared telemetry hooks do not invoke `npx`.
