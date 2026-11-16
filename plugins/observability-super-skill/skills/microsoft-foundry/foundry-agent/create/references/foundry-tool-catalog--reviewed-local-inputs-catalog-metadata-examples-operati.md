# Selected guidance: Reviewed local inputs; Catalog metadata examples — operation gate applies; 1. Asset-gallery (Foundry's index); 2. Logic Apps **managedApis**

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../../references/execution-boundaries.md) apply to the selected action.

## Reviewed local inputs

The optional [Python helper](../../toolbox/scripts/get_catalog_inputs.py) and
PowerShell/Bash wrappers validate a bounded, sanitized local file. They perform
no catalog fetch, authentication, CLI setup, network request or output save.
Local input reading/execution still requires approval and an explicitly approved
Python 3.9+ interpreter. Do not automatically export a tool response to a file.

Use this schema only after the developer reviews the exact inputs:

```json
{
  "schema_version": 1,
  "coverage": "partial",
  "entries": [{
    "name": "example",
    "toolEntityId": "<reviewed-tool-entity-id>",
    "serverUrl": "https://example.invalid/mcp",
    "managedOAuth": true,
    "connectorName": "<reviewed-connector-name>",
    "userEntraToken": false,
    "scopes": []
  }]
}
```

`coverage` describes only the supplied scope, not the entire catalog. Limit:
1 MiB, 1-100 entries, UTF-8 JSON, no duplicate names/fields or extra
credential-bearing fields. Both auth support booleans are explicitly reviewed,
never inferred from names or portal implementation details. Managed OAuth needs
`connectorName`; user Entra token needs `audience`. `serverUrl` must be reviewed
HTTPS without credentials/fragment; only `api-version` is allowed in its query.
Supply scopes as a reviewed string list. The helper prints retained CLI fields
as JSON with `availability: unverified`. Missing/malformed/no-match input exits
nonzero without echoing raw content. Partial coverage stays explicit. A match
is not access, runtime authorization or creation approval.

If metadata is missing, obtain that specific reviewed field or a separately
approved supported lookup. Do not guess endpoints, audiences, operations or
auth modes. Missing, denied, empty, stale or partial discovery results do not
prove incompatibility or authorize another backend, sign-in or new connection.

## Catalog metadata examples — operation gate applies

The supplied examples below describe catalog identity, OAuth metadata and
operation schemas. They are not current verified public operation contracts
or mandatory reads. Discover actual exposed operations, supported schemas,
source scope and access before any approved invocation. Reuse reviewed supplied
metadata when sufficient; do not replay portal traffic as a supported API.

### 1. Asset-gallery (Foundry's index)

```
Catalog invocation: <actual discovered supported operation and endpoint>
Headers:
  Authorization: Bearer <token for https://management.azure.com>
  Content-Type: application/json
Body:
{
  "freeTextSearch": "*",
  "filters": [
    { "field": "entityContainerId", "operator": "eq",       "values": ["connectors-registry-prod-bl"] },
    { "field": "type",              "operator": "eq",       "values": ["tools"] },
    { "field": "annotations/name",  "operator": "contains", "values": ["<name>"] }
  ],
  "pageSize": 20
}
```

- Do not assume a region, response projection, registry or identifier portability.
- Retain the exact reviewed connector identifier and supported metadata. An
  identity-only response does not prove the endpoint, auth mode or input schema.

No registry enumeration or fallback backend is required. Request the smallest
missing reviewed field, or propose one actual supported bounded lookup.

### 2. Logic Apps **managedApis** — OAuth source-of-truth

```
GET https://management.azure.com/subscriptions/{sub}
    /providers/Microsoft.Web/locations/{region}/managedApis/{connectorName}
    ?api-version=2016-06-01
```

Use a reviewed connector identifier, not one inferred from a name. The supplied
response shape below is illustrative, not current access proof:

```jsonc
{
  "properties": {
    "displayName": "GitHub",
    "runtimeUrls": ["https://logic-apis-eastus.azure-apim.net/apim/github"],
    "connectionParameters": {
      "token": {
        "type": "oauthSetting",
        "oAuthSettings": {
          "identityProvider": "GitHub",
          "clientId": "faa5f56b825cbc649ae1",          // Microsoft's default OAuth-App id
          "scopes": ["repo","workflow","read:org","admin:org"],
          "redirectMode": "Direct",
          "redirectUrl": "https://logic-apis-eastus.consent.azure-apim.net/redirect"
        }
      }
    }
  }
}
```

**Raw `authorizationUrl` / `tokenUrl` are NOT in this response.** Logic Apps abstracts them via the `identityProvider` string and resolves them inside the gateway. For BYO you must map `identityProvider → endpoints` yourself. Known mappings:

| `identityProvider` | `authorizationUrl` | `tokenUrl` |
|---|---|---|
| `GitHub` | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` |
| `Google` | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` |
| `Box` | `https://account.box.com/api/oauth2/authorize` | `https://api.box.com/oauth2/token` |
| `AzureActiveDirectory` / `aad3rdPartySNI` | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |

For `identityProvider` values not in this table (`dynamicscrmonlinecertificate`, `salesforce`, `dropbox`, `oauth2generic`, …), look the provider's well-known OAuth endpoints up in its developer docs — the catalog API does not surface them.

Use the `scopes` array from this response as the default scopes list. The catalog `clientId` is Microsoft's default OAuth App; replace it with your own only when going BYO.

Derive `authType` from `connectionParameters`:

- Any parameter with `type: oauthSetting` → `authType = OAuth2`.
- Else any parameter with `type: securestring` → `authType = CustomKeys`.
- Else → `authType = None` (anonymous) or `ProjectManagedIdentity` if the connector explicitly supports MI.

### 3. Logic Apps **apiOperations** — operation catalog (`gateway_connector` only)

For `gateway_connector`, obtain reviewed supported operations and parameter
schemas for `metadata.mcpserverConfigProperties` on PUT #2. Catalog identity
alone is insufficient. Use reviewed supplied schemas or an approved supported
operation retrieval; never auto-fetch this example.

```
GET https://management.azure.com/subscriptions/{sub}
    /providers/Microsoft.Web/locations/{region}/managedApis/{connectorName}
    /apiOperations?api-version=2016-06-01
```

Returns `value[]` of operations with `name`, `properties.summary` (display name), `properties.description`, `properties.annotation.family`, and `properties.visibility` (`important` / `advanced` / `internal`). Verified 2026-05-21: Box returns 14 operations including `ListRootFolder`, `ListFolder`, `GetFileMetadata`, `GetFileContent`, `DeleteFile`, `CreateFile`, plus several `On*` triggers (not agent-callable).

For a separately approved supported operation, the supplied example requests
one schema with `$expand=properties/inputsDefinition`; reviewed supplied schemas
also suffice. Confirm the actual supported operation first:

```
GET .../managedApis/{connectorName}/apiOperations/{operationName}
    ?api-version=2016-06-01&$expand=properties/inputsDefinition
```

`properties.inputsDefinition` is a JSON-Schema-shaped object with `type:"object"`, `properties:{...}`, and `required:[...]`. Map each entry to one `agentParameters` entry:

| `inputsDefinition.properties[name]` field | → `agentParameters[].schema` field |
|---|---|
| `type` | `type` |
| `description` | `description` |
| `title` | `x-ms-summary` |
| `default` | `default` (omit if absent) |

If `inputsDefinition.properties` is empty / missing, the operation takes no arguments and `agentParameters` is `[]` (e.g. Box `ListRootFolder`).

Skip any operation whose `properties.isWebhook` or `isNotification` is `true` — these are Logic Apps triggers, not agent-callable actions.

**Picking ops from a plain-language scenario.** Match the user's words against `properties.summary` and `properties.description`, then prefer the simplest variant (fewest required parameters) and the one whose `annotation.family` aligns with the user intent. For Box "list my files", `ListRootFolder` (zero params) wins over `ListFolder` (requires `id`); if the user asks to list a specific folder, register both.

