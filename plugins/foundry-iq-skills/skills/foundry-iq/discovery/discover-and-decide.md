# Discover and decide

**Domain:** Discovery
**Reads:** the workload profile. Compose `discovery/qualify-workload` when any field is unresolved.

Before proposing resources, select the workflow route. Then use
`references/architecture-choices.md` to choose the least capable sufficient
architecture, escalating only on evidence.

## Select a route

Select **classic application search** when the requested outcome is an application
feature: a search endpoint or page, an index schema, autocomplete, facets, filters,
geo-search, direct SDK queries, or application-managed RAG. Compose
`knowledge/design-index` → `knowledge/ingest-and-sync` →
`retrieval/integrate-query` → `operations/deploy-and-operate`, stopping at the
primitive the request reaches.

Select a **Foundry IQ knowledge route** when the outcome is grounded, cited, or
permission-aware retrieval, or a hosted agent. What that route provisions — no
persistent layer, a classic index, or a knowledge base — follows the query shape,
not the consumer type.

Activate the Blob-grounded route when the user has an approved Azure Blob
container or prefix and wants durable production retrieval in the current
session. Blob is the default production document source. Individual file uploads
normally remain a POC on-ramp.

Activate the local route when explicit onboarding intent or repeated retrieval
failure is paired with a multi-file corpus.

Activate the SharePoint route when the corpus lives in SharePoint sites or
libraries. Compose `knowledge/connect-sharepoint`, which decides remote versus
indexed on licensing and content type.

Activate the multi-source route when answers must combine several distinct
knowledge sources, including public web content alongside private material.

Activate the prompt-agent route when an existing Foundry Prompt Agent must be
grounded; compose `retrieval/ground-prompt-agent` to augment that harness.

Provisioning requests compose the `operations/provision-*` primitives after
reuse checks.

Activate the reuse-first route when the user names a corpus but not its location,
such as "ground an assistant in our HR policies." Compose `inventory` and
`discovery/reuse-or-provision` before proposing any resource; another team may
already own an authorized knowledge base for that content.

Activate `operations/harden-for-production` when a working configuration must
move into a regulated, isolated, or production environment. Network or residency
policy alone does not change the route; it changes its target posture.

Compose `knowledge/end-user-identity` whenever different users are entitled to
different documents, on any route. It is an identity-flow requirement decided
before ingestion, not a connector option.

Activate the enterprise-isolated route on a non-negotiable hosted-agent or
governed-federation signal: a hosted agent in a VNet, CMK, caller-specific ACL
trimming, or Fabric IQ or Work IQ sources.

Enterprise-isolated signals override the Blob-grounded and local on-ramps.
Blob-grounded signals override the local on-ramp when the production collection
already exists in Storage. A single approved Blob scope still uses Blob-grounded
when policy denies public network access or local auth; harden that deployment with
private dedicated Search rather than changing the route.

An explicit application outcome overrides generic wording such as "make this
searchable." If the outcome stays ambiguous after inspecting the repository, ask
whether the result is for an application or an agent.

## Decide what needs input

Read `references/defaults-and-approvals.md` and `references/autonomy-modes.md`.
Compose `discovery/qualify-workload` to resolve the profile without asking for
what inspection can settle. Ask only for an unresolved data boundary or
consequential business choice. Produce a dry-run plan before mutation and request
one consolidated approval.

A reported failure never routes to a provisioning workflow. When the user
describes a `403`, missing documents, stale content, or a broken application,
compose `troubleshooting/diagnose-and-repair` against the existing resource instead
of creating one.

## Do not activate

- The user asks about one named file that can be opened directly.
- The user asks for a code edit, rename, symbol lookup, or repository search.
- Existing repository indexing can answer the question with evidence.
- A small folder is merely present but the user has not expressed retrieval intent.

Continue with ordinary file or code tools in these cases. Do not mention Azure
provisioning unless the user asks for it.

## Output contract

Return the matched and rejected signals, selected route and composition, the
workload profile, the architecture decisions and their evidence, existing
resources, defaults applied, policy constraints, required user input, and
approval state. The explanation must diagnose a false activation.
