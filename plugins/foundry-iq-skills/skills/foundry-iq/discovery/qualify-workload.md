# Qualify the workload

**Domain:** Discovery
**Writes:** the workload profile every later stage reads.

Run this before `discovery/reuse-or-provision` and before any build primitive.
It produces the one artifact the rest of the bundle consumes, so that ingestion,
retrieval, evaluation, and operations stop re-deriving the same facts and stop
disagreeing about them.

Resolve each field from the repository, the corpus, the Azure context, and the
request itself. Ask only for a field that materially changes architecture, cost,
security, or business behavior and that inspection cannot settle. Read
`references/autonomy-modes.md`: under steering ask the single highest-value
question, under autopilot decide, record the assumption, and prefer the
reversible option.

## The workload profile

| Field | Resolve | Decides |
|---|---|---|
| Query shape | Are questions explicit and bounded, or do they need decomposition, several sources, ambiguity resolution, or synthesis? | Retrieval architecture and output |
| Corpus and content type | Size, format, volatility, and whether diagrams, figures, tables, or layout carry meaning | Persistence and ingestion mode |
| Entitlement model | Do different callers see different documents, and does the source enforce that itself? | `knowledge/end-user-identity` and the identity flow |
| Freshness | How stale may an answer be, and what changes the source? | Ingestion model and schedule |
| Latency and cost | The budget the experience must hold | Reasoning effort, tier, and retrieval output |
| Environment and policy | Region, network posture, local-auth and public-access policy, existing IaC and deployment system, production or prototype | Network posture and interface selection |
| Consumer | Application boundary, existing agent, new hosted agent, or the current session | Which retrieval primitive exposes the result |

Consumer is recorded, not decisive. `references/architecture-choices.md` sizes
the architecture from query shape and content, never from the consumer.

## Rules

Record an unresolved field as unresolved. A guessed entitlement model or a
guessed policy posture is the failure this primitive exists to prevent, and both
fail closed: stop and report rather than continuing with a universally readable
copy or a public fallback.

Do not turn qualification into an interview. Every field that inspection can
answer must be answered by inspection, and the profile must name where each
value came from.

Re-qualify rather than re-plan when a later stage contradicts the profile — for
example when evaluation shows the query shape is not what the profile recorded.
Update the field, record the evidence, and let the affected decisions re-derive.

## Output contract

Return the profile with a value, a source, and a confidence for every field; the
fields that remain unresolved and what would resolve them; the questions asked
and why inspection could not settle them; and the assumptions recorded under
autopilot.
