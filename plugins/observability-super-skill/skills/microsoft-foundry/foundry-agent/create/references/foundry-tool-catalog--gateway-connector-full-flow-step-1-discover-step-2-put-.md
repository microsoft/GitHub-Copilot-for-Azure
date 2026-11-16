# Selected guidance: Gateway connector full flow; Step 1 — Discover; Step 2 — PUT #1 (create connection); Step 3 — Per-caller consent; Step 4 — PUT #2 (register

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

## Gateway connector full flow

For Catalog tiles tagged `Custom · Preview` (Box, Pipedrive, GitHub, Salesforce, Outlook, iManage Work, PDF4me, Qdrant, Medallia, Fulcrum, monday.com, SuperMCP, IA-Connect JML, iMIS, Huddo Boards, The Events Calendar, PUG Gamified Engagement, Nitro Sign Enterprise Verified, Soft1, Elfsquad Product Configurator, MintNFT, …).

### Step 1 — Discover

From sufficient reviewed input or one approved discovered supported catalog
lookup, retain the connector metadata:

- `objectId` from `entityId` → `connectorName`
- Full `entityId` → `metadata.toolEntityId`

Obtain missing OAuth/operation metadata only through reviewed supplied inputs
or separately approved supported operations. No automatic three-call chain.

### Step 2 — PUT #1 (create connection)

Verbatim PUT body (captured from the portal's Box wizard, 2026-05-21):

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://placeholder",
    "credentials": {},
    "connectorName": "box",
    "metadata": {
      "type": "gateway_connector",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/box/version/1",
      "connectionproperties": "{\"connectorName\":\"box\"}"
    }
  }
}
```

Spelling traps (case-sensitive):

- `toolEntityId` — NOT `entityId`.
- `connectionproperties` — **lowercase**, value is a **stringified JSON object**, not a nested object. `"{\"connectorName\":\"box\"}"` is correct; `{"connectorName":"box"}` is rejected.
- `connectorName` appears at top-level under `properties` **and** inside `metadata` and inside `connectionproperties`.

`target = "https://placeholder"` is the **persisted value on PUT #1**, not a stub. There is no follow-up call that rewrites it before PUT #2. Runtime dispatch keys off `metadata.toolEntityId` + `metadata.connectionproperties.connectorName` + OAuth consent state. PUT #2 (register-actions) rewrites `target` to the real gateway URL `https://app-XX.<region>.logic.azure.com/api/connectorGateways/{envId}/mcpServerConfigs/{connectionName}/mcp`.

### Step 3 — Per-caller consent

For every distinct end-user (or service principal), call `listConsentLinks`:

```
POST .../connections/{name}/listConsentLinks?api-version=2025-04-01-preview
```

Verbatim portal body:

```json
{
  "parameters": [{
    "objectId":      "<caller AAD oid>",
    "parameterName": "token",
    "redirectUrl":   "https://ai.azure.com/nextgen/authConsentPopup",
    "tenantId":      "<caller AAD tid>"
  }]
}
```

Notes:

- Confirm the documented redirect URL for the selected public Foundry environment before consent. A redirect URL does not establish authorization or runtime tool access.
- Returns a per-user OAuth authorization URL (e.g. a `box.com/api/oauth2/authorize?...` link). User navigates → consents → gateway stores the token.
- Cross-tenant calls return `InvalidConsentLinkParameter` (`objectId` + `tenantId` must match the caller principal).

#### Consent link expiry (~1 hour)

Each `listConsentLinks` response mints a short-lived signed token (≈ 1 hour TTL based on `ExpirationTime` in the base64 payload). A `500` from the consent host when clicking the link is most often caused by an **expired or stale link**, not a server outage. Fix: call `listConsentLinks` again to get a fresh link and use it immediately. Do not reuse a link from a previous step or previous session.

#### Portal popup lifecycle (pending-true happy path)

The portal pre-opens a blank popup (`about:blank`) before calling `listConsentLinks`, then drives the flow as follows once the consent URL is in hand. Code-first callers should replicate this:

1. Register listeners on `window.postMessage` **and** `BroadcastChannel('connector-oauth-callback')` to receive completion signals.
2. Navigate the popup to the consent URL.
3. Poll `popup.closed` every 1 second to detect finish / dismiss.
4. When the popup closes, wait **500 ms** grace for any in-flight postMessage / BroadcastChannel messages.
5. If a `{ pending: true }` signal arrives (consent completed server-side but no authorization code returned to the opener):
   - Issue a **PUT** to the connection (same body as the original create PUT) to prompt the backend to finalise auth state.
   - If `overallStatus` is `Connected` in the response, done ✅.
   - Otherwise **poll `GET .../connections/{name}`** every 2 seconds, up to **15 attempts**, until `overallStatus` flips to `Connected`.
6. If **no signal** before popup close, treat as user-cancelled and surface an error.
7. **Cleanup:** remove listeners, clear polling, force-close the popup if still open.

The `{ pending: true }` path is the normal happy-path because the provider closes the popup by redirecting to `ai.azure.com/nextgen/authConsentPopup`, which has no JavaScript opener to post back to. **Don't assume consent is done just because the popup closed.** The "blank Foundry page" seen after authorising in a detached tab is this same redirect arriving without an opener — the gateway token is still stored; retry PUT #2 to confirm.

#### Runtime authorization is separate from consent

`Connected` status and a successful `tools/list` response do not prove that a
caller may invoke an action. A runtime `403` remains an authorization failure,
not a successful tool result. Retain the sanitized error and confirm supported
connector/caller permissions with the service owner; do not change identity,
grant roles or retry denial automatically. Any separately requested test call
still needs approval for its data and possible side effects.

### Step 4 — PUT #2 (register actions)

After OAuth, the portal issues a **second PUT** against the **same connection name** to register which connector operations the agent can invoke. **Without this PUT the runtime has no actions to dispatch even though `overallStatus` shows `Authenticated`.**

The body is identical to PUT #1 plus an additional `metadata.mcpserverConfigProperties` field (stringified JSON). Verbatim example for Box connection `box-5`:

```jsonc
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://placeholder",
    "credentials": {},
    "connectorName": "box",
    "metadata": {
      "type": "gateway_connector",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/box/version/1",
      "connectionproperties": "{\"connectorName\":\"box\"}",
      "mcpserverConfigProperties": "{\"description\":\"\",\"state\":\"Enabled\",\"connectors\":[{\"name\":\"box\",\"connectionName\":\"box-5\",\"displayName\":\"box\",\"description\":\"\",\"operations\":[{\"name\":\"GetFileMetadata\",\"displayName\":\"Get file metadata using id\",\"description\":\"\",\"userParameters\":[],\"agentParameters\":[{\"name\":\"id\",\"schema\":{\"type\":\"string\",\"description\":\"The unique identifier of the file in Box.\",\"x-ms-summary\":\"File Id\"}}]}]}]}"
    }
  }
}
```

Decoded `mcpserverConfigProperties` schema:

```jsonc
{
  "description": "",
  "state": "Enabled",
  "connectors": [
    {
      "name":           "<connectorName>",       // same as properties.connectorName
      "connectionName": "<this connection name>",
      "displayName":    "<connectorName>",
      "description":    "",
      "operations": [
        {
          "name":            "<OperationId>",    // operation id from apiOperations
          "displayName":     "<friendly>",
          "description":     "",
          "userParameters":  [],                   // bound at connection time (rare for Custom·Preview)
          "agentParameters": [                     // parameters the agent fills at call time
            {
              "name": "<paramName>",
              "schema": {
                "type":         "string|number|boolean",
                "description":  "...",
                "x-ms-summary": "...",
                "default":      "..."              // optional
              }
            }
          ]
        }
      ]
    }
  ]
}
```

Each operation in `operations[]` corresponds 1:1 to one `apiOperations` entry; `agentParameters[].schema` is translated from `inputsDefinition.properties` per the mapping in [Catalog APIs §3](foundry-tool-catalog--reviewed-local-inputs-catalog-metadata-examples-operati.md#3-logic-apps-apioperations--operation-catalog-gateway_connector-only).

The portal lets the user multi-select via checkboxes in the wizard's "Configure actions" page; the selection is serialized into this string. When the selection changes later, the portal **replaces `mcpserverConfigProperties` wholesale** — no merge. Your code must do the same: any time the agent-callable op list changes, re-run PUT #2 with the full new list.

### Step 5 — `overallStatus` flip semantics

Two independent conditions must BOTH be true for `overallStatus` to flip `Unauthenticated` → `Connected`:

1. **PUT #2 issued with non-empty `metadata.mcpserverConfigProperties`** (rewrites `target` to the real gateway URL; target rewrite is visible immediately on PUT #2 regardless of consent state).
2. **OAuth consent completed** (user followed the `listConsentLinks` URL and clicked Authorize). Gateway then stores the token.

Order-independent observations:

- PUT #2 before consent → `target` rewrites, status stays `Unauthenticated`.
- Consent before PUT #2 → status stays `Unauthenticated` until PUT #2 fires; PUT #2 then flips to `Connected` in the same response.

