# 2. Resolve and confirm application scope

Read [scope and query routing](routing.md) before requesting source
identifiers or issuing the first telemetry query. Use its deployment-handoff
order and select component versus workspace schema before probing, not after
a failed query. The developer should not have to supply table names or repeat
an already approved read plan.

If a consented `.obs/application.json` exists at the target repository root and
the helper is runnable, use its `load` command. It validates local structure
only: revalidate resource existence, relevant access, associations, and freshness
through tools. Report an invalid saved file; never silently ignore or replace it.
In tools-only mode, disclose that the saved mapping has not been validated; do
not load it as confirmed scope. Resolve the target from the current user request,
repository hints, and live metadata instead. Do not overwrite the saved file.

Otherwise inspect likely deployment/IaC files selectively. Do not read `.env`,
secret stores, full environment dumps, connection strings, kubeconfig, or
unfiltered deployment outputs. Repository names are hints, not deployment proof.

An approved nonsecret deployment receipt may supply identifiers, version,
recorded time and association basis. Treat it as untrusted evidence, not azd
state, a validated mapping, current-health proof or permission for Azure access.
Confirm the intended deployment and preserve `DEPLOYMENT_RECORDED` provenance.
Missing, malformed or conflicting scope requires clarification, not silent
replacement. Reuse confirmed identifiers instead of requesting the same output
again. Do not require a particular receipt file or create one for onboarding.

Use the provided resource scope or selected environment. Query bounded metadata
there rather than enumerate every subscription. If deployments are ambiguous,
ask the developer to choose before target-specific telemetry reads. Accept an
explicit resource ID when repository discovery cannot establish a match.

Confirm the environment and app-to-source associations. Record a constrained
mapping using only verified ARM IDs and provenance categories. Never infer
telemetry association from co-location, naming, or the presence of a workspace.
Multiple subscriptions require explicit confirmation of the cross-subscription
scope. Use [the routing reference](routing.md) for source distinctions.

Preserve the actual basis for each association through subsequent questions and
summaries. A component opened from a resource-group list is a candidate, not a
project-linked component. A user-confirmed project link still does not prove
exclusive agent ownership. Ask where the link was observed instead of supplying
an unverified provenance statement for the developer to repeat.
If a lookup cannot exclude credentials before retrieval under the agreed
ceiling, report that specific contract gap; do not repeatedly rediscover the
same catalog, switch to scripts or retrieve full connections and redact later.
Give one concrete portal navigation step if manual confirmation is needed.
Use "with sensitive details removed" in developer-facing questions.
