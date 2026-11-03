# Live diagnostics fixture

The live suite uses the existing `copilot-sdk-agent-runner`, `azureFixture` tag,
and shared Azure fixture provisioner. No separate provisioning runner is needed.

The manifest uses `persistence: "temporary"` so development repetitions, experiment
arms, and candidate iterations can reuse a complete instance. Blob leases
coordinate provisioning and reuse across concurrent runs. Resource groups receive
a fixed 24-hour `DeleteAfter` tag; the existing
external cleanup process deletes expired fixtures.

## Scenarios

| Target | Deliberate fault | Evidence |
| --- | --- | --- |
| App Service | `enabled: false` | Live administrative state, not an invented code failure |
| Function App | Connection string points to the previous Insights component | Live settings compared with `ExpectedApplicationInsightsResourceId` |

Both apps share one Linux B1 plan, which incurs charges until deletion. The other
resources are one storage account, one Log Analytics workspace, and two
workspace-backed Application Insights components. No application code or telemetry
is seeded: the Functions case verifies the configured destination, **not** actual
ingestion or end-to-end application health.

Agents must leave the fixture unchanged. The prompts contain no generated
resource names or subscription IDs; the executor injects the selected resource
group and the agent discovers its targets there. Do not copy fixture source files
into the agent workspace.

## Configuration and execution

Set `AZURE_FIXTURE_COORDINATION_STORAGE_ACCOUNT` and
`AZURE_FIXTURE_COORDINATION_CONTAINER` in the `skill-improvement-evals` and
`cideploytest` GitHub environments, or as repository variables shared by both.
The container must already exist and the execution identity needs Storage Blob
Data Contributor access to it, plus permission to provision and read the fixture
resources in the selected Azure CLI subscription.

For local runs, select the test subscription and export the same two variables.
From the repository root, build with `npm run build`. Then, from `tests/`, run
the following command (identical in Bash and PowerShell) to select only this suite:

```text
npm run test:vally -- --plugin azure-skills --skill azure-diagnostics --tag area=live-diagnostics --runs 1
```

The diagnostics improvement run specification includes the live suite in both
Skill-only and Skill-plus-MCP development arms; existing held-out evaluations
remain separate. Validate its generation and judge budgets from `tests/`:

```text
npm run skill-improvement -- validate --config skill-improvement/specs/azure-diagnostics.yaml
```
