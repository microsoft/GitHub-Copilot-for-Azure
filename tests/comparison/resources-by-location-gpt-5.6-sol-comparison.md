# Comparison Report

**Skill:** `azure-resource-lookup`  
**Model:** GPT-5.6 Sol  
**Stimulus:** `Resources_by_location_mentions_location`

## Answers

### Which performs the task better?

**With skill performs slightly better**, although both conditions consistently recover the correct location totals.

- **With skill:** **5/5** runs correctly queried both enabled subscriptions, returned the same 255-resource distribution across nine locations, and explicitly reported that `Devdiv_AzureCopilotExtension` contained no resources.
- **Without skill:** All **5/5** runs returned the correct location counts and 255-resource total. However, one run incorrectly described the result as covering one enabled subscription even though two were enabled, and some runs omitted the empty subscription from the final presentation.

The skill improves cross-subscription scope reporting and consistency, but does not materially change the resource counts for this dataset.

### Which uses fewer tokens?

**Without skill uses fewer tokens.**

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skill | 76,504 | 779 | **77,283** |
| Without skill | 45,266 | 860 | **46,126** |

Without skill used approximately **40.3% fewer total tokens**. Excluding cached input, it used approximately **31.5% fewer tokens**.

**Conclusion:** Both conditions perform the core aggregation correctly in all five runs. With skill is marginally better because it consistently accounts for both subscriptions; without skill is substantially more token-efficient.
