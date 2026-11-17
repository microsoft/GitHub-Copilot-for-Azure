# 1. Establish intent and available operations

Follow [the tool-prerequisite guide](tools.md) when required
operations are missing, visible only as unresolved routers or denied at a source.
It gives the smallest next setup/access step while keeping installation and
bounded-read approvals separate. Sourced VS Code and Copilot CLI routes are
available; fresh-client installation and live access remain unverified.

Keep the developer in the current conversation. For a uniquely scoped named
alert or trace, do only the necessary preflight; do not force a broad assessment.

- Establish web/API versus Foundry-agent scope and the requested task.
- Inspect the host's available tool descriptions and actual input schemas.
  Identify resource metadata and relevant log, metric, or trace reads.
- Reuse available schema/discovery results before requesting them again. Retain
  table-specific column names/types, source, units and result limits in the
  conversation; custom property keys and populated identities require separate
  evidence. If context is genuinely unavailable, explain that and propose the
  smallest recheck for approval instead of asking the developer for field names.
- Distinguish installed, callable, authenticated, authorized, and useful data.
  A repository listing or successful sign-in proves neither telemetry access nor
  health. Do not inspect credentials to establish identity.
- Reuse approved integrations and identity. If required Azure operations are
  missing, offer the reviewed Azure MCP setup path instead of only reporting a
  blocker. After explicit setup approval, use actual host installation/configuration
  operations when available; otherwise guide the developer through the documented
  action. Confirm that the tools become available, then request the next read
  approval. Setup does not authorize identity switching, role grants, unrelated
  connections, application deployment or repair scripts. A refusal stops setup,
  not permitted analysis of supplied evidence.
- Determine whether an approved Python 3.9+ interpreter is runnable before
  invoking the helper. If unavailable, explicitly select **tools-only mode**:
  continue permitted metadata and telemetry reads, report per-signal evidence,
  and disclose that helper validation/classification and persistence are
  unavailable. Do not install a runtime or rely on another product's internal
  bundled interpreter as a supported customer dependency.
