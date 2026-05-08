# FAOS Optimization (Foundry Agent Optimization Service)

Automatically optimize agent instructions through an iterative RUN → EVAL → REFLECT loop. FAOS rewrites the agent's system prompt to fix quality regressions detected by evaluators.

## Scope

**Prompt agents only.** FAOS reads and rewrites agent instructions via the Foundry Agents API (`POST /agents/{name}/versions`). Hosted agents are not supported in this workflow.

## Endpoint

```
POST https://agents-optimization.westus2.hyena.infra.ai.azure.com/agents-optimization/v1.0/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.MachineLearningServices/workspaces/{ws}/optimize
```

> **Preview:** The FAOS endpoint (`westus2.hyena.infra.ai.azure.com`) is preview/canary infrastructure subject to change. When the production URL becomes available, update the base URL accordingly.
>
> **⚠️ Workspace Requirement:** The `{sub}`, `{rg}`, `{ws}` must reference a **registered** `MachineLearningServices/workspaces` resource. CognitiveServices accounts will not work (hardcoded controller route). Unregistered workspaces return 404. To find a valid workspace, run `az ml workspace list --query "[].{name:name, rg:resource_group}" -o table` and use one from your subscription.
>
> Your actual agent project goes in `foundryProjectUrl` in the request body (any region/subscription).

**Auth:** `az account get-access-token --resource https://ai.azure.com`

## Request Body

```json
{
  "agent": {
    "foundryProjectUrl": "https://<account>.services.ai.azure.com/api/projects/<project>",
    "agentName": "<agent-name>",
    "model": "<model-deployment>"
  },
  "dataset": [
    {
      "name": "test_scenario_1",
      "prompt": "Representative query that exercises the problem area",
      "criteria": [
        { "name": "task_adherence", "instruction": "Describe what correct behavior looks like" }
      ]
    }
  ],
  "evaluators": ["task_adherence"],
  "options": {
    "evalModel": "<model-deployment>",
    "budget": 3,
    "maxIterations": 2,
    "strategies": ["instruction"]
  }
}
```

**Strategies:** `instruction` (GEPA-style prompt rewrite), `skill` (failure-driven), `model` (model-swap).

## Polling

POST returns `{"operationId": "opt_xxx", "status": "pending"}`. Poll until complete:

```powershell
$token = az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
$base = "https://agents-optimization.westus2.hyena.infra.ai.azure.com/agents-optimization/v1.0/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.MachineLearningServices/workspaces/{ws}"

# Capture operationId from the initial POST response
$opId = $startResponse.operationId

do {
    Start-Sleep -Seconds 15
    $result = Invoke-RestMethod -Uri "$base/optimize/$opId" -Headers @{"Authorization"="Bearer $token"}
} while ($result.status -in @("pending", "running"))
```

## Response (completed)

```json
{
  "operationId": "opt_xxx",
  "status": "completed",
  "baseline": { "avgScore": 0.75, "passRate": 0.667, "avgTokens": 1145 },
  "best": {
    "avgScore": 0.75,
    "passRate": 1.0,
    "avgTokens": 555,
    "config": { "systemPrompt": "<optimized instructions>" }
  }
}
```

## Apply Optimized Instructions

After FAOS completes, use `agent_update` MCP tool with the optimized prompt from `best.config.systemPrompt`, or PATCH the agent directly via Foundry Agents API (`/agents/<name>?api-version=2025-05-15-preview`).

## Caveats

- FAOS may read default instructions ("You are a helpful assistant") instead of the agent's actual prompt — verify by checking `baseline` scores. If baseline doesn't match expected behavior, manually provide instructions in the request.
- Auto-versioning (`keepVersions: true`) may not create versions correctly on new Foundry agents — create versions manually after optimization.
