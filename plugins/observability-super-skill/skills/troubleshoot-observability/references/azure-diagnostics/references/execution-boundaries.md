# Local execution boundaries

This overlay governs every preserved recipe and script in this directory.
Read [the entry contract](../SKILL.md) before use. Upstream troubleshooting tables
include repair commands and verbose collectors; they are not blanket permission.
There is no automatic hook, telemetry policy, MCP setup or dependency installation.

The entry's current-request intent gate precedes all recipes, labels, discovery
and reads. This specialist diagnoses actual operational symptoms or deployment
failures, not routine creation/deployment readiness or general coding fixes.
Conceptual observability questions need no journey or onboarding. On an
unrelated topic switch, stop observability presentation and continue the normal
task with normal approvals; no coordinator invocation is required.

## Operations, inputs and access

| Path | Inputs and output | Dependencies, authorization and failure behavior |
|------|-------------------|-------------------------------------------------|
| Evidence-only (primary fallback) | Confirmed target, UTC window, sanitized counts/events, change timeline; observations, hypotheses and gaps | No tools/auth/CLI/scripts required. Missing/stale/partial data stays INCONCLUSIVE where it prevents a finding. Do not send evidence to any new service. |
| Existing AppLens | Confirmed resource identity mapped to the discovered schema's name/type/scope inputs, symptom and bounded window; detector findings/recommendations | Discover actual operation/schema and supported service first. Do not assume a `resourceId` input. Existing host auth and applicable diagnostic read access; backend/network availability is not assured. Treat detector output as evidence, not certain cause or permission to apply fixes. |
| Existing Resource Health | Confirmed resource ID and supported window; availability/platform events | Discover actual operation/schema and access in that scope. ARM provisioning metadata cannot substitute for unavailable Resource Health. Platform availability is not app recovery. |
| Existing Monitor | Confirmed resource or separately confirmed workspace scope, actual tables/metrics, UTC window, resource filters, aggregation, result cap; sanitized aggregates | Discover the operation for the selected scope; resource and workspace operations have different schemas. Existing authorized telemetry access (separate from resource metadata access), table retention and network reachability. Missing linkage/schema/permission is a gap, not permission to enable diagnostics. |
| Existing metadata / ARG | Confirmed subscription/resource filter and result cap; resource IDs, types, configuration names, explicit linkage candidates | Discover supported reads. CLI/resource-graph extension must already exist for CLI recipes; no auto-install or dynamic extension installation. Co-location is not a confirmed telemetry mapping. |
| Operator-reviewed shell read | Exact command, confirmed identity/target/context, time/row/byte limits; minimal sanitized output | Separate local-execution approval after inspection. Existing Azure CLI/kubectl/OS tooling, service/API read access and appropriate network path. No login, identity change or context mutation. No automatic CLI fallback when tools fail. |

Permission varies by advertised operation and resource: inspect requirements rather
than promising a universal role. Resource Reader does not prove workspace query,
detector, Kubernetes API or data-plane access. Private endpoints/firewalls may
prevent reads despite RBAC. Report unavailable, denied, empty, stale, throttled,
failed and partial results separately; never hide a denied read behind a broad
collector. Do not install an extension, SDK, plugin, logging dependency, CLI,
metrics-server, `aks-skills`, or any other missing component.

## Discovered schema snapshot (discovery only)

Do not declare a diagnostic operation stateful or persistence-blocked from the
AppLens brand (or any service name) alone. Inspect the actual exposed schema
and documented side effects, including creation, transfer and persistence.
An unknown contract stays **unverified**, not presumed stateful or stateless.
Under no-query, inspect already exposed metadata only; discovering a cloud
contract is not automatically authorized. If the contract cannot be established,
state that specific blocker and retain the sufficient Monitor/evidence path.
Apply creation/transfer/persistence approvals only to established applicable
effects; missing persistence approval alone is not evidence that AppLens
requires persistence. Relevant AppLens diagnostics remain eligible once their
operation, scope, effects and applicable permissions are established.

The following operation/input shapes were inspected on 2026-10-30. These are
integration notes, not portable top-level tool names, calls to execute or proof
of live access. Rediscover the host's actual tools and current input schemas
before binding the [entry contract](../SKILL.md) to an operation. None of these
diagnostic/query operations was executed during this integration.

| Discovered operation | Required inputs | Binding and scope restrictions |
|----------------------|-----------------|--------------------------------|
| `applens_resource_diagnose` | `question`, `resource` (resource **name**) | No `resourceId` input. Supply all confirmed disambiguators supported by the schema: `subscription`, `resource-group`, `resource-type`, `tenant`. Retain the full confirmed resource ID as scope evidence, but map its confirmed name/type/scope to the advertised inputs rather than passing the ID as a parameter. Put symptom and agreed UTC window in `question`; do not invent a separate time-window parameter. If the name cannot be disambiguated, report the blocker instead of guessing. |
| `resourcehealth_availability-status_get` | `resourceId` | Use the exact confirmed resource ID and all confirmed applicable scope inputs: `subscription`, `resource-group`, `tenant`. Never substitute an unscoped availability-status list or `az resource show`; metadata does not establish Resource Health availability. |
| `monitor_resource_log_query` | `resource-id`, `table`, `query` | Bind the confirmed resource ID, verified table/schema and bounded, resource-filtered aggregate query. Optional `hours` and `limit` must remain within the agreed window and result budget; they do not replace explicit query filters. A workspace query is a different scope/operation: inspect its own schema and confirm the workspace mapping before use. |

## Script inventory

The additional [nested investigation](../investigation/README.md) retains
`query_prometheus.py`. It is not baseline auto-run:
see [Prometheus boundaries](../investigation/references/managed-prometheus.md).
Python standard library only; existing Azure CLI, authorized identity,
data access and approved network path are separate prerequisites.
Local execution, network access and output persistence require their applicable
separate approvals. No dependency installation or identity changes.

All twelve scripts are byte-preserved upstream references, not an executable
default path. None was executed during integration, including `--help` or
`--dry-run`. Commands below describe risks, not instructions to run.

| Script pair (`.sh` / `.ps1`) | Inputs / dependencies / output | Allowability and blockers |
|--------------------------------|-------------------------------|---------------------------|
| `aks-baseline` | Resource group, cluster, optional subscription/namespace; Azure CLI and kubectl; provisioning/node pools/activity, nodes, pod status, events | Read operations but broad cluster/all-namespace collection, current kubectl context independent of Azure target, identifiers/IPs and event text. Not baseline-approved. Confirm both contexts, narrow scope and sanitize output before considering separately approved local execution. No Resource Health query. |
| `appservice-diagnostics` | App, resource group, optional subscription; Azure CLI; config subset, deployments, **setting names only**, domains | App-settings API still retrieves sensitive configuration before client-side projection; permission/output review required. Never broaden projection to values. Not automatically approved by a diagnostics request. |
| `containerapp-diagnostics` | App, resource group, optional subscription; Azure CLI with containerapp support; revisions, registry/ingress config, recent raw logs | Raw logs/config and secret references may be sensitive; reject unsanitized capture. CLI support must already exist with dynamic installation disabled. Prefer aggregated Monitor evidence. |
| `pod-evidence` | Explicit pod/namespace or all-failing scan, tail count; kubectl; status, events, current/previous raw logs, usage | Logs may contain secrets/prompts/bodies. Broad scan is not a bounded incident read. Phase-only all-failing selection misses Running-but-unready/crash-loop pods; PowerShell scan can conflate a failed list with no unhealthy pods. Individual reads may suppress errors and still finish successfully. Do not interpret exit 0 or “No unhealthy pods” as health. |
| `run-ig` | Gadget and pod/namespace or node, filters, timeout/version; kubectl, registry/image access, optional tcpdump | **Mutating, blocked under read-only permissions:** creates privileged `kubectl debug --profile=sysadmin` pods, pulls images and can collect packets/process/syscall data; debug pods persist. Dry-run with pod input still performs a live node lookup. A named gadget is not consent. Requires a separate operator-approved privileged diagnostic/change plan, including cleanup and sensitive-data handling; do not execute here. |
| `test-messaging-connectivity` | Namespace/FQDN, optional Kafka; DNS, TCP, HTTPS, OS network utilities (shell may use existing Python); connectivity table | **Active traffic, blocked under read-only permissions:** DNS/HTTPS/TCP probes to ports 443, 5671/5672 and optionally 9093. Bare names assume public Azure suffix; not sovereign/private topology discovery. Probe errors can appear as BLOCKED, exit 0 is not service health and reachability does not prove message processing. Requires separate explicit probe authorization; do not execute here. |

Shell scripts require Bash plus POSIX utilities; PowerShell scripts require a
compatible PowerShell host. This package does not install either or assert host
portability. Existing CLI reads can trigger auto-extension behavior in some
environments: if no-install behavior cannot be assured, do not run them. Preserved
scripts are not hardened against arbitrary input; do not interpolate untrusted
resource names, gadgets, filters, commands or telemetry into a shell.

## Overrides for retained recipe examples

- **Metadata versus health:** `az resource show`, AKS provisioning and VM pre-flight
  state are context only. Query Resource Health through an actually discovered
  supported read or report its absence. Never assert health/recovery from metadata.
- **Tool examples:** upstream `mcp_azure_mcp_*` labels and command snippets are
  illustrative, not installed tools or verified schemas. Discover actual host
  operations/inputs before use. This package configures no MCP server.
- **Collectors:** “run first”, “collect everything”, log tail/download, packet
  capture, `kubectl describe`, app-settings reads and `--show-output` examples
  do not authorize broad/raw collection. Prefer filtered aggregates. Never dump
  secrets, connection strings, keys, message bodies, raw prompts or raw logs.
- **Context/install:** never run `az aks get-credentials`, sign in, switch identity,
  install kubectl/extensions/dependencies, or offer an add-on installation as a
  prerequisite. An already advertised specialist may be considered only within
  the same scope and permissions; do not claim deterministic handoff.
- **Writes:** “Fix”, “Safe”, pre-flight success or named-resource requests do not
  authorize credential resets, VM Run Command/extensions, Serial Console commands,
  boot-diagnostics enablement, repair VMs, firewall/NSG/RBAC edits, tracing enablement,
  auto-heal, scale/restart/deploy/upgrade, purge/replay/checkpoint/settle, or SDK
  examples that receive/process messages and write storage. Present only
  unexecuted operator-reviewed options outside investigation permissions.
- **Network and verbosity:** curl/DNS/TCP tests, `az aks check-acr`, Network Watcher
  active tests, debug/exec pods, SDK frame logs and reproduction traffic require
  separate specific approval; no new traffic for baseline diagnostics. Logging
  configuration changes also require change approval. Do not upload logs to public
  issues or save sensitive evidence based on a recipe's suggestion.

Host approvals, restricted tools and least privilege remain necessary controls;
instruction text is not an enforcement mechanism.
