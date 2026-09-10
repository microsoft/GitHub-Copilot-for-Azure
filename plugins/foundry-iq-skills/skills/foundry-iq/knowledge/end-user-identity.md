# Preserve end-user permissions

**Domain:** Knowledge
**Reads:** workload profile — entitlement model.

Use this primitive when different users are entitled to different documents and
retrieval must reflect each caller's own access. SharePoint, ACL-bearing blob
content, and Work IQ are the common cases.

This is not a connector detail. It changes the identity flow of the application,
so decide it before ingestion rather than after retrieval returns too much.

## 1. Recognize the requirement

Treat per-user trimming as required when the user says employees, customers, or
teams should see different results; when the source enforces its own permissions;
or when the corpus contains content the whole organization may not read. When it
is required and cannot be satisfied, stop and report. Never continue with a
universally readable copy of permission-bearing content.

## 2. Preserve permissions at ingestion

Configure the knowledge source to carry source permissions rather than flattening
them:

- For SharePoint, index document-level permissions so each item retains its
  access control identity.
- For blob content, set `ingestionPermissionOptions` to the RBAC scope so the
  source boundary is not widened.
- Never copy ACLs into logs, prompts, or citations, and never store them as
  ordinary filterable content that a caller could inspect.

Verify that permission metadata is present and populated after ingestion. Missing
permission data silently degrades to over-sharing, which retrieval alone will not
reveal.

## 3. Flow the end-user identity

The application must call retrieval with a token that represents the end user,
not the service identity:

1. Authenticate the user in the application.
2. Exchange that token on behalf of the user for the identity the retrieval call
   requires, keeping the user as the effective caller.
3. Pass that token through retrieval so trimming evaluates the caller.
4. Refresh before expiry and retry once on a fresh token; surface persistent
   `401` or `403` with the failing audience, identity, or role.

A service identity with broad read access is the failure mode this primitive
exists to prevent. Do not fall back to it when the user token is unavailable, and
do not grant the service identity source permissions to make a test pass.

## 4. Prove it with two identities

Compose `evaluation/verify-access`. A trimming implementation is unproven until
two identities with different entitlements return different authorized results
for the same query, and the unauthorized identity receives no document, citation,
snippet, metadata, or derived answer.

If either identity is unavailable, report the workflow as unverified rather than
complete.

## Output contract

Return the sources and their permission mode, the ingestion evidence showing
permission data is present, the end-user identity flow and token exchange used,
the two identities tested, the differing authorized results, the deny-test
verdict, and any source that could not preserve trimming.
