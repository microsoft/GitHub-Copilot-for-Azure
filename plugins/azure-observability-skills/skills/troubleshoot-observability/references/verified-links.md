# Verified evidence links

Use already verified source/component/portal links. Omit unresolved links rather
than guessing a route or issuing more telemetry reads solely for a URL.

An Application Insights transaction link needs a representative event's
`itemId` UUID, operation ID, timestamp, source table and confirmed component
identity. A span ID, operation ID or Foundry conversation ID alone is not the
event anchor. Prefer a root request or availability event when already supplied.

If `assess-observability-health` is actually available, its transaction-link
guidance and optional helper can construct a link from those existing fields.
Load its instructions through the host; do not assume a sibling filesystem path.
Execution requires an existing approved interpreter and separate consent.
Without it, reuse a verified component link or describe the relevant portal view.
URL construction does not establish that the portal view rendered successfully.

Keep application conversation IDs distinct from distributed trace/span IDs.
Do not expose raw artifacts, secret-bearing URLs or unnecessary identifiers.
