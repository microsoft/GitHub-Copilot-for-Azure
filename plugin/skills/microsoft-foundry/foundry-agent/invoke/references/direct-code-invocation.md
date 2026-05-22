# Direct Code Invocation

Use this workflow for agents previously deployed with direct code deployment. These calls require the same feature header as deployment:

```http
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

Use token resource `https://ai.azure.com`. Do not use a Cognitive Services token for direct-code REST calls.

```text
az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
```

The REST examples use literal placeholders so the same flow can be translated to any shell or HTTP client. Keep `?api-version=...` in the final request URL. If any direct-code REST call returns `Missing required query parameter: api-version`, fix URL construction and retry the same call before doing any other troubleshooting.

Do not block the first direct-code invoke on a full role-assignment audit. Invoke first once the target version is active; route to troubleshooting only if the session or invoke response shows a concrete failure.

## Step 1: Verify Active Version

Resolve:

- `projectEndpoint`
- `agentName`
- concrete `agentVersion` - prefer the version captured from deployment output; otherwise list/get versions and choose the active target version
- model deployment name for the OpenAI-compatible responses body

Do not use `@latest` in direct-code session creation. The direct-code session API requires a concrete version reference.

## Step 2: Create or Reuse a Concrete-Version Session

Create a session bound to the active version:

```http
POST <project-endpoint>/agents/<agent-name>/endpoint/sessions?api-version=v1
Authorization: Bearer <access-token>
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
Content-Type: application/json

{
  "version_indicator": {
    "type": "version_ref",
    "agent_version": "<active-version>"
  }
}
```

Do not send `x-ms-user-isolation-key` unless the endpoint is explicitly configured for Header isolation. The default Entra isolation path does not need this header, and adding it unnecessarily can cause server errors in preview environments.

If the call returns `424 session_not_ready`, do not immediately create another session. Capture the `agent_session_id` from the response body or from an error message like:

```text
Session '<agent_session_id>' did not become ready within the expected timeout.
```

Then poll that same session and stream logs.

## Step 3: Poll Session Status and Stream Cold-Start Logs

Poll the same session until status is `active`:

```http
GET <project-endpoint>/agents/<agent-name>/endpoint/sessions/<agent-session-id>?api-version=v1
Authorization: Bearer <access-token>
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

If readiness is slow, stream logs:

```http
GET <project-endpoint>/agents/<agent-name>/sessions/<agent-session-id>:logstream?api-version=2025-11-15-preview
Authorization: Bearer <access-token>
Accept: text/event-stream
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

Useful readiness signals include:

```text
AgentServerHost started
```

Large remote-build dependency trees can make the first session slow even when the version is already `active`. Treat early readiness timeouts as cold-start signals until logs or session status show a real failure.

Direct-code log streams are live session streams, not durable logs. If `:logstream` returns immediately with no events, the session may already have terminated; trigger another invoke, capture the new `x-agent-session-id`, and stream before it exits. If an SSE stream disconnects after several minutes, reconnect with the same session id.

## Step 4: Invoke the Declared Protocol

For direct-code `responses` protocol, `agent_session_id` goes in the JSON body. Do not pass it as an `x-agent-session-id` header.

Invoke the agent:

```http
POST <project-endpoint>/agents/<agent-name>/endpoint/protocols/openai/responses?api-version=v1
Authorization: Bearer <access-token>
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
Content-Type: application/json

{
  "model": "<model-deployment>",
  "input": "hello",
  "stream": false,
  "agent_session_id": "<agent-session-id>"
}
```

Capture these response headers when present:

```text
x-agent-session-id
x-agent-invocation-id
x-ms-request-id
```

These headers can be present on success and on 424/500 failures. Also check the body for `agent_reference.name`, `agent_reference.version`, and `agent_session_id` to verify the request reached the expected agent version.

For direct-code `invocations` protocol, call:

```text
POST {projectEndpoint}/agents/{agentName}/endpoint/protocols/invocations?api-version=v1
```

The body is agent-defined bytes/data. Inspect the agent source, README, or OpenAPI contract before invoking; do not guess a JSON schema. Capture the same `x-agent-session-id`, `x-agent-invocation-id`, and `x-ms-request-id` headers for logs and bug correlation.

## Step 5: Multi-Turn Direct-Code Conversations

Reuse the same `agent_session_id` for related turns. For the `responses` protocol, also pass the response-continuation field supported by the OpenAI-compatible response body when continuing a conversation, such as `previous_response_id` from the prior response. Do not create a fresh session for every turn.

## Step 6: Direct-Code Failure Routing

- Deployment/build failure before any session exists -> follow the deploy skill and poll the version object. Session logstream will not help yet.
- Session create or invoke returns `424 session_not_ready` with a session id -> poll the same session, stream cold-start logs, then retry invoke with the same session id.
- Invoke failure with `x-agent-session-id` -> stream runtime logs for that session.
- Invoke failure without a session id -> capture `x-ms-request-id`, response status, and the full response for service-side investigation.
- `ClientAuthenticationError: DefaultAzureCredential failed` in logstream after the hosted runtime starts -> treat as a platform Managed Identity/IMDS issue unless the app code explicitly changed credential setup; capture request/session/invocation ids.
- Runtime `PermissionDenied` after startup -> verify direct-code RBAC for both `instance_identity.principal_id` and `blueprint.principal_id`: `Foundry User` and `Cognitive Services OpenAI User` at the Cognitive Services account scope.
- After creating or confirming missing direct-code role assignments, wait once and retry the same session/invoke path once. Prefer a full 180-second wait when assignments were newly created during this deploy/invoke flow; use 60-90 seconds only when the required assignments were already present. If `PermissionDenied` persists, stop with a clear RBAC propagation/authorization finding; do not start role-definition discovery or an unbounded retry loop.
