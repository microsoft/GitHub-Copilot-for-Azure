# Agent Management and Errors

Part of the [deploy skill](../deploy.md).

This reference covers agent management operations, deployment error handling, non-interactive behavior, and supporting resources.

## Agent Management Operations

### Clone an Agent

Use `agent_update` with `isCloneRequest: true` and `cloneTargetAgentName` to create a copy. For prompt agents, optionally override the model with `modelName`.

### Delete an Agent

Use `agent_delete` -- automatically cleans up hosted-agent runtime resources.

### List Agents

Use `agent_get` without `agentName` to list all agents, or with `agentName` to get a specific agent's details.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Project type not detected | No known project files found | Ask user to specify project type manually |
| Docker not running | Docker Desktop not started or not installed | Start Docker Desktop, or use Cloud Build (ACR Tasks) instead |
| ACR login failed | Not authenticated to Azure | Run `az login` first, then `az acr login --name <acr-name>` |
| Build/push failed | Dockerfile errors or insufficient ACR permissions | Check Dockerfile syntax, verify Contributor or AcrPush role on registry |
| ACR build log crash | `UnicodeEncodeError` when `az acr build` streams remote logs | The remote build continues independently -- do not assume failure. Get the `<run-id>` from the earlier `az acr build` output and check status with `az acr task show-run -r <acr-name> --run-id <run-id> --query status`. |
| Agent creation failed | Invalid definition or missing required fields | Use `agent_definition_schema_get` to verify schema, check all required fields |
| Hosted agent not running after creation | Provisioning failed or the image is not usable | Verify ACR image path, check cpu/memory values, confirm ACR permissions, then inspect hosted-agent logs with the troubleshoot skill |
| Role assignment failed | The required invocation RBAC was not granted | Stop the deployment workflow and explain that hosted-agent invocation requires `Azure AI User` on the per-agent identity and project-level agent identity at the Cognitive Services account scope |
| Invocation test failed after deployment | Missing or incorrect invocation RBAC for the per-agent identity or project-level agent identity | Check whether `Azure AI User` is assigned to the per-agent identity and project-level agent identity at the Cognitive Services account scope; assign missing role assignments, then retry invocation |
| Permission denied | Insufficient Foundry project permissions | Verify Azure AI Owner or Contributor role on the project |
| Schema fetch failed | Invalid project endpoint | Verify project endpoint URL format: `https://<resource>.services.ai.azure.com/api/projects/<project>` |

## Non-Interactive / YOLO Mode

When running in non-interactive mode (e.g., `nonInteractive: true` or YOLO mode), the skill skips user confirmation prompts and uses sensible defaults:

- **Environment variables** -- Uses values resolved from `azd env get-values` and project defaults without prompting for confirmation
- **Agent name** -- Must be provided in the initial user message or derived sensibly from the project context; if missing, the skill fails with an error instead of prompting
- **Hosted agent verification** -- Automatically continues into RBAC and invocation verification without additional prompts once deployment succeeds

> **Warning:** In non-interactive mode, ensure all required values (project endpoint, agent name, ACR image) are provided upfront in the user message or available via `azd env get-values`. Missing values will cause the deployment to fail rather than prompt.

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/microsoft-foundry/foundry-samples/)
