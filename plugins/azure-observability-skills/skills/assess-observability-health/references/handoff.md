# 6. Preserve developer choice and hand off

End with the current health stage and next action explicit. If continuation is
appropriate and no finding is selected, ask one concise finding-selection
question, not a remediation question; never auto-select rank 1 or investigate.
Explicit recommendations-only, no-follow-up or stop suppresses the question.
Retain an accepted selection/decline and known preferences across handoffs.
Defer optional visual questions while a finding-selection question is pending.
Do not end with a suggested prompt requiring the developer to type a skill name;
this restriction does not prohibit a legitimate human next-step question.

Retain ranked IDs/states, quantified evidence, scope, gaps and permission context.
Ask for the developer's chosen finding when investigation is requested without a
selection; never substitute rank 1 or start RCA on the developer's behalf.
Use the existing coordinator's investigation selection if available, or directly
load applicable `azure-diagnostics` for web/API/infrastructure and
`microsoft-foundry` trace/troubleshoot for agent/model/tool behavior.
Resolve actual loading, tools and missing permission first. No mandatory
coordinator hop, repeated onboarding or health-selection loop.
These specialists are optional external skills, not bundled sibling paths.
If absent, use sufficient supplied evidence with the available coordinator's
local affected-path references, or report the specific unsupported question.
Offer installation only with consent. Neither health nor ordinary investigation
requires an external-service client.

After an actual approved change, proactively offer available
`verify-observability-fix` comparison using existing supplied evidence; reuse
an accepted request or explicit decline rather than prompting again. A yes
authorizes no new reads, jobs or traffic. A proposed plan stays unverified.
The comparator compares
agreed original/post-change evidence. A health finding labeled `recovered` is
not `VERIFIED_RECOVERED`, change causation or a replacement for that comparator.
No restarts, deployments, scaling, RBAC, alert edits, traffic, new evaluations or
automatic persistence are authorized by this read-only assessment.
