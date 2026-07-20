# Tool — Browser Automation (`type: browser_automation_preview`) — preview

Browser automation backed by an Azure Playwright workspace. Auth is `ProjectManagedIdentity`; the connection kind is `PlaywrightWorkspace`. For the toolbox concept, versions, and endpoint, see [toolbox.md](../toolbox.md).

> 🚦 Before creating a toolbox/connection, read [create-hosted.md → Toolbox creation boundary](../../create/create-hosted.md#toolbox-creation-boundary).

## Prerequisite

An **Azure Playwright workspace** must exist before you create the connection.

## Full flow

Steps 1–3 of [toolbox.md § The flow](../toolbox.md#the-flow):

```bash
# 0. Install the CLI extension (once)
azd extension install azure.ai.toolboxes

# 1. Create the connection
azd ai connection create my-playwright-conn \
  --kind playwright-workspace \
  --target <playwright-workspace-endpoint> \
  --auth-type project-managed-identity

# 2-3. Attach to a toolbox, then promote
azd ai toolbox connection add agent-tools my-playwright-conn
azd ai toolbox publish agent-tools <new-version>
```

## Verify & deploy

Read the endpoint, deploy, and test — see [test-endpoint.md](test-endpoint.md).

## References

- [Browser automation tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/browser-automation)
- [toolbox.md § Supported tool types](../toolbox.md#supported-tool-types)
