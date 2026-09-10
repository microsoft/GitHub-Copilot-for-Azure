# Recommended defaults and approval boundaries

Encode expertise by making reversible technical choices automatically and asking
only for information that changes business intent, cost, security, or data scope.

## Proceed without asking

- Inspect the repository, application stack, package manager, IaC, Azure context,
  resource inventory, policy, and read-only service status.
- Reuse a compatible resource in the same environment before proposing another.
- Derive deterministic names from the app, environment, and resource type.
- Generate code, tests, configuration, and a dry-run plan in source control.
- Use the current authenticated identity for read-only discovery.
- Retry one transient request or one authentication failure after refreshing the
  token. Preserve the original diagnostic if retry fails.

## Recommended defaults

Use these when context does not provide a stronger requirement:

| Decision | Default |
|---|---|
| Authentication | Microsoft Entra ID, managed identity in Azure, `DefaultAzureCredential` in application code, local auth disabled on new services |
| Resource reuse | Reuse a compatible service; otherwise apply [region-capacity-preflight](region-capacity-preflight.md) and colocate with the app and data in an allowed region |
| Search mode | Hybrid text and vector retrieval with semantic ranking when the selected tier and corpus support them |
| Data loading | Indexer for supported Azure sources, schedules, enrichment, or integrated vectorization; push API for arbitrary sources or near-real-time writes |
| Refresh | Incremental change tracking; hourly for document corpora unless freshness requirements imply another cadence |
| Schema changes | Versioned index plus alias swap; never make an unproven breaking production change in place |
| Application boundary | Query from a trusted backend; never expose admin credentials to a browser or mobile client |
| Configuration | Source-controlled SDK/REST definitions and IaC, with the API or package version pinned |

Serverless is a preview choice. Recommend it only for an explicitly approved
development or bursty workload, never as an implicit production default.

## Ask the user

Ask one focused question at a time, with the recommended answer first, only when
the value cannot be discovered:

- Which subscription or environment to change when more than one is plausible.
- The approved source, container, prefix, table, folder, or dataset boundary.
- Whether a workload is development or production when the repository and Azure
  context disagree.
- A user-provided evaluation dataset and its primary success metric.
- A business choice such as freshness, languages, expected traffic, or latency
  objective when it materially changes architecture or cost.

## Require explicit approval

Present one consolidated plan with cost class, identities, network changes,
data movement, duration, verification, cleanup, and rollback before:

- creating or scaling billable resources;
- assigning roles or changing permissions;
- changing public/private network access, private endpoints, DNS, or encryption;
- uploading private content or sending content to an embedding/model service;
- mutating production or rebuilding or swapping an index.

Approval applies only to the described scope. A changed scope requires new
approval. This skill does not execute deletion; it returns an ownership-scoped
cleanup plan for a separately approved destructive workflow. Read-only evaluation
and local code generation do not require approval.
