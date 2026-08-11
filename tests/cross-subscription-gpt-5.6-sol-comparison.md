# Comparison Report

**Skill:** `azure-resource-lookup`  
**Model:** GPT-5.6 Sol  
**Stimulus:** `Cross-subscription_inventory_mentions_resources`

## Answers

### Which performs the task better?

**With skill performs slightly better**, although both conditions completed all five runs successfully.

- **With skill:** 5/5 returned 255 resources across 26 types and consistently used Azure Resource Graph with explicit subscription scope.
- **Without skill:** 5/5 found the resources, but one run incorrectly reported 25 types, and several used less-efficient per-subscription enumeration.

### Which uses fewer tokens?

**Without skill uses substantially fewer tokens.**

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skill | 79,185 | 852 | **80,037** |
| Without skill | 44,719 | 954 | **45,673** |

Without skill used approximately **42.9% fewer total tokens**. Even excluding cached input, it averaged about **26.8% fewer tokens**.

**Conclusion:** With skill is marginally more accurate and consistent; without skill is considerably more token-efficient.
