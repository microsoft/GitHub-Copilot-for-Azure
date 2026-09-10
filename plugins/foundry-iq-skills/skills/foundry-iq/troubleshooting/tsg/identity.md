# Authentication and authorization failures

**Domain:** Troubleshooting — lookup guide

Bearer tokens, data-plane RBAC, role scope and principal selection, propagation delay, indexer source identity, and document-level permission trimming.

Loaded by [diagnose-and-repair](../diagnose-and-repair.md) after the failure
family is classified. Do not load every family; load the one that matches.

## How to use this file

1. Find the entry whose **Signature** matches what was actually observed. A
   symptom that merely resembles an entry is not a match.
2. Run the **Discriminator** before doing anything else. It is a read-only check
   that confirms this diagnosis and rules out the **Lookalikes**. If the
   discriminator does not confirm, the entry does not apply — read the lookalikes
   and start again rather than applying the fix anyway.
3. Apply the **Fix** only after the discriminator confirms, and treat the **Risk
   class** as the approval class from `references/defaults-and-approvals.md`.
4. Prove the repair with **Verify**. A symptom that stops reproducing is not
   evidence the cause was addressed.

A symptom match alone never justifies a mutation. Matching a symptom to the
nearest entry and applying its fix is the specific failure this file is
structured to prevent.

`Confidence: documented` means the behavior is stated in the cited Microsoft
source. `Confidence: inferred` means it was reasoned from the source but not
stated verbatim; treat those as hypotheses to confirm, not as facts.

**Review status: documentation-derived, not yet field-reviewed.** Entries trace
to Microsoft documentation and pass structural checks, but no domain expert has
confirmed that a discriminator is genuinely diagnostic or that a stated limit is
current. This is why step 2 is not optional: run the discriminator, and when it
does not confirm, diagnose from evidence instead of applying the nearest fix.

## Symptom index

- [A bearer-token data-plane request is denied even though a Search role is assigned](#a-bearer-token-data-plane-request-is-denied-even-though-a-search-role-is-assigned)
- [A bearer-token request returns 401, or 403 when the service is configured to suppress bearer challenges](#a-bearer-token-request-returns-401-or-403-when-the-service-is-configured-to-suppress-bearer-challenges)
- [A valid identity gets 403 only for a particular Search operation](#a-valid-identity-gets-403-only-for-a-particular-search-operation)
- [A role is visible in IAM, but the application still gets 403 because it authenticates as another principal](#a-role-is-visible-in-iam-but-the-application-still-gets-403-because-it-authenticates-as-another-principal)
- [A role is assigned to the correct identity but the target service or index still returns 403](#a-role-is-assigned-to-the-correct-identity-but-the-target-service-or-index-still-returns-403)
- [A newly assigned role still returns 401 or 403](#a-newly-assigned-role-still-returns-401-or-403)
- [An API-key client stops working after the service is changed to roles-only](#an-api-key-client-stops-working-after-the-service-is-changed-to-roles-only)
- [An indexer cannot read its Azure Storage data source when managed identity authentication is configured](#an-indexer-cannot-read-its-azure-storage-data-source-when-managed-identity-authentication-is-configured)
- [A managed-identity Storage indexer still gets 403 only when the storage firewall is enabled](#a-managed-identity-storage-indexer-still-gets-403-only-when-the-storage-firewall-is-enabled)
- [A security-filter query succeeds but returns zero documents for a user who should have matches](#a-security-filter-query-succeeds-but-returns-zero-documents-for-a-user-who-should-have-matches)
- [An ACL-enabled query returns only public documents or zero documents although the application can query the index](#an-acl-enabled-query-returns-only-public-documents-or-zero-documents-although-the-application-can-query-the-index)
- [ACL-protected results are missing or still visible after source permissions changed](#acl-protected-results-are-missing-or-still-visible-after-source-permissions-changed)

## Evaluation design coverage

These fault identifiers are priority inputs for future real-service Vally
scenarios. Their presence here is not evidence that the diagnosis path has run.

- `AAD_TOKEN_EXPIRED` — [A bearer-token request returns 401, or 403 when the service is configured to suppress bearer challenges](#a-bearer-token-request-returns-401-or-403-when-the-service-is-configured-to-suppress-bearer-challenges)
- `MCP_TOKEN_EXPIRED` — [A bearer-token request returns 401, or 403 when the service is configured to suppress bearer challenges](#a-bearer-token-request-returns-401-or-403-when-the-service-is-configured-to-suppress-bearer-challenges)
- `ROLE_ASSIGNMENT_PROPAGATING` — [A newly assigned role still returns 401 or 403](#a-newly-assigned-role-still-returns-401-or-403)
- `SOURCE_ROLE_MISSING` — [An indexer cannot read its Azure Storage data source when managed identity authentication is configured](#an-indexer-cannot-read-its-azure-storage-data-source-when-managed-identity-authentication-is-configured)

### A bearer-token data-plane request is denied even though a Search role is assigned

**Observed where:** HTTP response, SDK exception, portal data-plane pages
**Signature:** HTTP `401` or `403`; the status alone is not decisive because `aadAuthFailureMode` can make authentication failures return either `http401WithBearerChallenge` or `http403`.
**Discriminator:** Read the service with `GET .../providers/Microsoft.Search/searchServices/{name}?api-version=2025-05-01`. Diagnosis is confirmed when `properties.authOptions.apiKeyOnly` is present and `properties.disableLocalAuth` is `false`. RBAC is enabled only by `authOptions.aadOrApiKey` or roles-only `disableLocalAuth: true`.
**Causes (ranked):** 1. Data-plane RBAC was never enabled—the most common case. 2. A deployment reset authentication to API-key-only. 3. The role exists only on the control plane.
**Fix:** After confirming required data-plane assignments, set roles-only authentication with `disableLocalAuth: true`; use `aadOrApiKey` only for a controlled migration. Do **not** repair this by re-enabling API keys, granting Owner/Contributor, or enabling public network access.
**Risk class:** `config-only, reversible`
**Verify:** Retry the exact operation using the assigned identity and expect success; retry with an unassigned identity and expect denial. Confirm an API-key-only request remains denied if roles-only was selected.
**Lookalikes:** Invalid token and wrong role also return 401/403. `authOptions.apiKeyOnly` confirms this diagnosis; if RBAC is enabled, inspect token claims and effective assignments instead.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-enable-roles, https://learn.microsoft.com/en-us/rest/api/searchmanagement/services/get?view=rest-searchmanagement-2025-05-01, https://learn.microsoft.com/en-us/azure/search/search-security-rbac
**Confidence:** `documented`

### A bearer-token request returns 401, or 403 when the service is configured to suppress bearer challenges

**Observed where:** HTTP response or SDK authentication exception
**Signature:** HTTP `401 Unauthorized`; alternatively `403` when `properties.authOptions.aadOrApiKey.aadAuthFailureMode` is `http403`.
**Discriminator:** Locally inspect—but do not log or send externally—the access token’s `aud`, `exp`, `tid`, and `oid`. For Azure public cloud, acquire a fresh token with `az account get-access-token --scope https://search.azure.com/.default`; the audience must correspond to `https://search.azure.com`. Also read `aadAuthFailureMode` before interpreting 401 versus 403.
**Causes (ranked):** 1. Missing, expired, malformed, or cached token. 2. Token was acquired for ARM, Microsoft Graph, or another audience instead of Search. 3. Wrong tenant/cloud authority. 4. An API-key header is also present; when both credentials are supplied, Search uses the key.
**Fix:** Acquire a fresh Search token from the correct tenant/cloud and send only `Authorization: Bearer ...`. Sovereign-cloud audiences must match the documented cloud value. Do **not** add an API key, broaden roles, or expose the service publicly.
**Risk class:** `config-only, reversible`
**Verify:** The fresh token succeeds for an identity with the minimum role; an expired or wrong-audience token still fails, and an unassigned identity remains denied.
**Lookalikes:** A valid token with insufficient authorization can also yield 403. A valid Search `aud`, unexpired `exp`, correct `tid`, and matching `oid` rule out token authentication failure.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-get-started-rbac, https://learn.microsoft.com/en-us/azure/search/search-security-rbac-client-code, https://learn.microsoft.com/en-us/azure/search/search-security-enable-roles
**Confidence:** `documented`

### A valid identity gets 403 only for a particular Search operation

**Observed where:** HTTP response or SDK authorization exception
**Signature:** HTTP `403` for an operation such as querying, uploading documents, or creating an index, while token acquisition succeeds.
**Discriminator:** Compare the attempted operation with effective role assignments returned by `az role assignment list --assignee <token-oid> --scope <search-service-resource-id> --include-inherited --all`. Query requires **Search Index Data Reader** or **Search Index Data Contributor**; document upload requires **Search Index Data Contributor**; object creation, indexer management, run, and reset require **Search Service Contributor**.
**Causes (ranked):** 1. Wrong built-in role for the operation. 2. Only Owner, Contributor, or Reader was assigned; these control-plane roles do not query or upload documents. 3. A custom role lacks the required `DataActions`.
**Fix:** Assign only the minimum data-plane role required. Do **not** grant Owner, Contributor, Search Service Contributor, or all three development roles merely to make a query work; production query applications normally need only **Search Index Data Reader**. Do not re-enable API keys.
**Risk class:** `permission change`
**Verify:** Retry the intended operation successfully; then verify the identity still cannot perform a higher-privilege operation. Also test an unassigned identity and confirm denial.
**Lookalikes:** RBAC disabled, wrong principal, wrong scope, and propagation delay all look similar. Effective assignments at the target scope plus enabled RBAC distinguish wrong role.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-rbac, https://learn.microsoft.com/en-us/azure/search/search-security-enable-roles
**Confidence:** `documented`

### A role is visible in IAM, but the application still gets 403 because it authenticates as another principal

**Observed where:** HTTP response, SDK exception, or local `DefaultAzureCredential` execution
**Signature:** HTTP `403` despite a seemingly correct role assignment.
**Discriminator:** Compare the request token’s `oid` with the assignment’s `principalId`. For managed identities, also compare it with the search or hosting resource’s Identity-page object ID. A mismatch confirms the role was assigned to a user, service principal, system-assigned identity, or user-assigned identity different from the actual caller.
**Causes (ranked):** 1. `DefaultAzureCredential` selected a different credential than expected. 2. Role assigned to an app registration’s application ID instead of the service principal object ID. 3. Role assigned to the system-assigned MI while code uses a user-assigned MI, or vice versa.
**Fix:** Assign the minimum role to the principal identified by the actual token, or explicitly configure the intended credential/client ID. Remove obsolete assignments after validation. Do **not** compensate by assigning the role to every identity, granting Owner, or using an API key.
**Risk class:** `permission change`
**Verify:** The intended principal succeeds; the mistakenly assigned principal and an unrelated identity remain denied.
**Lookalikes:** Wrong scope has the correct `principalId` but no effective assignment at the target; propagation has both principal and scope correct but the assignment is recent.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-rbac, https://learn.microsoft.com/en-us/azure/search/search-security-rbac-client-code, https://learn.microsoft.com/en-us/azure/search/search-how-to-managed-identities
**Confidence:** `documented`

### A role is assigned to the correct identity but the target service or index still returns 403

**Observed where:** HTTP response or SDK authorization exception
**Signature:** HTTP `403` with a valid token and correct principal.
**Discriminator:** List effective assignments at the exact target: `az role assignment list --assignee <oid> --scope <target-search-service-or-index-resource-id> --include-inherited --all`. Diagnosis is confirmed when the role exists elsewhere but not at the target service, parent resource group/subscription, or exact `/indexes/<index-name>` scope.
**Causes (ranked):** 1. Assignment targets another Search service or index. 2. Index-level assignment names the wrong index. 3. Assignment is below or in a sibling scope rather than an ancestor.
**Fix:** Move or create the minimum role at the exact service or index scope required, preferring index scope for applications restricted to one index. Do **not** broaden to subscription scope, Owner, or Contributor. Note that indexers are not constrained by per-index roles and require separate administrative controls.
**Risk class:** `permission change`
**Verify:** The identity succeeds only on the intended index/service; test a different index and an unauthorized identity to confirm both remain denied.
**Lookalikes:** Wrong principal shows a different `principalId`; propagation shows the correct assignment already listed at the correct scope; disabled data-plane RBAC is revealed by `authOptions`.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-rbac
**Confidence:** `documented`

### A newly assigned role still returns 401 or 403

**Observed where:** HTTP response, SDK exception, or portal data-plane pages
**Signature:** Continued denial immediately after a correct role assignment.
**Discriminator:** Confirm read-only that principal, role, scope, and RBAC enablement are all correct, then inspect the assignment creation time. A recent assignment with no other mismatch indicates propagation or token caching.
**Causes (ranked):** 1. Normal Search role propagation—documented as typically **five to ten minutes**. 2. Stale user token; Azure RBAC changes can take up to **10 minutes** and may require sign-out/sign-in or token refresh. 3. Managed-identity token caching; Search documents warn this can take **several hours**, and managed-identity group/role claims can be cached for around **24 hours**.
**Fix:** Wait the documented interval and refresh user credentials. For managed identities, wait several hours; group-membership changes can require up to the cache lifetime. Do **not** stack broader roles, re-enable keys, or repeatedly recreate assignments. Prefer direct assignments to a user-assigned MI when fast, predictable authorization changes are required.
**Risk class:** `config-only, reversible`
**Verify:** Retry after propagation with a fresh user token; the authorized identity succeeds and an unauthorized identity remains denied. For MI, rerun the same workload without changing privileges.
**Lookalikes:** Wrong role, principal, scope, or disabled RBAC do not become correct merely with time; inspect all four before waiting.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-enable-roles, https://learn.microsoft.com/en-us/azure/search/search-security-rbac, https://learn.microsoft.com/en-us/azure/role-based-access-control/troubleshooting, https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations
**Confidence:** `documented`

### An API-key client stops working after the service is changed to roles-only

**Observed where:** HTTP response or SDK exception
**Signature:** A data-plane request carrying only `api-key` is refused after `properties.disableLocalAuth` becomes `true`.
**Discriminator:** Read the service configuration and confirm `disableLocalAuth: true`; inspect only request header names and confirm the client sends `api-key` rather than a bearer token.
**Causes (ranked):** 1. Client was not migrated before keys were disabled. 2. A stale deployment still injects `api-key`. 3. Both credentials are supplied; when both are present, Search uses the key.
**Fix:** Replace `AzureKeyCredential`/`api-key` with an Azure Identity credential and assign the minimum data-plane role. Remove the key header entirely. Do **not** re-enable API keys as a shortcut or grant a broader role.
**Risk class:** `config-only, reversible`
**Verify:** The migrated authorized identity succeeds; the same request with only the old key and a request from an unassigned identity both fail.
**Lookalikes:** A rotated or incorrect key fails similarly when keys remain enabled. `disableLocalAuth: true` distinguishes intentional key rejection.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-enable-roles, https://learn.microsoft.com/en-us/azure/search/search-security-api-keys, https://learn.microsoft.com/en-us/azure/search/search-security-rbac-client-code
**Confidence:** `documented`

### An indexer cannot read its Azure Storage data source when managed identity authentication is configured

**Observed where:** Indexer execution history or data-source connection test
**Signature:** Generic authorization observations such as `"The remote server returned an error: (403) Forbidden"` or `"This request is not authorized to perform this operation"`.
**Discriminator:** Read the data-source JSON, search-service identity, and Storage IAM assignments. A system identity is selected when the connection string is `ResourceId=...` and no data-source `identity` exists; a user-assigned identity is selected only when `identity.@odata.type` is `#Microsoft.Azure.Search.DataUserAssignedIdentity` and `userAssignedIdentity` names an identity associated with the search service. Confirm that exact principal has **Storage Blob Data Reader** at the target account/container.
**Causes (ranked):** 1. Role assigned to the wrong system/user-assigned identity. 2. Missing least-privilege source role. 3. Role assigned at the wrong storage scope. 4. Recent role assignment has not propagated.
**Fix:** Correct the data-source identity selection or grant that exact identity **Storage Blob Data Reader** at the narrowest usable source scope. Use write roles only for features that actually write. Do **not** grant Storage Account Contributor/Owner, broaden to unrelated containers, embed an account key, or enable public access.
**Risk class:** `permission change`
**Verify:** Run the indexer successfully and confirm it reads only the intended container. Remove or test with an unassigned identity/data source and confirm denial.
**Lookalikes:** Storage firewall failures use the same generic 403 text. If identity, role, and scope are correct, inspect Storage networking before changing permissions.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-howto-managed-identities-storage, https://learn.microsoft.com/en-us/azure/search/search-how-to-managed-identities, https://learn.microsoft.com/en-us/azure/search/search-indexer-troubleshooting
**Confidence:** `documented`

### A managed-identity Storage indexer still gets 403 only when the storage firewall is enabled

**Observed where:** Indexer execution history or connection test
**Signature:** Generic `403 Forbidden` or `"This request is not authorized to perform this operation"` despite a correct Storage data role.
**Discriminator:** Read the resource regions and Storage networking settings. This diagnosis is confirmed for same-region, network-protected Storage when the data source uses a user-assigned MI, or when the system-assigned MI lacks the trusted-service exception/resource-instance rule.
**Causes (ranked):** 1. Same-region Storage cannot admit Search through a normal service-IP rule. 2. Trusted-service access requires the Search service’s **system-assigned** MI; user-assigned MI is unsupported for this path. 3. The trusted-services exception is disabled.
**Fix:** Use the Search service’s system-assigned MI, retain **Storage Blob Data Reader**, and enable only **Allow trusted Microsoft services** or a supported resource-instance rule. Do **not** select “All networks,” enable public access broadly, or increase RBAC privileges.
**Risk class:** `network change`
**Verify:** The indexer succeeds through the restricted network path; verify an unrelated identity/resource and public unauthenticated access remain blocked.
**Lookalikes:** Wrong MI or missing Storage role also returns generic 403. The same request succeeding with the firewall disabled—combined with correct role/principal checks—distinguishes the network overlap.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-howto-access-trusted-service-exception, https://learn.microsoft.com/en-us/azure/search/search-howto-managed-identities-storage, https://learn.microsoft.com/en-us/azure/search/search-indexer-troubleshooting
**Confidence:** `documented`

### A security-filter query succeeds but returns zero documents for a user who should have matches

**Observed where:** Search response
**Signature:** HTTP `200` with an empty `value` array after applying a filter such as `group_ids/any(g:search.in(g, '...'))`.
**Discriminator:** Read the index schema and outgoing filter. Confirm the security field is `Collection(Edm.String)` and `filterable: true`; then, under controlled administrative troubleshooting, compare a known-document lookup/elevated view with the filtered query and compare the stored IDs to the caller’s exact Microsoft Entra object/group IDs.
**Causes (ranked):** 1. Wrong, stale, or differently formatted identity strings. 2. Missing permission values in indexed documents. 3. Incorrect field name or `search.in` expression. 4. The application omitted one of the user’s relevant groups.
**Fix:** Correct the filter and identity resolution; if indexed permission values are wrong, update/reingest only affected documents. Keep the security field nonretrievable in normal responses. Do **not** remove the filter, use `"all"`, or broaden source permissions to make results appear.
**Risk class:** `requires reindex`
**Verify:** A known authorized identity receives the document, while a known unauthorized identity does not; also test a user with multiple groups.
**Lookalikes:** Native ACL permission filtering also silently trims results, but its schema uses `permissionFilterOption`, `permissionFilter`, and `x-ms-query-source-authorization`; ordinary security filters are only string comparisons and perform no authentication.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search, https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview
**Confidence:** `documented`

### An ACL-enabled query returns only public documents or zero documents although the application can query the index

**Observed where:** Search response
**Signature:** HTTP `200` with only public documents—or an empty `value` array—when ACL-protected documents exist.
**Discriminator:** Inspect outgoing header names and the index definition. Diagnosis is confirmed when `permissionFilterOption` is `enabled` but `x-ms-query-source-authorization` is absent or identifies the wrong end user. `Authorization` grants the calling application access to the Search index; `x-ms-query-source-authorization` supplies the user identity used for document permission checks.
**Causes (ranked):** 1. End-user token omitted. 2. App-only token reused as the user token. 3. Middle tier forwarded its inbound token instead of acquiring a Search-audience token on behalf of the user. 4. Wrong signed-in user/session.
**Fix:** Supply the actual end-user Search token in `x-ms-query-source-authorization`; a confidential middle tier should use OAuth OBO with delegated scope `https://search.azure.com/.default`. Keep the app’s own credential in `Authorization`. Do **not** disable permission filters, use an API key to bypass them, or use elevated-read in production.
**Risk class:** `config-only, reversible`
**Verify:** The authorized user receives only permitted documents; a user lacking source permission receives none. Omit the user header and confirm ACL-protected content is not returned.
**Lookalikes:** Incorrect or stale indexed ACL metadata produces the same empty result even with a correct user header. Inspect permission fields and ingestion freshness next.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-query-access-control-rbac-enforcement, https://learn.microsoft.com/en-us/rest/api/searchservice/documents/search-post?view=rest-searchservice-2026-05-01-preview, https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow
**Confidence:** `documented`

### ACL-protected results are missing or still visible after source permissions changed

**Observed where:** Search response after an ADLS, Blob, SharePoint, or custom-source permission change
**Signature:** HTTP `200`, but authorized users get zero/missing documents or revoked users continue seeing stale results.
**Discriminator:** Read the index definition and a controlled elevated result using `x-ms-enable-elevated-read: true` with **Search Index Data Contributor**. Confirm `permissionFilterOption: enabled`, fields are `filterable` with `permissionFilter` values such as `userIds`, `groupIds`, or `rbacScope`, and compare stored metadata with current source ACL/RBAC.
**Causes (ranked):** 1. Permission metadata was never ingested or contains UPN/email rather than Entra object IDs. 2. Source permission changes have not been synchronized. 3. ADLS ACL changes were not propagated through existing descendants. 4. Permission filters are disabled or the wrong preview API is used.
**Fix:** Correct permission fields and reingest affected documents. ADLS requires resync/reingestion; custom push pipelines must update affected documents; inherited SharePoint parent-scope changes require explicit permission resync/reset. Do **not** insert `"all"`, disable permission filters, broaden source ACLs, or leave elevated-read enabled in application traffic.
**Risk class:** `requires reindex`
**Verify:** Retest at least one authorized and one revoked/unauthorized user after synchronization. Confirm authorized content appears and revoked content is absent; remove the elevated-read header after diagnosis.
**Lookalikes:** Missing/wrong `x-ms-query-source-authorization` yields the same empty result. A correct user header plus stale or mismatched stored permission metadata distinguishes ingestion freshness.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-query-access-control-rbac-enforcement, https://learn.microsoft.com/en-us/azure/search/search-index-access-control-lists-and-rbac-push-api, https://learn.microsoft.com/en-us/azure/search/search-indexer-access-control-lists-and-role-based-access, https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview
**Confidence:** `documented`

## Known gaps

These failures are believed to occur in the field but could not be verified from
documentation. They are recorded rather than guessed at.
Do not synthesize an entry for them; fill them from real support data.

- Microsoft Learn does not provide stable, distinct Azure AI Search response-body strings for expired, missing, and wrong-audience tokens. Moreover, `aadAuthFailureMode` makes status-only 401-versus-403 diagnosis unsafe.
- Managed-identity and firewall failures can share generic indexer 403 messages; no documented error string uniquely distinguishes wrong identity, wrong role, wrong scope, and firewall denial.
- Search documentation says managed-identity authorization changes can take “several hours,” while general Azure RBAC documentation gives up to 10 minutes and managed-identity token caches can approach 24 hours. No single Search-specific maximum is documented for every direct role-assignment scenario.
