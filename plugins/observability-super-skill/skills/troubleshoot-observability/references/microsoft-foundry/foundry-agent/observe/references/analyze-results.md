# Steps 3–5 — Download Results, Cluster Failures, Dive Into Category

> **Local evidence-first/privacy override:** [Execution boundaries](../../../references/execution-boundaries.md)
> supersede download, install, script, persistence and next-step instructions
> below. Review supplied sanitized results directly in memory with no azd,
> Python, sign-in, `.foundry` cache or writes. For approved live review, discover
> existing read operations and keep target/run/window plus finite row/page/call
> limits. Metadata alone is not per-item output; report absent scores/rows rather
> than downloading, installing SDKs or rerunning evaluations automatically.
> Inputs, responses and evaluator reasons need separate sensitive-content
> approval. Null/missing scores stay unknown. Partial/stale data limits claims;
> clusters are observed failure patterns, not proven root causes or recovery.

## Standalone availability gate

Check availability before reading cross-skill next-action guidance below.
Use available shared guidance unchanged; never download, install or require a
missing sibling-file read. If absent, retain this local in-memory evidence
review, scope/window, budgets and uncertainty. Return one smallest supported
fix/rollback plan-review question or the smallest missing comparable evidence;
score clusters alone support neither cause nor recovery. Stops and separate
approvals remain; no automatic evaluation, reads, edits or deployment.

Before returning supplied or existing-result analysis, apply
[the result-to-next-action contract](../../../../next-actions.md).
After a supported plan is reviewed, use its implementation continuation: ask for
missing source or propose the exact minimal edit for separate approval.
Offer one smallest supported fix/rollback plan review only when operational
evidence supports it; score clusters alone do not prove cause. Otherwise name
the smallest missing evidence. Preserve stops/declines and accepted next steps;
never auto-start evaluation/optimization, edits or deployment. After an actual
approved change, offer recovery comparison with existing supplied evidence.

## Step 3 — Download Results

Run metadata may omit per-row output. Analyze what was supplied or approved for
read; if rows are unavailable, state that coverage gap. The retained SDK example
is optional for a separately approved implementation/download task, not a
baseline investigation requirement.

### Prerequisites

```text
pip install azure-ai-projects>=2.0.0 azure-identity
```

### SDK Client Setup

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

project_client = AIProjectClient(
    endpoint=project_endpoint,       # e.g. "https://<hub>.services.ai.azure.com/api/projects/<project>"
    credential=DefaultAzureCredential(),
)
# The evals API lives on the OpenAI sub-client, not on AIProjectClient directly
client = project_client.get_openai_client()
```

> ⚠️ **Common mistake:** Calling `project_client.evals` directly — the `evals` namespace is on the OpenAI client returned by `get_openai_client()`, not on `AIProjectClient` itself.

### Retrieve Run Status

```python
run = client.evals.runs.retrieve(run_id=run_id, eval_id=eval_id)
print(f"Status: {run.status}  Report: {run.report_url}")
```

### Download Per-Row Output Items

The SDK handles pagination automatically — no manual `has_more` / `after` loop required.

```python
output_items = list(client.evals.runs.output_items.list(run_id=run_id, eval_id=eval_id))
all_items = [item.model_dump() for item in output_items]
```

> 💡 **Tip:** Use `model_dump()` to convert each SDK object to a plain dict for JSON serialization.

### Data Structure

Query/response data lives in `datasource_item.query` and `datasource_item['sample.output_text']`, **not** in `sample.input`/`sample.output` (which are empty arrays). Parse `datasource_item` fields when extracting queries and responses for analysis.

> ⚠️ **LLM judge knowledge cutoff:** When evaluating agents that use real-time data sources (web search, Bing Grounding, live APIs), the LLM judge may flag factually correct but temporally recent responses as "fabricated" or "unverifiable" because the judge's training data predates the agent's live results. Check failure reasons for phrases like "cannot verify," "beyond knowledge cutoff," or "no evidence" before treating them as real failures. See Behavioral Rule 18 in `observe.md` for mitigations.

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

Default to an in-memory summary of available items, passed/failed/errored/unknown
counts and truncation. Saving to `.foundry/results/` requires explicit consent
for sanitized content, destination and overwrite. Do not expose raw responses.

> **Optional Data Viewer (host-specific prerequisite):** Only for approved,
> already-saved sanitized local artifacts, a compatible VS Code host and the
> existing Microsoft AI Toolkit extension/deep-link handler may support the
> template `vscode://ms-windows-ai-studio.windows-ai-studio/open_data_viewer?file=<file_path>&source=microsoft-foundry-skill`.
> This is illustrative inline code, not an executable hyperlink. Confirm host
> support and user intent before offering a concrete link. Do not install an
> extension, launch a handler or save artifacts as a baseline requirement.
> No Copilot CLI deep-link compatibility is claimed.

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

| Focus | Cluster | Suggested Action |
|-------|---------|------------------|
| Runtime blockers | Runtime errors or failing suites tagged `tier=smoke` | Check container logs or fix blockers first |
| Key regressions | Incorrect answers on suites tagged `purpose=regression` or `tier=smoke` | Optimize prompt or tool instructions |
| Broader quality gaps | Incomplete answers or coverage-oriented suites | Optimize prompt or expand context |
| Tooling issues | Tool call failures | Fix tool definitions or instructions |
| Safety issues | Safety violations | Add guardrails to instructions |

**Rule:** Prioritize runtime errors first, then suites tagged `tier=smoke`, then suites tagged `purpose=regression`, then broader coverage suites by count × severity.

## Step 5 — Dive Into Category

When the user wants to inspect a specific cluster, display the individual rows: evaluation-suite ID, input query, the agent's original response, evaluator scores, and failure reason. Let the user confirm which category or evaluation suite to optimize.

## Next Steps

After clustering, report observations, hypotheses and missing evidence, then stop.
[Prompt optimization](optimize-deploy.md) is a new paid/stateful task requiring
explicit scope and approval, never automatic continuation.
