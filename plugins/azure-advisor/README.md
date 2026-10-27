# Azure Advisor

Use Azure Advisor recommendations to understand optimization opportunities, identify resources affected by service retirements, and generate customer-ready remediation guidance.

This plugin includes:

- `azure-advisor` for recommendation discovery, summaries, affected resources, metadata, service retirements, and lifecycle updates.
- `azure-advisor-actionability` for one-recommendation remediation, followed by resource-specific command placeholder resolution. When Advisor returns no usable remediation, it falls back to relevant public Microsoft Learn documentation. Responses identify whether guidance comes from Advisor or Microsoft Learn and cite documentation used for the fallback.
- `azure-advisor-cost-optimization` for scope resolution, `Cost` / `IdleResources` discovery, prioritized opportunities, full retail USD savings reports, historical/lifecycle reporting, confirmed state changes, and explicitly selected remediation handoffs. Known subscription or Service Group names/IDs pass directly to the existing Advisor tools. All-accessible subscriptions are enumerated and grouped by tenant; no separate scope skill or SG-discovery tool is needed. Capped resource lists are never treated as complete totals.

Generic Cost and other Advisor categories remain on `azure-advisor`. Cost reports explicitly show
the tool-returned pricing basis and measure currency, currently Retail USD, rather than hardcoding
the label or inventing contractual figures or availability lines. Advisor findings do not prove
deletion safety, and this plugin does not add an automated pre-validation tool.

## Response parity checks

Cost/IdleResources uses the same shared response templates on every model. The existing eval
suite tags its supplied-result and selection cases with `parity=response-shape`, covering
opening discovery, unavailable pricing, selected resources, Completed details, period choices
and inline pagination. These cases do not require live Azure recommendation queries.

From `tests`, run the same cases against both model families:

```powershell
$env:VALLY_RUNNER_DISABLE_AZURE_MCP = "true"
$env:VALLY_RUNNER_EXACT_SKILL = "true"
npm run test:vally -- --plugin azure-advisor --skill azure-advisor-cost-optimization --tag parity=response-shape --model gpt-5.6-sol --runs 1 --workers 1 --threshold 1 --pass-rate 1
npm run test:vally -- --plugin azure-advisor --skill azure-advisor-cost-optimization --tag parity=response-shape --model claude-sonnet-5 --runs 1 --workers 1 --threshold 1 --pass-rate 1
```

Require both runs to pass; a shared failure is not parity success. The strict thresholds
prevent missing required fields from being averaged away. Rerun after template, model or
client changes; passing checks establish the tested structure/data contract, not identical
wording or guaranteed rendering in every app. Local runs need the supported Node runtime,
restored test dependencies and Copilot authentication; inspect executor errors separately
from model-format failures.

The period-choice and batch-proposal cases expose `ask_user` and stop at the pending question
without answering or querying Azure. The cancellation case uses an ordinary follow-up turn:

```powershell
npm run test:vally -- --plugin azure-advisor --skill azure-advisor-cost-optimization --tag area=batch-confirmation-regression --runs 1 --workers 1 --threshold 1 --pass-rate 1
```

These cases check confirmation guidance and prohibit updates; they do not verify post-confirmation
batch execution. That flow requires separate validation against dedicated test recommendations,
with approval before writes. Cases asserting individual MCP calls opt into `mcpMode: all`;
other evals retain the runner's existing mode.

## Security

> [!WARNING]
> The `azure-advisor` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Telemetry

The shared telemetry hook records skill and MCP tool usage. Set `AZURE_MCP_COLLECT_TELEMETRY=false` to opt out.

## Setup

Authenticate with Azure CLI or another Azure Identity credential supported by Azure MCP, then install the plugin from the marketplace.
