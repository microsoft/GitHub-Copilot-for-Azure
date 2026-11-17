# Separate SRE execution gate

### Separate execution gate, unchanged permission ceiling

Before ANY service operation with possible side effects, establish the actual
operation contract, exact target/service identity and endpoint, configured
coverage, network access and actual data-plane permissions. ARM reads and
data-plane permissions are distinct; a visible router or successful metadata
read certifies neither. Documented examples include `sreagent_agents_list` and
`sreagent_threads_create`; documentation is not proof of host exposure or access.
Report missing permissions; do not grant roles.

Verify effective permitted tools and enforceable action restrictions under the
service identity, not merely a read-only prompt. A read-only prompt is not a
permission sandbox; an empty custom-tool list does not exclude autonomous
built-in writes. Unknown controls leave execution blocked. If permissions cannot
be verified to prohibit unapproved actions or requested limits cannot be enforced,
STOP service execution and continue permitted direct/supplied-evidence analysis.
Never use `investigate_yolo`, blanket auto-approval, RBAC changes, provisioning,
connector changes, evaluation traffic or automatic fixes to make it work.

Review exact sources/destination, minimized payload and exclusions, service-side
context and persistence, timeout/iteration/cost limits, remaining budget and
expiry. Obtain separate positive approval for the exact one thread creation,
data transfer and persistence before those actions. Recommendation acceptance
and telemetry-read consent cover none of these new boundaries. Reuse an existing
unexpired approval only for its actual covered operation, identity, scope,
source/destination, handling and budget; state that coverage without reprompting.
Host approvals remain in force. No automatic server-side follow-up.

Keep recommendation, inspection, review acceptance, execution approval and actual
execution outcomes distinct in the [conversation handoff](handoff.md), including
evidence provenance, blockers, declines, action limits and consumed/remaining
budget. SRE thread IDs, distributed trace IDs and Foundry conversation IDs remain
separate. Validate service findings/confidence against their cited sources and
coverage gaps; service output is not independent root-cause or recovery proof.
No mandatory SRE, Python, azd, .NET or new MCP is added for web/API or Foundry.
