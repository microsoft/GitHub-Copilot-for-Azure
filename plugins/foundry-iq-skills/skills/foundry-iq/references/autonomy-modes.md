# Autonomy modes

Mode changes **who chooses discretionary values**. It never changes hard stops.

## Detect the mode

Treat the session as **autopilot** when the user states an end-state outcome and
delegates execution, says not to ask, or the harness runs unattended. Treat it as
**steering** when the user asks for a plan, options, or a review first. When the
mode is unstated and a hard stop is reachable, behave as steering for the first
mutation, then continue in the mode the user's response establishes.

## Mode-invariant rules

These never relax, in any mode:

- Billable, permission, network, production, destructive, and data-movement
  changes require explicit approval.
- Never expose keys, tokens, or connection strings; never enable local auth or
  public access as a shortcut.
- Never widen an approved source, identity, or role scope to make a step pass.
- Verify the user-visible postcondition; resource creation is not success.
- Fail closed and report when an approval, policy, identity, or role is
  unresolved. Autopilot is not permission to proceed past a hard stop.

## Discretionary band

| Decision | Steering | Autopilot |
|---|---|---|
| Reversible technical default | Recommend, then apply | Apply and record |
| Product/architecture choice | Present rationale, confirm | Decide by `discover-and-decide`, record rationale |
| Reuse versus provision | Present candidates and fitness | Reuse the best fit; provision only when none fit |
| Ambiguous data boundary | Ask | Choose the narrowest defensible scope, record it as an assumption |
| Multiple plausible subscriptions or environments | Ask | Stop and ask; this cannot be inferred safely |
| One bounded tuning change | Propose before applying | Apply, keep only a measured improvement |
| Recoverable failure | Report and propose | Retry the documented recovery, then report |

## Autopilot obligations

Autonomy increases the reporting duty. Record every inferred decision, applied
default, narrowed scope, assumption, and recovered failure in the final output so
a reviewer can audit what was chosen without being asked.

Consolidate hard stops into one approval request at the earliest point at which
the full scope is known, rather than interrupting repeatedly. If the user cannot
respond, stop with a complete plan instead of downgrading the design.

## Steering obligations

Present one plan, not a menu of every option. State the recommended choice first
with its rationale, the alternatives considered, and what changes if the user
picks differently. Incorporate feedback without rediscovering the environment,
and do not re-ask a question the user already answered.

## Output contract

Return the detected mode and its evidence, decisions made without asking,
questions asked, approvals requested and granted, assumptions recorded, and any
hard stop that halted execution.
