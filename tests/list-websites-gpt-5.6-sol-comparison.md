# Comparison Report

**Skill:** `azure-resource-lookup`  
**Model:** GPT-5.6 Sol  
**Stimulus:** `List_websites_response_mentions_web-app-site`

## Answers

### Which performs the task better?

**With skill performs substantially better.**

- **With skill:** **5/5** runs correctly interpreted "subscription" as the active Azure subscription, queried `microsoft.web/sites` through Azure Resource Graph, and consistently listed the same 14 running web apps with resource groups and URLs. Runs that encountered all 25 App Service sites correctly excluded 11 Function Apps.
- **Without skill:** **0/5** runs completed the task. Every run treated the request as referring to unspecified local or SaaS subscription data, searched the empty workspace or session database, and then asked for clarification or claimed account access was unavailable. None attempted Azure CLI despite Azure credentials being present.

The skill supplies both the missing Azure-domain context and the correct App Service discovery route.

### Which uses fewer tokens?

**Without skill uses fewer tokens**, but only because every run stops without performing the task.

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skill | 55,321 | 1,028 | **56,350** |
| Without skill | 27,427 | 186 | **27,613** |

Without skill used approximately **51.0% fewer total tokens**. Excluding cached input, it used approximately **50.4% fewer tokens**.

This is not meaningful efficiency: the no-skill condition produces no website inventory.

**Conclusion:** With skill is the clear winner, completing all five runs accurately versus zero without skill. Without skill is cheaper only because it fails early.
