# 5. Return a chat-first investigation and approved-fix handoff

Include selected finding/rank, affected scope/window, observed mechanism versus
causal hypothesis, confidence source/basis, a compact evidence table (values,
timestamps, correlation/source), causal chain, ruled-out alternatives,
contradictions, probe gaps and remaining uncertainty. Propose the smallest
evidence-backed fix as an **unexecuted option**, conditional on intentional
behavior constraints, plus at most one confirming check per unresolved boundary.
Name validation criteria and guardrails. No edits, remediation or recovery
claims follow from investigation permission.

Offer a compact Mermaid path only when it clarifies verified relationships.
Do not generate HTML, Grafana/workbooks or save evidence automatically.
Include available verified evidence links; never invent two or three links to
meet a quota. The [verified-link guidance](../verified-links.md) reuses the
existing packaged health helper rather than duplicating it.

Finish direct, evidence-only and service-return results using
[the result-to-next-action contract](../next-actions.md):
state the stage and offer the smallest supported fix/rollback plan review with
one question unless stopped/declined; unresolved cause calls for evidence.
This is not permission to edit, deploy, collect or save.
After completed plan review, use the same contract's implementation continuation:
ask for missing source or propose the exact minimal edit for separate approval.

After an actual separately approved change, offer comparison and hand retained original and supplied
post-change evidence/thresholds to `verify-observability-fix`. Do not reassess
health or infer recovery/cause from recommendations, deployment status or a
service's completed status.
