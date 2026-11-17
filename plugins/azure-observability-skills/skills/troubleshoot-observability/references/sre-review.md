# Review an existing SRE Agent option

### Fit and connected proof before a recommendation

Direct telemetry remains the default. Consider SRE only within a currently
admitted operational investigation with a material unanswered question on the
named incident or developer-selected finding. Retain the finding's rank/state;
never select a finding for the developer. Do not introduce SRE for routine code,
resource/agent creation, conceptual questions, health ranking before selection,
or recovery comparison. Do not call SRE to repeat sufficient completed analysis
or compete with an actionable fix-plan question or visual choice.

Use retained/user-supplied facts with provenance and already exposed host metadata
first. A proactive recommendation requires all of:

- An identified existing `Microsoft.App/agents` resource and resolved endpoint,
  actual connected host operations, and relevant configured source coverage.
  Record the evidence basis and freshness. A router/tool name alone, agent name,
  resource-group co-location, `Running` state or empty custom-tool list proves
  neither connection, useful coverage nor action restrictions. Unknown current
  connection status is **unverified**, not available.
- A scenario-specific positive advantage over the current direct mechanism.
  For example, verified configured multi-resource context/approved operational
  knowledge, relevant existing runbook/incident history, or a supported operation
  combining actual approved sources may answer the particular unresolved
  question with fewer manual handoffs. Name the supporting metadata/evidence and
  the concrete current-path limitation; do not invent service abilities or
  promise root cause, time or cost savings. Cross-service complexity alone is
  not an advantage.
- The option is consistent with the developer's ceilings. Missing, denied,
  empty, stale, throttled or failed data, or exhausted budget alone is not SRE
  benefit or permission to bypass access. Do not use the service identity as a
  backdoor to a denied source; exact source/destination and the trust boundary
  need explicit review, and a user prohibition still stops access.

Do not automatically list agents across a subscription or perform cloud setup
to search for one on each incident. When an already known relevant agent lacks
a connection/coverage fact, explain only the precise scoped prerequisite review
needed; do not call it connected or ready. New eligibility/configuration reads
require their own bounded approval and remaining budget, including under no-query
or supplied-evidence-only limits. Inspect safe nonsecret projections/contracts
before retrieval; filtering secrets after retrieval is not safe discovery.
Do not fetch connection credentials, configuration secrets or raw environment
outputs. Do not suggest provisioning, new connections, sign-in, roles, connector
configuration or catalog shopping to make the recommendation fit.

Unknown service action controls permit only **review SRE option/control gaps**,
not a ready-to-execute recommendation. If known controls cannot enforce the
requested limits, explicitly block service execution and retain the direct
fallback; do not bait a "use SRE" choice for known-unconstrainable investigation.

### One chat choice, not service delegation

For verified connected proof and a demonstrated advantage, Copilot may say:

> The existing connected SRE Agent [verified alias] may help with
> [specific unanswered question] because [verified configured capability/context],
> compared with [current direct limitation]. [Relevant control/access unknowns;
> execution remains blocked until verified.] Would you like me to review this
> option, or continue direct investigation?

Use one host-supported choice: **Review SRE option / Continue direct**. Replace
placeholders only with verified facts. Keep **Using:** limited to actually loaded
skills; a service/tool discovery is not a loaded SRE skill. The recommendation
causes no tool call, thread, service follow-up, context transfer or persistence.
An accepted review opens only a plan review using already approved retained
facts. It grants no new reads, source access, delegation or execution permission.
An explicit SRE request enters that review directly, without a redundant
recommendation prompt, but does not bypass prerequisites or execution approvals.

Recommend once per retained scope; revisit only a material new advantage or
developer request. Retain decline, current-path-only, supplied-evidence-only,
no-external-service and stop preferences through handoffs; no repeated nagging.
If direct evidence is sufficient, make no suggestion. On any blocked/declined
branch return the same facts, gaps and next permitted direct action, preserving
the [trace capability routing](trace-capabilities.md), scope and remaining budget.
Do not substitute another external service when SRE is declined or blocked.
