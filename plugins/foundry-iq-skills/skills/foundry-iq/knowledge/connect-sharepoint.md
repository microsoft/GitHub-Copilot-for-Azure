# Connect SharePoint content

**Domain:** Knowledge
**Reads:** workload profile — entitlement model, corpus and content type, environment and policy.

The outcome is grounded retrieval over approved SharePoint sites or libraries
where different users are entitled to different documents. "SharePoint" is not
one architecture: decide remote versus indexed before proposing anything.

Compose `knowledge/end-user-identity` for the caller identity flow and
`evaluation/verify-access` for the deny test. Neither path is complete without
proving that two differently entitled users receive different results.

## 1. Test the remote prerequisites first

Remote is attractive because SharePoint stays the live retrieval system and
enforces its own permissions directly, with no copy of the content and no
indexer pipeline to own. It is only available when every prerequisite holds.

Verify, before proposing it:

1. The intended querying user population holds Microsoft 365 Copilot licenses.
   This covers the developer's target users, not just the developer.
2. Tenant and identity prerequisites are satisfied for the Copilot Retrieval API.
3. Textual retrieval is sufficient for the expected questions.

Ask the user about the intended user population when licensing cannot be
discovered. Do not assume the developer's own license generalizes, and do not
propose remote and discover the licensing gap after approval.

## 2. Select the path

| Path | Select when | Consequence |
|---|---|---|
| SharePoint Remote | All three prerequisites hold | Remote knowledge source into a knowledge base; live content; native permissions; textual only |
| SharePoint Indexed | Any prerequisite fails, or evaluation shows remote quality is insufficient | Content ingested into Azure AI Search with a generated index and indexer pipeline, preserving supported ACL behavior |

Prefer indexed, even when remote is available, when the workload needs greater
retrieval control, richer content processing, or multimodal representation.
Remote queries textual content only, so a corpus whose diagrams, figures, or
tables matter is an indexed corpus; compose `knowledge/process-content` to select
the extraction mode.

Promote remote to indexed on measured quality, not on preference. When remote is
viable and the questions are textual, remote is the smaller architecture and the
correct default.

## 3. Connect and preserve permissions

Connect only the approved sites, libraries, or paths. Follow
`references/defaults-and-approvals.md` and obtain approval before ingesting
private content or assigning roles.

For remote, register the source and confirm retrieval resolves live content with
the caller's identity. For indexed, index document-level permissions with the
content, keep the generated index and indexer definitions source-controlled, and
verify ingestion and freshness.

Pass the end-user token through retrieval on both paths so trimming evaluates the
caller rather than the service identity. Never copy source ACLs into logs, widen
a site scope, or disable trimming to make a query return results. When a source
cannot preserve trimming, report it instead of lowering trimming for the whole
knowledge base.

## 4. Prove the entitlement boundary

Run the two-identity check explicitly. A single authorized query passing is not
evidence:

1. An authorized user retrieves the documents they are entitled to, with
   citations that resolve to the original SharePoint item.
2. A differently entitled user receives zero restricted documents and no
   disclosure of their existence in citations, counts, or error text.

Report a licensing gap, a trimming gap, or a failed deny test as a blocking
finding. Do not substitute service-identity retrieval to produce a working demo.

## Output contract

Return the licensing and prerequisite evidence, the selected path and why,
the approved SharePoint scope, ingestion and freshness state for the indexed
path, the caller-token behavior, both identity results from the deny test, and
rollback.
