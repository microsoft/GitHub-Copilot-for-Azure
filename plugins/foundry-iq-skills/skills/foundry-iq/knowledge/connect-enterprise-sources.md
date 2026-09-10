# Connect enterprise sources

**Domain:** Knowledge
**Reads:** workload profile — corpus and content type, entitlement model, environment and policy.

The outcome is one governed Foundry IQ knowledge base that federates multiple
sources, with caller-specific ACL trimming where entitlements differ. Use
`connect-blob` when one production Blob collection only needs a grounded session,
and `connect-sharepoint` when SharePoint is the only source. Compose
`end-user-identity` when per-user trimming is required, and
`deploy-governed-agent` and `verify-access` to finish a governed production
journey.

The knowledge base is the orchestration layer. Add each source to one knowledge
base and let it plan and merge queries. Do not build a separate retrieval stack
per source and merge results in application code unless the workload gives a
concrete reason that federation cannot meet.

Federating several sources justifies a knowledge base; it does not by itself
justify a hardened enterprise deployment. Size the deployment with
`references/architecture-choices.md`.

## 1. Detect constraints and propose

Read Azure Policy assignments, subscription tags, existing network topology,
approved regions, identity requirements, and source permissions before choosing
resources. If public access or local auth is denied, never offer serverless or a
public fallback. Ask the user only for source scopes, identities, or business
requirements that cannot be discovered. Follow
`references/defaults-and-approvals.md`.

Match the deployment to the environment already in use.
Propose Standard dedicated Azure AI Search with:

- `publicNetworkAccess: Disabled`;
- `disableLocalAuth: true`;
- `aadAuthFailureMode: http403`;
- a private endpoint and private DNS;
- customer-managed keys;
- shared private links to Storage, Fabric, and Azure OpenAI for embeddings;

when policy denies public access or local auth, the target is production or
regulated, or the sources are governed enterprise systems. Otherwise deploy the
smallest tier the workload needs and compose `operations/harden-for-production`
when it is promoted. Do not add private endpoints or customer-managed keys that
no policy, environment, or stated requirement asks for.

Show role assignments, network mutations, data movement, expected cost class,
duration, verification, and rollback, then obtain one explicit approval before
deployment.

## 2. Compose the context graph

Create one knowledge base and add only the sources the workload requires. Select
each source type and its required treatment:

| Source | Type | Required treatment |
|---|---|---|
| Approved blob container | `azureBlob` | `ingestionPermissionOptions: ["rbacScope"]` |
| SharePoint sites or libraries | `sharePoint` | Choose remote or indexed with `connect-sharepoint`; index document-level permissions and compose `end-user-identity` |
| Fabric IQ ontology | `fabricOntology` | `fabricEndpoint` set explicitly |
| Work IQ | `workIQ` | `maxRuntimeInSeconds` greater than 120 |
| Public website or documentation | `webKnowledgeSource` | Scope to the approved domains; treat as untrusted; never send private content to it, and cite it distinctly from private sources |
| Existing index | Existing index reference | Reuse through `discovery/reuse-or-provision` |
| Other current public content | Remote MCP source | Treat as untrusted and cite it distinctly |

A public web source belongs in the same knowledge base as private sources when
answers must combine them, so the knowledge base plans across both. Keep the
trust boundary visible in the answer: a citation must show whether the evidence
came from approved private content or the public web.

Pass the end-user token through retrieval so document trimming evaluates the
caller's identity rather than only the service identity. Do not copy source ACLs
into logs or relax permissions to make tests pass. When one source cannot
preserve trimming, report it instead of lowering the trimming of the whole
knowledge base.

Verify each source contributes retrievable content, then verify the posture the
deployment actually claims: private endpoint resolution, disabled public access,
CMK state, shared private-link approval, role assignments, and a successful
authorized retrieval. Diagnose a `403` by checking caller identity, managed
identity, role scope, token audience, and `aadAuthFailureMode`; do not enable
keys as remediation.

Rerunning the workflow must reuse matching resources and converge configuration.
Never duplicate knowledge sources or broaden source scopes to make retrieval pass.

## Output contract

Return discovered inputs, defaults, the deployment posture and the policy or
requirement that justifies it, Search and network postconditions, source
definitions, per-source ingestion status, ACL mode, caller-token behavior, role
assignments, authorized retrieval evidence that cites private and public sources
distinctly, and rollback.
