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

> ⚠️ **HARD GATE**: Call WAF MCP tools BEFORE reading local resource files. Do NOT skip this.

1. Call `mcp_azure_mcp_get_azure_bestpractices` with `resource: "general"`, `action: "all"` for baseline guidance.
2. Call `mcp_azure_mcp_wellarchitectedframework` with `service: "<name>"` for **each** core service (in parallel). Examples: `"Container Apps"`, `"Cosmos DB"`, `"App Service"`, `"Event Grid"`, `"Key Vault"`.
3. The tool returns a markdown URL. Use a sub-agent to fetch and summarize in ≤500 tokens, focusing on: additional resources needed, required properties for security/reliability, key design decisions.
4. Collect all WAF findings: missing resources, property hardening, architecture patterns.

## Step 3 — Resource Refinement (MANDATORY)

> ⚠️ Do NOT skip. Review resources against WAF findings AND the [WAF checklist](waf-checklist.md) before planning.

Walk through every concern in the [WAF cross-cutting checklist](waf-checklist.md) and add missing resources or harden properties. Document intentional omissions in `overallReasoning.tradeoffs` and `inputs.subGoals`.

## Step 4 — Load Resource Reference Files

Read [resource reference files](resources.md) for each resource to verify:

1. **Type** — Correct `Microsoft.*` resource type and API version
2. **SKU** — Available in target region, appropriate for workload
3. **Region** — Service available, data residency met
4. **Name** — CAF-compliant naming constraints
5. **Dependencies** — All prerequisites identified and ordered
6. **Properties** — Required properties per resource schema
7. **Alternatives** — At least one alternative with tradeoff documented
