# Integrate search into an application

**Domain:** Retrieval
**Reads:** workload profile — query shape, latency and cost, entitlement model.

Inspect the existing language, framework, dependency injection, configuration,
API conventions, UI contract, tests, and telemetry. Use the supported Azure SDK
for that language when it covers the required operation; otherwise use the stable
REST contract and pin its API version.

## Implement

1. Add the search client to a trusted backend using `DefaultAzureCredential`.
   Use managed identity in Azure and the developer's existing credential chain
   locally. Never embed an admin key or expose privileged Search access to a
   browser or mobile client.
2. Implement the smallest query shape that meets the experience. Prefer hybrid
   plus semantic ranking when configured; include filters, facets, sorting,
   suggestions, highlights, paging, or geo constraints only when required.
3. Treat authorization filters as mandatory request context, not optional UI
   input. Validate user input and bound page size, query complexity, and selected
   fields.
4. Add timeout, cancellation, service-aware retry, structured diagnostics, and
   correlation without logging query secrets or restricted content.
5. Add unit tests for request construction and integration tests for successful,
   empty, filtered, unauthorized, throttled, and malformed cases.

Infer repository conventions and reversible code choices. Ask only about unresolved
user experience or business semantics. Package installation and local edits may
proceed when the user asked for implementation; Azure roles or configuration
changes require approval.

Verify through the application's public boundary using representative user
queries. Return files and dependencies changed, identity configuration, query
contract, test evidence, telemetry location, and local/run instructions.
