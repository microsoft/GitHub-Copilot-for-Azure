# Phase 2: Research Resources

> The goal of this phase is to research Azure resources before generating the plan.

## Step 1 - Resource Refinement

#### Cross reference WAF

Read [WAF cross-cutting checklist](../waf-checklist.md). For every checklist item, either:
- Add missing resources / harden properties, or;
- Document the the intentional omission in `overallReasoning.tradeoffs` and `inputs.subGoals`.

## Step 2 - Resource Lookup

> Mandatory: Complete this step for every resource before generating the plan. WAF tools from Phase 1 provide architecture guidance, but do not provide ARM types, naming rules, or pairing constraints. This step fills those gaps.

For each resource identified since Phase 1:
1. Read the relevant resource reference file to get its ARM type, API version, and CAF prefix. Use [resources/README.md](../resources/README.md) as the index to help you find the right file (e.g., `resources/compute-infra.md` for AKS, `resources/data-analytics.md` for Cosmos DB).
2. Use sub-agents to fetch naming rules. You must try approach A first, only default to approach B if there are errors or the naming rules URL is missing:
  a. Instruct the sub-agent verbatim: `Extract naming rules for {service} using microsoft_docs_fetch tool: min/max length, allowed characters, uniqueness scope. ≤200 tokens.`.
  b. Instruct the sub-agent to call `microsoft_docs_search` with `"<resource-name> naming rules"`
3. Read the relevant pairing constraint file using [constraints/README.md](../constraints/README.md) as the index. Each category file is <2K tokens, you must read the whole file for all resources in that category.

> Important Tip: Only load the category files you need. For a plan with AKS + Cosmos DB + VNet + Key Vault, you'd load 4 constraint files and 4 resource files (~5.5K tokens total) instead of the full catalog (~22K tokens).

After completing the steps above, verify from the tool results:

1. Type — Correct `Microsoft.*` resource type and API version
2. SKU — Available in target region, appropriate for workload
3. Region — Service available, data residency met
4. Name — CAF-compliant naming constraints
5. Dependencies — All prerequisites identified and ordered
6. Properties — Required properties per resource schema
7. Alternatives — At least one alternative with tradeoff documented

## Gate
- Every resource has an ARM type, naming rules, and pairing constraints checked.
- Present the preliminary resource list to the user with brief justifications and wait for approval before proceeding.
