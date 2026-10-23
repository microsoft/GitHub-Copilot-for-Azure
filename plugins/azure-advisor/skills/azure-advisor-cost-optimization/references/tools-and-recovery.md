# Advisor tools and recovery

Use the Azure Advisor MCP operations below. Keep the resolved scope from
`azure-advisor-cost-user-context` on every call.

| Operation | Use | Required behavior |
|---|---|---|
| `advisor_recommendation_summary` | Broad current discovery | `category=Cost`, `sub-category=IdleResources`, `group-by=recommendation-type`; no status |
| `advisor_recommendation_list` | Type expansion, artifacts, lifecycle reports, or update targeting | Always preserve scope with `category=Cost` and `sub-category=IdleResources`; use `status=New` for active candidates or the requested lifecycle status |
| `advisor_recommendation_update` | Postpone or dismiss | Only after exact resource selection and explicit confirmation; resolve and use the stable recommendation ID internally, but do not present it as a resource ID |
| `advisor_metadata_list` | Display-name fallback | Use only when a recognizable type is not resolved by the normal Advisor filters; disclose the fallback |

## Recovery

| Situation | Response |
|---|---|
| No matching groups or cost aggregate | Report no matching groups; keep monetary values `Unavailable`, not zero |
| Results are truncated | State that coverage is partial and do not claim completeness |
| Subscription or Service Group access fails | Report partial scope coverage and the failed scope; do not treat it as an empty result |
| A lifecycle update partially fails | Report each successful and failed item separately; do not present the operation as all-successful |
| A display-name fallback is used | Explain that metadata matching resolved the stable type ID, then preserve the original scope and filters |
| A required field is missing | Preserve the missing value as `Unavailable`; the only permitted conversion is MCP's explicit `dailyPotentialSavings × 30.4 × 12` annualization |

Do not replace an Advisor failure with Cost Management, billing, Resource Graph,
generic inventory, or an invented KQL query.

For active recommendation rows, the list response exposes yearly potential savings using the MCP
contract `dailyPotentialSavings × 30.4 × 12` when Advisor provides only a daily value. Render
`Yearly potential savings`; never expose the daily source field.
