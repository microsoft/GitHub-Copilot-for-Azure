# Best-Effort Agent Tracing Setup

Use before ordinary prompt/hosted text deployments, including redeploys. Excludes Voice and Managed Harness.

## Resolve and Preserve

Use [Common Project Context Resolution](../SKILL.md#agent-common-project-context-resolution). Align environment, project ARM ID, endpoint and agent. Nonsecret azd outputs:

| Output | Meaning |
|---|---|
| `AZURE_APPLICATION_INSIGHTS_RESOURCE_ID` | Component ARM ID |
| `AZURE_APPLICATION_INSIGHTS_APP_ID` | Query application ID |
| `AZURE_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID` | Linked workspace |
| `AZURE_APPLICATION_INSIGHTS_RESOURCE_STATUS` | Resource setup status |
| `AZURE_APPLICATION_INSIGHTS_CONNECTION_STATUS` | Connection setup status |
| `AZURE_APPLICATION_INSIGHTS_PROJECT_ID`, `AZURE_APPLICATION_INSIGHTS_CONNECTION_PROJECT_ID` | Bind statuses to the selected project |

Inspect with `project_connection_list`. Preserve equivalent AppInsights connections, including inherited/shared connections and authentication. Conflicts warn; do not overwrite or fetch credentials for discovery.

## Select the Actual Provisioning Path

- **Native azd:** requires matched projects/agents/connections builds implementing this contract. Check `azd ai project add --help` for `--monitoring` and release notes; versions alone are insufficient. Until released, only matched development builds support this. Do not install them automatically.
- In supporting builds, new-agent authoring explicitly enables project-service `monitoring.enabled`. Provision attempts monitoring separately; agent deployment attempts the connection. `ready` / `configured` with matching project bindings are setup evidence, not stored-trace evidence.
- **Starter Bicep:** `azd-ai-starter-basic` has monitoring and a connection. Inspect actual outputs/connections; do not duplicate.
- **Older tooling, custom IaC, Terraform:** do not assume automatic monitoring. Reuse an existing working connection or warn that setup is unsupported/unavailable and continue the agent workflow.

For approved native setup:

```yaml
services:
  ai-project:
    host: azure.ai.project
    monitoring:
      enabled: true
      # Optional: reuse a workspace-backed component.
      applicationInsightsResourceId: ${EXISTING_APPLICATION_INSIGHTS_RESOURCE_ID}
```

Omit the resource-ID field to request creation. `enabled: false` skips new setup; it does not delete resources or disable an existing exporter. Respect an existing opt-out.

New-project approval must cover monitoring charges and privacy. Existing-project repair requires separate approval identifying resource, connection, instrumentation and IAM writes. Preserve local-auth, network, retention, sampling and content-capture policy. Never persist plaintext connection strings in YAML, metadata, logs or new environment values; legacy values may be read without copying.

## Human Access and Hosted Instrumentation

Resolve the human/group viewer separately from ingestion/evaluation identities. Reuse inherited access. Confirm component/workspace query permission with a metadata-only query; visibility is insufficient. Missing access requires approval for minimum scoped reader access. Protected tables/content may require privileged monitoring access only when explicitly needed and approved. Contributor does not establish role-assignment authority. Query denial warns; no broad grants.

For hosted code, inspect the selected framework/scaffold's supported instrumentation and export path. A project connection does not instrument arbitrary code. Do not add a competing exporter or enable content capture merely to get evidence.

## Failure Boundary

Optional tracing failures warn with phase/remediation and preserve core deployment/invocation success. Retain partial resources. Core errors, required connection errors and cancellation still fail. Follow [Fresh Trace Verification](agent-tracing-verification.md) after the requested smoke invocation.
