# Verify access boundaries

**Domain:** Evaluation
**Reads:** workload profile — entitlement model.

Use this primitive after connecting private sources or deploying a governed agent.

Require the user to provide or approve two test identities and a query whose
expected visibility is known. Identity creation or role changes require approval;
running read-only checks with existing identities does not.

1. Choose one query with evidence visible to the authorized test identity and
   restricted from the unauthorized test identity.
2. Run the query as the authorized identity. Require the expected document and a
   supporting citation.
3. Run the same query as the unauthorized identity.
4. Require zero retrieved documents, zero citations, and no title, snippet,
   metadata, or derived-answer disclosure.

Any restricted disclosure fails the workflow. Do not weaken source permissions or
switch to a service-wide identity to make the test pass. Return both identity
bindings, retrieved document identifiers, citations, snippets inspected, and the
deny-test verdict. On failure, compose `troubleshooting/diagnose-and-repair` without
changing permissions automatically.
