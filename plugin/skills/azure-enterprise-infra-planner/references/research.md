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

> ⚠️ Do NOT skip. Review resources against WAF findings AND the [WAF checklist](waf-checklist.md) before planning.

Walk through every concern in the [WAF cross-cutting checklist](waf-checklist.md) and add missing resources or harden properties. Document intentional omissions in `overallReasoning.tradeoffs` and `inputs.subGoals`.

## Step 4 — Resource Lookup via Tools

Use MCP tools with data from the [resource catalog](resources.md) to verify each resource:

1. **Look up the resource** in [resources.md](resources.md) to get its ARM type, API version, and CAF prefix.
2. **Use a sub-agent** to call `mcp_bicep_get_az_resource_type_schema` with the ARM type and API version. Instruct the sub-agent: "Summarize the Bicep schema for {ARM type} @ {API version}: list required properties, SKU options and their constraints, child resource types. ≤500 tokens." This returns the full schema but the sub-agent distills only what's needed for planning.
3. **Use a sub-agent** to call `microsoft_docs_fetch` with the naming rules URL from [resources.md](resources.md). Instruct the sub-agent: "Extract naming rules for {service}: min/max length, allowed characters, uniqueness scope. ≤200 tokens." Fall back to `microsoft_docs_search` with `"<resource-name> naming rules"` only if the URL is missing or returns an error.
4. **Extract pairing constraints** for the resource from [constraints.md](constraints.md). Do NOT read the entire file — extract only the relevant `### {Resource Name}` section (~100-400 tokens instead of ~10K):
   ```
   grep -A 50 "^### {Resource Name}$" references/constraints.md
   ```
   Stop reading at the next `### ` heading. Replace `{Resource Name}` with the exact heading from the [Section Index](constraints.md#section-index) (e.g., `Service Bus`, `AKS Cluster`, `Virtual Network`). If grep returns no results, the resource has no pairing constraints — proceed without them.

> ⚠️ **Context window management**: Tool responses (especially Bicep schemas) can be 20-60KB, and constraints.md is ~10K tokens. Always delegate tool calls to sub-agents with specific extraction instructions and token limits, and grep for specific sections from large reference files, to avoid diluting the main planning context.

From the tool results, verify:

1. **Type** — Correct `Microsoft.*` resource type and API version
2. **SKU** — Available in target region, appropriate for workload
3. **Region** — Service available, data residency met
4. **Name** — CAF-compliant naming constraints
5. **Dependencies** — All prerequisites identified and ordered
6. **Properties** — Required properties per resource schema
7. **Alternatives** — At least one alternative with tradeoff documented
