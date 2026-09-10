# Retrieve grounded knowledge

**Domain:** Retrieval
**Reads:** workload profile — query shape, entitlement model, latency and cost.

Use this primitive when an agent or developer needs to query an existing Foundry
IQ knowledge base or Search index and return evidence-backed output.

1. Discover the retrieval target and verify the caller can access it. Ask for a
   knowledge-base choice only when several plausible targets remain.
2. Register `/knowledgeBases/{knowledge-base-name}/mcp` in the active agent
   session when it is not already available. For SSE, send
   `Accept: text/event-stream`. For a classic index, query through the supported
   Search data-plane surface instead.
3. Make `knowledge_base_retrieve` available to the planner on the knowledge-base
   path, or the index query surface on the classic path. Do not force a tool
   call for requests unrelated to the knowledge corpus.
4. Retrieve with the end-user identity when ACL trimming is required.
5. Inspect source content read-only when confidence, citation completeness, or conflicting
   evidence requires it.
6. Return extractive passages with citations by default and let the consuming
   agent compose the reply. Knowledge-base answer synthesis is for workloads that
   need one composed answer across passages; enabling it moves the citation one
   step away from source text, so turn it on only when extractive results
   demonstrably fall short. The same applies to raising reasoning effort.

Success requires that the retrieved passage supports the answer, citations resolve
to the original source identity, restricted content is absent, and persistent
`401` or `403` responses identify the failed audience, identity, or role.

No approval is needed for read-only retrieval already authorized by the user.
Return the answer, citations, retrieval trace, identity mode, the output mode
used and why, latency, and any unsupported claims that were intentionally
omitted.
