# Testing the toolbox

After creating or updating a toolbox (steps 1–3 in each tool's setup guide), verify it works. Two ways: call the MCP endpoint directly, or exercise it through the deployed agent.

## 1. Call the toolbox endpoint directly

Verify the toolbox MCP endpoint end-to-end without an agent. Use `az login` for authentication, then test the MCP operations in order. For endpoint URL format and auth scope, see [toolbox.md § MCP endpoint URL format](../toolbox.md#mcp-endpoint-url-format).

**a. Get a bearer token:**

```bash
TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv)
TOOLBOX_URL="https://<account>.services.ai.azure.com/api/projects/<project>/toolboxes/<name>/mcp?api-version=v1"
```

**b. (Optional) Initialize MCP session:**

The toolbox endpoint is stateless, so this step is not required — `tools/list` and `tools/call` work without it. Run it only to confirm the handshake:

```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"debug","version":"1.0.0"}}}' \
  -D - | head -20
```

No `mcp-session-id` header is returned, and none is needed on later calls.

**c. List tools:**

```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .
```

**d. Call a tool (optional):**

```bash
curl -sS -X POST "$TOOLBOX_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<tool_name>","arguments":{"query":"test"}}}' | jq .
```

> ⚠️ **Agent-identity-authed tools won't work locally — that's expected, not a blocker.** The token above is your **user** identity, not the deployed agent's. Use section 2 to test those.

## 2. Test it through the agent

Wire the toolbox endpoint into the agent, deploy, and invoke it — this exercises the tool with the deployed agent's identity (the only way to test agent-identity-authed tools):

```bash
# 1. Read the endpoint and set the env var
azd env set TOOLBOX_ENDPOINT "$(azd ai toolbox show <toolbox-name> --output json | jq -r .endpoint)"

# 2. Reference TOOLBOX_ENDPOINT in the agent service's environmentVariables in azure.yaml, then deploy
azd deploy

# 3. Invoke the agent to confirm it sees and can call the tool
azd ai agent invoke "list the tools you have access to"
```

## References

- [toolbox.md § MCP endpoint URL format](../toolbox.md#mcp-endpoint-url-format)
- [toolbox.md § The flow](../toolbox.md#the-flow) — the create→deploy steps
