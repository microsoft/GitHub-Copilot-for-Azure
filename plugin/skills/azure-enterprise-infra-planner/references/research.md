# Research Phase

Research is sequential: identify resources → call WAF tools → refine → load resource files.

## Input Analysis

| Scenario | Action |
|----------|--------|
| **Repository** | Scan `package.json`, `requirements.txt`, `Dockerfile`, `*.csproj` for runtime/dependencies. |
| **User requirements** | Clarify workload purpose, traffic, data storage, security, budget. |
| **Multi-environment** | Ask about dev/staging/prod sizing differences. |

## Step 1 — Identify Core Resources and Sub-Goals

From the user's description, list the **core Azure services** (compute, data, networking, messaging). Also derive **sub-goals** — implicit constraints to include in `inputs.subGoals`:
- "assume all defaults" → `"Cost-optimized: consumption/serverless tiers, minimal complexity"`
- production system → `"Production-grade: zone redundancy, private networking, managed identity"`

## Step 2 — WAF Tool Calls (MANDATORY FIRST)

> ⚠️**HARD GATE**: Call WAF MCP tools BEFORE reading local resource files. Do NOT skip this.

1. Call `get_azure_bestpractices` with `resource: "general"`, `action: "all"` for baseline guidance.
2. Call `wellarchitectedframework_serviceguide_get` with `service: "<name>"` for **each** core service (in parallel). Examples: `"Container Apps"`, `"Cosmos DB"`, `"App Service"`, `"Event Grid"`, `"Key Vault"`.
3. The tool returns a markdown URL. Use a sub-agent to fetch and summarize in ≤500 tokens, focusing on: additional resources needed, required properties for security/reliability, key design decisions.
4. Collect all WAF findings: missing resources, property hardening, architecture patterns.

## Step 3 — Resource Refinement (MANDATORY)

> ⚠️ **HARD GATE**: Do NOT skip. You MUST walk through the WAF checklist and document what was added or intentionally omitted.

Walk through every concern in the [WAF cross-cutting checklist](waf-checklist.md) and add missing resources or harden properties. For each checklist item, either add the resource/property or document the intentional omission in `overallReasoning.tradeoffs` and `inputs.subGoals`. Present the refinement summary to the user before proceeding to Step 4.

## Step 4 — Resource Lookup via Tools (MANDATORY)

> ⚠️ **HARD GATE**: You MUST complete this step for every resource before generating the plan. WAF tools (Step 2) provide architecture guidance but do NOT provide ARM types, naming rules, or pairing constraints. This step fills those gaps. Read [resources.md](resources.md) **in full** — it contains ARM types, API versions, CAF prefixes, and documentation URLs you need for every resource.

For each resource identified in Steps 1-3:

1. **Look up the resource** in [resources.md](resources.md) to get its ARM type, API version, and CAF prefix. You must read the full catalog (both the resource tables and the documentation tables) to get all URLs.
2. **Use a sub-agent** to call `microsoft_docs_fetch` with the naming rules URL from [resources.md](resources.md). Instruct the sub-agent: "Extract naming rules for {service}: min/max length, allowed characters, uniqueness scope. ≤200 tokens." Fall back to `microsoft_docs_search` with `"<resource-name> naming rules"` only if the URL is missing or returns an error.
3. **Extract pairing constraints** for the resource from [constraints.md](constraints.md). Do NOT read the entire file — extract only the relevant `### {Resource Name}` section (~100-400 tokens instead of ~10K). Two valid approaches:
   - **Grep**: `grep -A 50 "^### {Resource Name}$" references/constraints.md` — stop reading at the next `### ` heading.
   - **Line-range read**: Use `Select-String` or similar to find the `### {Resource Name}` line number, then read only that section's lines.

   Replace `{Resource Name}` with the exact heading from the [Section Index](constraints.md#section-index) (e.g., `Service Bus`, `AKS Cluster`, `Virtual Network`). If no results, the resource has no pairing constraints — proceed without them.

> ⚠️ **Context window management**: constraints.md is ~10K tokens. Always extract specific sections from large reference files (via grep or line-range reads), and delegate doc fetches to sub-agents with token limits, to avoid diluting the main planning context.

From the tool results, verify:

1. **Type** — Correct `Microsoft.*` resource type and API version
2. **SKU** — Available in target region, appropriate for workload
3. **Region** — Service available, data residency met
4. **Name** — CAF-compliant naming constraints
5. **Dependencies** — All prerequisites identified and ordered
6. **Properties** — Required properties per resource schema
7. **Alternatives** — At least one alternative with tradeoff documented
