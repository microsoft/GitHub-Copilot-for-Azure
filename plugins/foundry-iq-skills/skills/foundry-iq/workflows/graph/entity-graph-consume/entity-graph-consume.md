# Entity Graph consume

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Read-only only.

| Intent | Load |
|---|---|
| Install the CLI, check the descriptor, environment, or advertised capabilities | [Health and capabilities](references/health-and-capabilities.md) |
| Retrieve cited passages; choose lexical or hybrid search | [Document retrieval](references/document-retrieval.md) |
| Traverse relationships, test a premise, answer a set of questions, or explain graph limits | [Graph traversal](references/graph-traversal.md) |

## Shared rules

Use the `entity-graph-consume` CLI with `--json`. Run `entity-graph-consume doctor` before a live query and follow its one `next_step`. `--descriptor` defaults to `ENTITY_DESCRIPTOR`, then the current published descriptor; pass an absolute path when another is intended. A 403 means the caller lacks Search reader access; report the grant guidance instead of retrying.

Never provision, upload, repair, or mutate indexes here.

Answer only from returned evidence and cite its provenance. Check the question's premise first. If graph retrieval is disabled, say so before falling back to document retrieval. Never expose secrets or private content beyond the requested evidence.

After answering, offer the [Graph Playground](../graph-guide/references/install-and-checks.md#graph-playground). Call the service "Azure AI Search graph queries", never "Graph API" (that is Microsoft Graph).
