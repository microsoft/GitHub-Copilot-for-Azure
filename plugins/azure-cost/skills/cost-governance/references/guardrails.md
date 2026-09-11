# Cost Guardrails

1. Resolve the target subscriptions when the user supplies a management group.
2. Use `generate_query`, `validate_query`, then `execute_query` to enumerate
   Azure Policy assignments. Include inherited assignments and inspect
   `enforcementMode` plus parameters for allowed SKUs and locations.
3. Report `Default` assignments as enforced. Report `DoNotEnforce` assignments
   as audit-only; do not claim they block deployment.
4. Query resource inventory for the organization's exact cost-allocation tag
   keys. Tag keys are case-sensitive, so confirm casing before reporting gaps.
5. Call `list_budgets` to identify covered and uncovered scopes.
6. Present enforced SKU or region restrictions, tag compliance gaps, and budget
   coverage with the affected scope and recommended owner action.

An empty Resource Graph result may reflect permissions or scope visibility.
State that uncertainty instead of claiming no guardrails exist.
