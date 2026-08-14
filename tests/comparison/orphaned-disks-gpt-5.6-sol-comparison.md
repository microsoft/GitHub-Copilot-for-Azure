# Comparison Report

**Skill:** `azure-resource-lookup`  
**Model:** GPT-5.6 Sol  
**Stimulus:** `Orphaned_disks_response_mentions_disk`

## Answers

### Which performs the task better?

**With skill performs better**, although both conditions completed all five runs correctly.

- **With skill:** 5/5 correctly found no orphaned or unattached disks. The agent generally used a direct, subscription-scoped Azure Resource Graph query. Four runs succeeded without command errors; one corrected an overly complex KQL filter.
- **Without skill:** 5/5 reached the same correct result, but every run first attempted `az disk list` without a resource group and received an error. Recovery required Resource Manager, REST, Resource Graph, or iteration over every resource group; one run took 37 seconds for that fallback.

The skill therefore improves tool selection, consistency, and execution efficiency, even though it does not change the final answer for this dataset.

### Which uses fewer tokens?

**Without skill uses fewer tokens.**

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skill | 74,751 | 547 | **75,298** |
| Without skill | 47,445 | 781 | **48,226** |

Without skill used approximately **36.0% fewer total tokens**. Excluding cached input, it averaged approximately **45.1% fewer tokens**.

**Conclusion:** With skill performs the task better by selecting the correct subscription-wide query immediately and avoiding a consistently failing CLI command. Without skill is substantially more token-efficient, but requires more tool calls and error recovery.
