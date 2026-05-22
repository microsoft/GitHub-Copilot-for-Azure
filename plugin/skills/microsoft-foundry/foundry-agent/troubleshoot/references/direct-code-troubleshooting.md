# Direct Code Troubleshooting

Every direct-code REST call must include:

```http
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

Use token resource `https://ai.azure.com`. Do not use a Cognitive Services token for direct-code REST calls.

```text
az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
```

The REST examples use literal placeholders so the same flow can be translated to any shell or HTTP client. Keep `?api-version=...` in the final request URL. If any direct-code REST call returns `Missing required query parameter: api-version`, diagnose URL construction first and retry the same call before investigating version, build, session, or RBAC failures.

## Step 1: Collect Direct-Code Context

Resolve:

- `projectEndpoint`
- `agentName`
- concrete `agentVersion` if known
- `agent_session_id` if an invoke or session-create call returned one
- `x-agent-invocation-id` and `x-ms-request-id` if an invoke failed
- runtime, entry point, and dependency packaging mode if already known from the deployment

## Step 2: Check Version Status Before Looking for Logs

If the version is still creating or failed, poll the version endpoint:

```text
curl --globoff -s "<project-endpoint>/agents/<agent-name>/versions/<version>?api-version=2025-11-15-preview" -H "Authorization: Bearer <access-token>" -H "Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview"
```

Interpretation:

- `creating` -> keep polling with backoff; do not invoke yet.
- `failed` -> read and report the version error exactly. Do not try session logstream because there is no runtime session yet.
- `active` -> continue to session or invoke diagnostics.

Common version/build failures:

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Dependency resolver error | Remote build could not resolve `requirements.txt` or package dependencies | Report the exact resolver error. Do not edit, slim, pin, or remove dependencies without user approval |
| Invalid zip or missing entry point | Zip had a top-level wrapper folder or omitted required files | Recreate a flat zip. Remote-build Python needs `main.py`, `requirements.txt`, and imported local source. Remote-build .NET needs `.csproj`, source files, and appsettings. Bundled .NET needs publish output rooted directly |
| Python bundled import failure | `packages/` missing, raw `.whl` files were zipped, or Windows `.pyd`/`.dll` binaries were included | Rebuild `packages/` with target Linux wheel flags and zip extracted modules, not wheel files |
| .NET framework mismatch | `TargetFramework` does not match `code_configuration.runtime` | Match `net8.0`/`net9.0`/`net10.0` to `dotnet_8`/`dotnet_9`/`dotnet_10` |
| Zip rejected or deploy hangs while packaging | Zip is too large or includes local caches/artifacts | Keep upload zip under 250 MB and exclude local caches, `bin/`, `obj/`, `.venv/`, `.foundry/`, and Docker assets |
| `NoClustersAvailable` | Temporary platform capacity issue | Retry later or ask the user whether to redeploy elsewhere |
| Missing preview feature header | REST calls omitted `CodeAgents=V1Preview,HostedAgents=V1Preview` | Retry with the full feature header |
| 401 Unauthorized | Wrong token resource, wrong tenant, or stale token | Use token resource `https://ai.azure.com`, verify `az account show`, re-login to the project tenant, and fetch a fresh token |
| 403 `AuthorizationFailed` | Caller lacks direct-code REST permissions on the Foundry project | Grant `Azure AI User` or higher on the Foundry project to the signed-in user or service principal |
| 400 multipart parse error | Sent JSON instead of multipart, omitted the code part, or omitted `filename=` on the code part | Use multipart form upload with `metadata=@...;type=application/json` and `code=@...;type=application/zip;filename=<agent>.zip` |
| 500 `session_creation_failed` | Entry point exited non-zero before binding or entry point path does not resolve from the zip root | Pull logstream for the session if one exists; verify the entry point path and that required files are at the zip root |

## Step 3: Diagnose Session Cold Start

If session creation or invoke returned `424 session_not_ready`, capture the session id from the response and poll that same session:

```text
curl --globoff -s "<project-endpoint>/agents/<agent-name>/endpoint/sessions/<agent-session-id>?api-version=v1" -H "Authorization: Bearer <access-token>" -H "Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview"
```

Stream logs for the same session:

```text
curl --globoff -N "<project-endpoint>/agents/<agent-name>/sessions/<agent-session-id>:logstream?api-version=2025-11-15-preview" -H "Authorization: Bearer <access-token>" -H "Accept: text/event-stream" -H "Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview"
```

Do not create repeated new sessions for the same readiness timeout. A new session can start another cold sandbox and repeat the timeout.

Session log streams are not retained after the session terminates. If `:logstream` returns immediately with no events, trigger another invoke, capture the new `x-agent-session-id`, and stream before the session exits.

If an SSE logstream disconnects after several minutes, reconnect with the same session id. For quick error scanning, look for log events whose JSON has `"stream":"stderr"`.

Useful readiness signals:

```text
AgentServerHost started
```

If those appear and the session becomes `active`, retry invoke with the same `agent_session_id`.

## Step 4: Diagnose Runtime or Invoke Failures

If invoke returned `x-agent-session-id`, stream logs for that session and inspect `stderr` events. If no session id was returned, capture `x-ms-request-id`, response status, and response body for service-side investigation.

If logstream shows `ClientAuthenticationError: DefaultAzureCredential failed` after the hosted runtime starts and the user's code is using the platform-provided identity path, treat it as a likely platform Managed Identity/IMDS issue. Capture `x-ms-request-id`, `x-agent-session-id`, `x-agent-invocation-id`, and the relevant log lines for service-side investigation instead of rewriting app credentials.

Direct-code `responses` protocol requires `agent_session_id` in the request body:

```json
{
  "model": "<model-deployment>",
  "input": "hello",
  "stream": false,
  "agent_session_id": "<session>"
}
```

Do not put the session id in an `x-agent-session-id` request header.

## Step 5: Check Direct-Code RBAC

Check both identities from the agent or version response:

- `instance_identity.principal_id`
- `blueprint.principal_id`

Caller prerequisite: the signed-in user or service principal needs `Azure AI User` or higher on the Foundry project to use the direct-code REST surface. That caller role is not a substitute for the runtime identity roles below when runtime `PermissionDenied` appears.

Both hosted runtime identities need these roles at the Cognitive Services account scope:

- `Foundry User`
- `Cognitive Services OpenAI User`

Use these exact runtime roles for direct-code RBAC diagnosis. Do not use project-level `Azure AI User` as the runtime identity fix. Azure MCP or CLI lookup is fine when resolving scopes or existing assignments, but do not run a separate role-name or role-definition discovery loop when these exact roles are already listed. `Foundry User` grants broad Cognitive Services data actions, so do not spend time proving that role contains a specific `AIServices/agents/write` action.

If the roles were just assigned, wait once for a bounded propagation window and retry the same session/invoke path once. Prefer a full 180-second wait when assignments were newly created during this deployment or troubleshoot pass; use 60-90 seconds only when the required assignments were already present. If the same `PermissionDenied` persists, stop and report an active deployment with smoke invocation blocked by RBAC propagation or service-side authorization; do not keep rechecking role definitions or retry indefinitely.

If runtime logs show `PermissionDenied` for `POST /api/projects/{projectName}/openai/*` or `POST .../storage/responses`, missing `Cognitive Services OpenAI User` is a likely cause even when the version is `active`.

## Step 6: Direct-Code Specific Fix Guidance

- C# error `No .NET SDKs were found` -> redeploy with `entry_point` set to `["dotnet", "<AssemblyName>.dll"]`, not `dotnet run`.
- Python import/module errors after remote build -> compare the uploaded flat zip and `requirements.txt`; do not change dependencies without user approval.
- Server error after adding `x-ms-user-isolation-key` -> retry without that header unless Header isolation is explicitly configured.
- Invocation reaches the wrong version -> create a session with concrete `version_ref`; do not use `@latest`.
