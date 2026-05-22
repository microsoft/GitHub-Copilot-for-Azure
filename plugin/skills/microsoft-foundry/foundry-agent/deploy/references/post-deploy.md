# Post-Deployment Tasks

Part of the [deploy skill](../deploy.md).

This reference covers how to display deployed agent details and persist deployment context for future workflows.

## Display Agent Information
Once deployment is done for either hosted or prompt agent, display the agent's details in a nicely formatted table.

Below the table you MUST also display a Playground link for direct access to the agent in Azure AI Foundry:

[Open in Playground](https://ai.azure.com/nextgen/r/{encodedSubId},{resourceGroup},,{accountName},{projectName}/build/agents/{agentName}/build?version={agentVersion})

To calculate the encodedSubId, you need to take subscription id and convert it into its 16-byte GUID, then encode it as URL-safe base64 without padding (= characters trimmed). You can use the following Python code to do this conversion:

```
python -c "import base64,uuid;print(base64.urlsafe_b64encode(uuid.UUID('<SUBSCRIPTION_ID>').bytes).rstrip(b'=').decode())"
```

## Document Deployment Context

After a successful deployment, persist the deployment context to the selected metadata file under `<agent-root>/.foundry/` so future conversations (evaluation, trace analysis, monitoring) can reuse it automatically. Local/dev flows should default to `agent-metadata.yaml`; prod or CI-targeted flows can point at `agent-metadata.prod.yaml` or another explicit sidecar file. See [Agent Metadata Contract](../../../references/agent-metadata-contract.md) for the canonical schema.

| Metadata Field | Purpose | Example |
|----------------|---------|---------|
| `environments.<env>.projectEndpoint` | Foundry project endpoint | `https://<account>.services.ai.azure.com/api/projects/<project>` |
| `environments.<env>.agentName` | Deployed agent name | `my-support-agent` |
| `environments.<env>.azureContainerRegistry` | ACR resource (hosted agents) | `myregistry.azurecr.io` |
| `environments.<env>.evaluationSuites[]` | Evaluation bundles for datasets, evaluators, tags, and thresholds | `smoke-core`, `trace-regression-suite` |
| `environments.<env>.evaluationSuites[].datasetUri` | Remote Foundry dataset URI for shared eval workflows | `azureml://datastores/.../paths/...` |

If the selected metadata file is a preferred single-environment file, update only that one environment block and leave sibling metadata files untouched. If the selected metadata file is a legacy multi-environment file, merge the selected environment instead of overwriting other environments or cached evaluation suites without confirmation. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite that environment to `evaluationSuites[]` when you persist deployment metadata.
