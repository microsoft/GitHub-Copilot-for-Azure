# Steps 3–5 — Download Results, Cluster Failures, Dive Into Category

## Step 3 — Download Results

`evaluation_get` returns run metadata but **not** full per-row output. Write a Python script (save to `scripts/`) to download detailed results via the OpenAI evals REST API.

### Endpoint

```text
GET {projectEndpoint}/openai/evals/{eval_id}/runs/{run_id}/output_items?api-version=2025-11-15-preview
Authorization: Bearer <token>
```

| Property | Value |
|----------|-------|
| Base URL | `{projectEndpoint}/openai/` (the `/openai/` segment is **required**) |
| Auth scope | `https://ai.azure.com/.default` (NOT `cognitiveservices`) |
| API version | `2025-11-15-preview` |
| Pagination | Response includes `has_more`, `last_id`; pass `after={last_id}` for the next page |

> ⚠️ **Common auth mistake:** Using `https://cognitiveservices.azure.com/.default` returns 401. The correct scope for Foundry project endpoints is `https://ai.azure.com/.default`.

### Authentication

```python
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://ai.azure.com/.default").token
headers = {"Authorization": f"Bearer {token}"}
```

### Pagination Loop

```python
import requests

url = f"{project_endpoint}/openai/evals/{eval_id}/runs/{run_id}/output_items"
params = {"api-version": "2025-11-15-preview"}
all_items = []

while True:
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    data = resp.json()
    all_items.extend(data.get("data", []))
    if not data.get("has_more", False):
        break
    params["after"] = data["last_id"]
```

### Data Structure

Query/response data lives in `datasource_item.query` and `datasource_item['sample.output_text']`, **not** in `sample.input`/`sample.output` (which are empty arrays). Parse `datasource_item` fields when extracting queries and responses for analysis.

> ⚠️ **LLM judge knowledge cutoff:** When evaluating agents that use real-time data sources (web search, Bing Grounding, live APIs), the LLM judge may flag factually correct but temporally recent responses as "fabricated" or "unverifiable" because the judge's training data predates the agent's live results. Check failure reasons for phrases like "cannot verify," "beyond knowledge cutoff," or "no evidence" before treating them as real failures. See Behavioral Rule 13 in `observe.md` for mitigations.

### Custom Evaluator Dual-Entry Parsing

Custom evaluators produce **two** result entries per item in the `results` array:

| Entry | `metric` field | Has score? | Has reason/label/passed? |
|-------|----------------|------------|--------------------------|
| Entry 1 | `"custom_score"` | ✅ numeric score | ❌ null |
| Entry 2 | `"{evaluator_name}"` | ❌ null | ✅ real reason, label, passed |

To get the complete picture, merge both entries:

```python
def extract_evaluator_result(item, evaluator_name):
    """Merge the dual entries for a custom evaluator into one result."""
    score_entry = None
    detail_entry = None
    for r in item.get("results", []):
        metric = r.get("metric", "")
        if metric == "custom_score":
            score_entry = r
        elif metric == evaluator_name:
            detail_entry = r
    if not detail_entry:
        return None
    return {
        "score": score_entry.get("score") if score_entry else None,
        "passed": detail_entry.get("passed"),
        "reason": detail_entry.get("reason"),
        "label": detail_entry.get("label"),
    }
```

> ⚠️ **Common mistake:** Reading only the first matching result entry for a custom evaluator gives you the score but null reason (or vice versa). Always merge both entries. Built-in evaluators do **not** have this dual-entry pattern - they produce a single entry with all fields populated.

**Evidence from actual eval run** (item 1, `behavioral_adherence`):

```jsonc
// Entry 1: has score, null reason
{"name": "behavioral_adherence", "metric": "custom_score", "score": 1, "reason": null, "passed": null}

// Entry 2: has reason, null score
{"name": "behavioral_adherence", "metric": "behavioral_adherence", "score": null,
 "reason": "The response provides outdated and fabricated information...", "passed": false}
```

### Persist Results

Save results to `.foundry/results/<environment>/<eval-id>/<run-id>.json` (use `json.dump` with `default=str` for non-serializable fields). Print summary: total items, passed, failed, errored counts.

## Step 4 — Cluster Failures by Root Cause

Analyze every row in the results. Group failures into clusters:

| Cluster | Description |
|---------|-------------|
| Incorrect / hallucinated answer | Agent gave a wrong or fabricated response |
| Incomplete answer | Agent missed key parts |
| Tool call failure | Agent failed to invoke or misused a tool |
| Safety / content violation | Flagged by safety evaluators |
| Runtime error | Agent crashed or returned an error |
| Off-topic / refusal | Agent refused or went off-topic |

Produce a prioritized action table:

| Priority | Cluster | Suggested Action |
|----------|---------|------------------|
| P0 | Runtime errors or failing `P0` test cases | Check container logs or fix blockers first |
| P1 | Incorrect answers on key flows | Optimize prompt or tool instructions |
| P2 | Incomplete answers or broader quality gaps | Optimize prompt or expand context |
| P3 | Tool call failures | Fix tool definitions or instructions |
| P4 | Safety violations | Add guardrails to instructions |

**Rule:** Prioritize runtime errors first, then sort by test-case priority (`P0` before `P1` before `P2`) and count × severity.

## Step 5 — Dive Into Category

When the user wants to inspect a specific cluster, display the individual rows: test-case ID, input query, the agent's original response, evaluator scores, and failure reason. Let the user confirm which category or test case to optimize.

## Next Steps

After clustering -> proceed to [Step 6: Optimize Prompt](optimize-deploy.md).
