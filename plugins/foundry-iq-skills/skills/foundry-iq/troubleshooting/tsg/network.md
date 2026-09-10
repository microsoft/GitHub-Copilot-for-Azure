# Network, private connectivity, and provisioning failures

**Domain:** Troubleshooting — lookup guide

Inbound private endpoints, outbound shared private links, private DNS, firewalls, network security perimeter, quota, tier limits, and CMK.

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

- [An inbound private endpoint exists, but the indexer still cannot reach private Storage or another data source](#an-inbound-private-endpoint-exists-but-the-indexer-still-cannot-reach-private-storage-or-another-data-source)
- [A shared private link exists, but private indexer runs remain transient failures](#a-shared-private-link-exists-but-private-indexer-runs-remain-transient-failures)
- [Clients in the VNet cannot use a newly created inbound private endpoint](#clients-in-the-vnet-cannot-use-a-newly-created-inbound-private-endpoint)
- [The search hostname resolves to a public IP despite an inbound private endpoint](#the-search-hostname-resolves-to-a-public-ip-despite-an-inbound-private-endpoint)
- [A previously working client now receives 403 after search public access was restricted](#a-previously-working-client-now-receives-403-after-search-public-access-was-restricted)
- [An indexer cannot reach a target protected by an IP firewall](#an-indexer-cannot-reach-a-target-protected-by-an-ip-firewall)
- [The Azure Storage trusted-service exception is enabled, but the indexer still cannot read data](#the-azure-storage-trusted-service-exception-is-enabled-but-the-indexer-still-cannot-read-data)
- [Queries, indexers, or model calls fail immediately after NSP is switched to enforced mode](#queries-indexers-or-model-calls-fail-immediately-after-nsp-is-switched-to-enforced-mode)
- [Search service creation is blocked because the subscription-region-tier quota is exhausted](#search-service-creation-is-blocked-because-the-subscription-region-tier-quota-is-exhausted)
- [A region or pricing tier is absent, or deployment fails despite available quota](#a-region-or-pricing-tier-is-absent-or-deployment-fails-despite-available-quota)
- [Deployment fails because the Microsoft.Search resource provider is not registered](#deployment-fails-because-the-microsoftsearch-resource-provider-is-not-registered)
- [Deployment is denied by organizational policy](#deployment-is-denied-by-organizational-policy)
- [Creating objects, indexing, scaling, or changing tier fails at a service limit](#creating-objects-indexing-scaling-or-changing-tier-fails-at-a-service-limit)
- [A CMK-encrypted index becomes unusable or blocks service scaling](#a-cmk-encrypted-index-becomes-unusable-or-blocks-service-scaling)

## Evaluation design coverage

These fault identifiers are priority inputs for future real-service Vally
scenarios. Their presence here is not evidence that the diagnosis path has run.

- `PRIVATE_DNS_PENDING` — [The search hostname resolves to a public IP despite an inbound private endpoint](#the-search-hostname-resolves-to-a-public-ip-despite-an-inbound-private-endpoint)

### An inbound private endpoint exists, but the indexer still cannot reach private Storage or another data source

**Observed where:** Indexer creation or execution history
**Signature:** `"Data source credentials are invalid"` can appear during indexer creation even though the search service’s inbound private endpoint works.
**Discriminator:** Run `az search service private-endpoint-connection list -g <rg> --service-name <search>` and `az search shared-private-link-resource list -g <rg> --service-name <search>`. This diagnosis is confirmed when the first command shows an approved inbound endpoint but the second has no entry matching the data source resource ID and required `groupId`. An inbound endpoint is client-to-search; it never supplies indexer outbound connectivity.
**Causes (ranked):** 1. An inbound private endpoint was mistaken for an outbound shared private link. 2. No shared private link exists for the required subresource. 3. An unsupported target type was assumed to support shared private link.
**Fix:** Create a shared private link from Azure AI Search to the target, have the target resource owner approve its private endpoint connection, wait several minutes, and set the indexer’s `parameters.configuration.executionEnvironment` to `private`. Supported targets include Storage (`blob`, `table`, `dfs`, `file`), Cosmos DB for NoSQL (`Sql`, case-sensitive), Azure SQL (`sqlServer`), Key Vault (`vault`), and the other resource/group combinations listed in Learn, including certain preview targets. Synapse SQL and arbitrary external services aren't supported. Do not enable public network access, add `0.0.0.0/0` or another broad range, disable NSP, or delete an inbound private endpoint to “simplify” the design.
**Risk class:** `network change`
**Verify:** The shared private link reports `properties.provisioningState: "Succeeded"` and `properties.status: "Approved"`, and an indexer forced to the private environment completes successfully.
**Lookalikes:** A pending shared private link has an entry but status isn't `Approved`; an authorization failure has an approved link but the search identity lacks data-plane access; wrong Storage subresource is distinguished by a mismatched `groupId`.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-howto-access-private
**Confidence:** `documented`

### A shared private link exists, but private indexer runs remain transient failures

**Observed where:** Shared Private Access page, shared-private-link API, indexer execution history
**Signature:** Indexer history contains `transientFailure`; new indexers can fail before private-endpoint approval.
**Discriminator:** Run `az search shared-private-link-resource show -g <rg> --service-name <search> -n <spl>` and GET the indexer definition. The link is usable only when `properties.provisioningState` is `Succeeded`, `properties.status` is `Approved`, and `parameters.configuration.executionEnvironment` is `private`.
**Causes (ranked):** 1. Target owner hasn't approved the connection. 2. Indexer isn't pinned to the private environment. 3. Provisioning is still asynchronous. 4. `provisioningState` is `Incomplete`.
**Fix:** Approve the connection on the target PaaS resource and wait several minutes for status propagation. Set `executionEnvironment` to `private`. For documented `Incomplete` state, reissue the shared-private-link PUT and repeat approval. Do not enable public access, add `0.0.0.0/0` or broad ranges, disable NSP, or delete private endpoints merely to bypass the workflow.
**Risk class:** `network change`
**Verify:** Both states become `Succeeded`/`Approved`, followed by a successful indexer execution.
**Lookalikes:** Missing link produces no matching resource/group entry; target authorization failure persists after both states are healthy; shared-private-link quota exhaustion is shown by tier-limit comparison.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-howto-access-private
**Confidence:** `documented`

### Clients in the VNet cannot use a newly created inbound private endpoint

**Observed where:** Private endpoint connection state, SDK/REST connection from a VNet client
**Signature:** The connection remains `Pending`, is `Rejected`, or is `Disconnected`; data-plane traffic isn't established until it is `Approved`.
**Discriminator:** Run `az search service private-endpoint-connection list -g <rg> --service-name <search>` and inspect `privateLinkServiceConnectionState.status`. `Pending`, `Rejected`, or `Disconnected` confirms approval-state failure; `Approved` redirects diagnosis to DNS or routing.
**Causes (ranked):** 1. Manual approval wasn't completed. 2. Provider rejected the request. 3. Provider removed the connection. 4. Required provider registration is absent in a cross-subscription/tenant setup.
**Fix:** Have the search-resource owner approve a pending connection. A previously rejected connection cannot be approved; remove that denied connection and recreate it for approval. Register `Microsoft.Network` and the destination provider where required. Do not enable public access, add broad firewall ranges, disable NSP, or delete a healthy endpoint to simplify networking.
**Risk class:** `network change`
**Verify:** State is `Approved`; from the VNet, DNS resolves privately and an authenticated REST request reaches the search data plane.
**Lookalikes:** An approved endpoint with a public DNS answer is a DNS-zone problem; an approved endpoint with correct private DNS but 403 is firewall/NSP or authorization.
**Source:** https://learn.microsoft.com/en-us/azure/private-link/manage-private-endpoint
**Confidence:** `inferred`

### The search hostname resolves to a public IP despite an inbound private endpoint

**Observed where:** `nslookup` from the application host, VM, container, or on-premises client
**Signature:** `nslookup <service>.search.windows.net` returns a public address rather than `<service>.privatelink.search.windows.net` and a private address from the connected VNet.
**Discriminator:** Run the lookup from the actual failing client. Correct resolution shows the `privatelink.search.windows.net` name and an RFC1918/private IP allocated to the endpoint’s VNet. A public IP confirms the private zone isn't being used. An NXDOMAIN result suggests an incorrectly overriding private zone or broken forwarding.
**Causes (ranked):** 1. `privatelink.search.windows.net` isn't linked to the client VNet. 2. Lookup originates outside the linked VNet. 3. A peered spoke isn't linked to the shared zone. 4. Custom/on-premises DNS doesn't forward through Azure Private Resolver or an Azure DNS forwarder.
**Fix:** Link the correct private DNS zone to every client VNet, ensure the endpoint’s A record/zone group exists, and configure hybrid conditional forwarding to the recommended public zone through an Azure resolver/forwarder. Do not substitute public access, broad firewall rules, NSP removal, or private-endpoint deletion for correct DNS.
**Risk class:** `network change`
**Verify:** From every intended network, `nslookup` returns the private-link alias and the endpoint’s private VNet IP; an authenticated request then succeeds.
**Lookalikes:** Correct private resolution plus failed TCP connection indicates routing/NSG issues; correct connection plus 403 indicates network policy or authorization; public resolution from an intentionally external client is expected.
**Source:** https://learn.microsoft.com/en-us/azure/search/service-create-private-endpoint
https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns-integration
**Confidence:** `inferred`

### A previously working client now receives 403 after search public access was restricted

**Observed where:** SDK exception, REST response, portal data-plane pages
**Signature:** `403 Forbidden`; under NSP enforcement, the portal can show `"Public network access is disabled"`.
**Discriminator:** Run `az search service show -g <rg> -n <search> --query "{publicNetworkAccess:publicNetworkAccess,ipRules:networkRuleSet.ipRules}"`. Confirm that access is disabled or the caller’s current public egress IP isn't in `ipRules`. If an NSP is associated, check `NSPAccessLogs` before changing the search firewall.
**Causes (ranked):** 1. `publicNetworkAccess` was disabled while the client still used the public endpoint. 2. Client/NAT egress IP changed. 3. A narrow rule was omitted. 4. NSP enforcement overrides `publicNetworkAccess`.
**Fix:** Restore the intended private path, or add only the verified client/NAT CIDR if public selected-IP access is the approved design. Allow at least 15 minutes for search network-rule propagation. Do not enable unrestricted public access, add `0.0.0.0/0` or broad ranges, disable NSP, or delete private endpoints.
**Risk class:** `network change`
**Verify:** The approved client succeeds after propagation while a client outside the approved path remains blocked.
**Lookalikes:** Missing RBAC can also return 403; distinguish it by a network-deny log or an unlisted source IP. NSP denial is identified in `NSPAccessLogs`; DNS failure doesn't normally return HTTP 403.
**Source:** https://learn.microsoft.com/en-us/azure/search/service-configure-firewall
https://learn.microsoft.com/en-us/azure/search/search-security-network-security-perimeter
**Confidence:** `documented`

### An indexer cannot reach a target protected by an IP firewall

**Observed where:** Indexer execution history after firewall enablement
**Signature:** Runs fail only after the target resource switches to selected networks, while direct access with the same credentials can still succeed.
**Discriminator:** For Storage, run `az storage account show -g <rg> -n <storage> --query networkRuleSet`; resolve the search FQDN with `nslookup`, and compare the rules with both that search-service IP and every prefix in the regional `AzureCognitiveSearch` service tag. Missing either execution environment confirms the diagnosis.
**Causes (ranked):** 1. Search-service/private-execution IP omitted. 2. Regional `AzureCognitiveSearch` multitenant ranges omitted. 3. Service-tag ranges changed. 4. Same-region Storage was incorrectly configured with IP rules, which can't identify same-region search traffic.
**Fix:** Add only the search service IP and all current regional `AzureCognitiveSearch` prefixes. Wait five to ten minutes. For same-region Storage, use a shared private link, trusted-service exception, or resource-instance rule instead of IP rules. Never use `0.0.0.0/0`, broad ranges, unrestricted public access, NSP removal, or endpoint deletion.
**Risk class:** `network change`
**Verify:** After propagation, both routine and processing-intensive indexer runs succeed, and the target firewall remains default-deny.
**Lookalikes:** Intermittent failure with complete IP rules can be a stale service-tag list; approved shared private link plus non-private execution is distinguished through `executionEnvironment`; authorization failures persist even when the firewall logs an allowed request.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-howto-access-ip-restricted
https://learn.microsoft.com/en-us/azure/search/search-indexer-securing-resources
**Confidence:** `inferred`

### The Azure Storage trusted-service exception is enabled, but the indexer still cannot read data

**Observed where:** Import Data wizard or indexer execution history
**Signature:** The wizard doesn't advance or the indexer fails even though Storage shows “Allow trusted Microsoft services.”
**Discriminator:** Run `az storage account show -g <rg> -n <storage> --query "{defaultAction:networkRuleSet.defaultAction,bypass:networkRuleSet.bypass}"` and `az search service show -g <rg> -n <search> --query identity.principalId`. Confirm `bypass` includes `AzureServices`, a system-assigned identity exists, the data source uses managed-identity authentication, and the source is Blob or ADLS Gen2.
**Causes (ranked):** 1. Data source still uses a key/secret rather than the system identity. 2. A user-assigned identity was used. 3. Storage Blob Data Reader is missing—an authorization overlap. 4. Source is Azure Tables or Files, which this trusted connection doesn't support.
**Fix:** Use the search service’s system-assigned identity, assign the minimum Storage Blob Data Reader role, and use Blob/ADLS Gen2. Use a supported private-link or firewall design for Tables/Files. Do not enable unrestricted public access, add broad ranges, disable NSP, or delete private endpoints.
**Risk class:** `network change`
**Verify:** The Import Data wizard advances with system-assigned managed identity, and the indexer reads blobs while Storage remains selected-networks/default-deny.
**Lookalikes:** An approved shared private link uses a different network path; missing role is distinguished by allowed network logs plus authorization denial; unsupported Tables/Files is identified from the data-source type.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-indexer-howto-access-trusted-service-exception
**Confidence:** `inferred`

### Queries, indexers, or model calls fail immediately after NSP is switched to enforced mode

**Observed where:** SDK/portal, indexer history, Foundry call, `NSPAccessLogs`
**Signature:** `403` or `"Public network access is disabled"` for inbound traffic; indexers or skills fail after enforcement.
**Discriminator:** Query `NSPAccessLogs` for the search resource ID. `NspPublicInboundPerimeterRulesDenied` confirms an inbound rule gap; outbound denial or absence of an expected allowed event indicates a missing outbound FQDN rule. Also list the search service’s NSP configuration and verify association mode is `Enforced`.
**Causes (ranked):** 1. Client IP/subscription isn't in an inbound rule. 2. Outbound target is outside the perimeter with no FQDN rule. 3. API-key authentication prevents implicit intra-perimeter identification. 4. Indexer data source isn't one of Blob, Cosmos DB for NoSQL, or Azure SQL supported intra-perimeter.
**Fix:** Add the narrow inbound source or exact outbound FQDN rule; alternatively place both resources in the same perimeter and use managed identity where supported. Use learning mode while validating if necessary, then re-enable enforcement. Do not disable/delete the NSP, enable unrestricted public access, add broad CIDRs, or delete private endpoints.
**Risk class:** `network change`
**Verify:** The request succeeds in enforced mode and appears in the matching `NspPublicInboundPerimeterRulesAllowed` or `NspPublicOutboundPerimeterRulesAllowed` category. Allow about ten minutes for diagnostic-log delivery.
**Lookalikes:** Search firewall denial has no matching NSP denied event; missing RBAC produces authorization failure after the NSP logs an allowed path; shared-private-link failure is identified by its own approval/provisioning state.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-network-security-perimeter
**Confidence:** `documented`

### Search service creation is blocked because the subscription-region-tier quota is exhausted

**Observed where:** Deployment operation or Azure portal creation workflow
**Signature:** Service creation is rejected while the Search quota usage for that tier and region equals its limit.
**Discriminator:** Open **Azure portal → Quotas → Search**, filter by subscription, region, and tier, and compare usage with limit. Equality confirms quota exhaustion. Available quota rules it out and points to regional capacity, policy, or provider registration.
**Causes (ranked):** 1. Maximum services for the tier and region reached. 2. The one-Free-service subscription limit reached. 3. Requested quota adjustment hasn't completed.
**Fix:** Submit **Request adjustment** for that exact tier and region or remove an intentionally retired service. Most requests complete within 24 hours; failed automatic requests create an incident, and very large increases can take about a month. This is a quota action, not a networking problem: don't enable public access, add broad firewall rules, disable NSP, or delete private endpoints.
**Risk class:** `config-only, reversible`
**Verify:** Quotas shows a higher limit and a new deployment reaches `provisioningState: Succeeded`.
**Lookalikes:** Regional capacity fails despite unused quota; SKU unavailability is shown by the region/tier matrix; policy and provider failures have explicit error codes.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-create-service-portal
https://learn.microsoft.com/en-us/azure/search/search-limits-quotas-capacity
**Confidence:** `inferred`

### A region or pricing tier is absent, or deployment fails despite available quota

**Observed where:** Region/tier selector, create/scale/upgrade deployment
**Signature:** The portal hides the unavailable region-tier combination, or provisioning fails while subscription quota remains available.
**Discriminator:** First confirm unused quota in **Quotas → Search**. Then check the current Azure AI Search regional-support footnotes and tier availability. A documented constrained region indicates capacity; a tier never offered in that region indicates SKU unavailability.
**Causes (ranked):** 1. Temporary regional capacity constraint. 2. Requested SKU isn't offered in the region. 3. Target tier is constrained for scaling/upgrading. 4. A feature-dependent SKU/region combination is unsupported.
**Fix:** Prefer an approved alternative region that satisfies residency, model, feature, and latency requirements; temporary capacity can be retried during off-peak UTC hours, but success isn't guaranteed. Persistent capacity failures require Azure support; requesting more quota doesn't create regional capacity. Don't alter public access, add broad firewall ranges, disable NSP, or delete endpoints.
**Risk class:** `config-only, reversible`
**Verify:** Deployment in the selected supported region reaches `Succeeded`, or a later retry succeeds without changing network security.
**Lookalikes:** Quota exhaustion has usage equal to limit; policy denial includes `RequestDisallowedByPolicy`; unregistered provider includes `MissingSubscriptionRegistration` or `NoRegisteredProviderFound`.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-region-capacity
https://learn.microsoft.com/en-us/azure/search/search-region-support
https://learn.microsoft.com/en-us/azure/search/search-sku-tier
**Confidence:** `inferred`

### Deployment fails because the Microsoft.Search resource provider is not registered

**Observed where:** ARM/Bicep, CLI, PowerShell, or portal deployment operation
**Signature:** `"Code: MissingSubscriptionRegistration"` with `"The subscription is not registered to use namespace {resource-provider-namespace}"`, or `"Code: NoRegisteredProviderFound"`.
**Discriminator:** Run `az provider show --namespace Microsoft.Search --query registrationState -o tsv`. `NotRegistered` confirms the diagnosis. If it is `Registered`, inspect the reported API version and location instead.
**Causes (ranked):** 1. `Microsoft.Search` hasn't been registered. 2. A supporting provider such as `Microsoft.Network` isn't registered. 3. Unsupported API version or location is reported under `NoRegisteredProviderFound`.
**Fix:** Register only the named provider, for example `az provider register --namespace Microsoft.Search`, and wait until its state is `Registered`; otherwise use a documented API version/location. Don't change public access, add broad rules, disable NSP, or remove private endpoints.
**Risk class:** `permission change`
**Verify:** Provider state is `Registered` and the same deployment passes provider validation.
**Lookalikes:** Policy denial names a policy assignment; region capacity occurs with registered providers; authorization failure names an action the caller isn't permitted to perform.
**Source:** https://learn.microsoft.com/en-us/azure/azure-resource-manager/troubleshooting/error-register-resource-provider
**Confidence:** `documented`

### Deployment is denied by organizational policy

**Observed where:** Deployment operation, activity log, ARM/Bicep output
**Signature:** `"RequestDisallowedByPolicy"` and `"Resource ... was disallowed by policy"` with `policyAssignment` and `policyDefinition` identifiers.
**Discriminator:** Read the failed operation’s `statusMessage`, then run `az policy assignment show --name <assignment> --scope <scope>` and `az policy definition show --name <definition>`. The deny rule matching the attempted Search property, location, tier, or networking setting confirms the diagnosis.
**Causes (ranked):** 1. Required private/public-network setting isn't compliant. 2. Location or SKU isn't allowed. 3. CMK enforcement is required. 4. Resource type or deployment property is denied.
**Fix:** Change the deployment to comply, or request a narrowly scoped policy exemption through governance. Never evade policy by enabling public access, adding broad firewall rules, disabling NSP, or deleting private endpoints.
**Risk class:** `permission change`
**Verify:** Policy evaluation passes and deployment reaches `Succeeded` with the required security properties intact.
**Lookalikes:** Provider registration errors don't name policy IDs; quota/capacity failures aren't resolved by policy inspection; CMK runtime failure occurs after deployment rather than as `RequestDisallowedByPolicy`.
**Source:** https://learn.microsoft.com/en-us/azure/azure-resource-manager/troubleshooting/error-policy-requestdisallowedbypolicy
https://learn.microsoft.com/en-us/azure/search/search-security-manage-encryption-keys
**Confidence:** `documented`

### Creating objects, indexing, scaling, or changing tier fails at a service limit

**Observed where:** Data-plane object creation, indexer history, scale/tier operation
**Signature:** `"Failed to scale search service servicename. Error: Object count ActualCount exceeds allowable limit: MaximumCount."` Storage or vector indexing also stops when its hard quota is reached.
**Discriminator:** Call `GET https://<service>.search.windows.net/servicestats?api-version=2025-09-01`. Compare each `counters.<type>.usage` with `.quota`, especially `indexesCount`, `indexersCount`, `dataSourcesCount`, `skillsetCount`, `storageSize`, and `vectorIndexSize`; compare replicas/partitions and creation date with the tier table. Equality confirms limit exhaustion.
**Causes (ranked):** 1. Index/indexer/data-source/skillset count reached. 2. Partition storage exhausted. 3. Vector quota exhausted. 4. Requested replica-partition combination exceeds the tier’s SU or topology limit.
**Fix:** Add partitions for storage/vector capacity where supported, select a compatible higher tier, or remove only confirmed-unused objects. Wait for an in-progress scale operation to reach `Succeeded` or `Failed`; scaling can take minutes to several hours. Do not treat this as networking: don't enable public access, add broad ranges, disable NSP, or delete endpoints.
**Risk class:** `config-only, reversible`
**Verify:** Service statistics show headroom, the service returns to `Succeeded`/`Running`, and the previously rejected operation succeeds.
**Lookalikes:** Subscription quota blocks service creation rather than object creation; regional capacity rejects scale despite service-level headroom; invalid CMK can stall scaling even below all limits.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-limits-quotas-capacity
https://learn.microsoft.com/en-us/azure/search/search-capacity-planning
https://learn.microsoft.com/en-us/rest/api/searchservice/get-service-statistics/get-service-statistics?view=rest-searchservice-2025-09-01
**Confidence:** `documented`

### A CMK-encrypted index becomes unusable or blocks service scaling

**Observed where:** Query response, object update, scale operation, Key Vault logs
**Signature:** `"Access forbidden. The query key used might have been revoked - please retry."` An unusable CMK index can also block capacity changes.
**Discriminator:** GET the object definition and inspect `encryptionKey.keyVaultUri`, `keyVaultKeyName`, and `keyVaultKeyVersion`; then read that exact Key Vault key version and its enabled/deleted state. Confirm the search managed identity has **Key Vault Crypto Service Encryption User** and inspect Key Vault firewall/trusted-service or shared-private-link configuration.
**Causes (ranked):** 1. Referenced key/version was disabled, deleted, or rotated before the object was updated. 2. Search identity lost key permissions. 3. Key Vault firewall blocks Search and no trusted-service bypass/shared private link exists. 4. Key URI, name, version, or identity is wrong.
**Fix:** Restore the exact previous key version or access first; then rotate by updating the object before retiring the old key. Restore the minimum Key Vault role and use trusted-service bypass or an approved `vault` shared private link where required. Keep the previous identity, vault, and key available until propagation completes; cached keys can delay effects for up to 60 minutes. Do not enable general public access, add broad ranges, disable NSP, or delete private endpoints.
**Risk class:** `permission change`
**Verify:** The object GET references an enabled, reachable key; Key Vault audit logs show successful key operations; queries and scaling succeed after cache/permission propagation.
**Lookalikes:** A firewall-generated 403 has network-deny evidence and affects non-CMK operations too; a revoked query API key isn't accompanied by failed Key Vault access; tier exhaustion is shown by service-statistics counters at quota.
**Source:** https://learn.microsoft.com/en-us/azure/search/search-security-manage-encryption-keys
https://learn.microsoft.com/en-us/azure/search/search-security-get-encryption-keys
**Confidence:** `documented`

## Known gaps

These failures are believed to occur in the field but could not be verified from
documentation. They are recorded rather than guessed at.
Do not synthesize an entry for them; fill them from real support data.

- Microsoft Learn doesn't document a stable, Search-specific error string that cleanly distinguishes regional capacity from SKU unavailability; use quota state plus the current region/tier matrices.
- No authoritative Search-specific error string was found for every target-resource firewall denial or trusted-service misconfiguration.
- Exact propagation time for inbound private-endpoint approval and private DNS changes isn't consistently specified; only shared-private-link, firewall, NSP-log, scaling, role, and CMK delays are documented.
