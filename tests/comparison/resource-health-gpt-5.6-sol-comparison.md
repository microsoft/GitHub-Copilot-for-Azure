# Comparison Report

**Skill:** Azure skills enabled  
**Model:** GPT-5.6 Sol  
**Stimulus:** `Resource_health_response_mentions_health-available-resource`

## Answers

### Which performs the task better?

**With skills performs slightly better operationally**, although both conditions completed all five runs correctly.

- **With skills:** **5/5** runs recognized the Azure context immediately and queried Resource Health through Azure Resource Graph. All correctly reported no degraded or unavailable resources. The runs averaged 3.8 tool calls and generally stayed focused on the requested health check.
- **Without skills:** **5/5** runs also correctly found no degraded or unavailable resources. They often spent time inspecting the empty workspace and probing Kubernetes, AWS, GCP, Docker, or local tooling before identifying Azure. The runs averaged 8.8 tool calls. Several provided useful additional detail about resources in an `Unknown` state.

Skills improve routing and tool efficiency. Without skills sometimes produces a more detailed distinction between `Unknown` and confirmed unhealthy states, but reaches the same core answer less directly.

### Which uses fewer tokens?

**Without skills uses fewer tokens.**

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skills | 97,153 | 865 | **98,018** |
| Without skills | 61,410 | 1,448 | **62,859** |

Without skills used approximately **35.9% fewer total tokens**. Excluding cached input, it used approximately **13.5% fewer tokens**.

The higher with-skills token count is largely attributable to loading the substantial `azure-diagnostics` skill context, even though that context reduces tool exploration.

**Conclusion:** Both conditions perform the task correctly in all five runs. With skills is more focused and uses less than half as many tool calls; without skills is substantially more token-efficient and sometimes provides better `Unknown`-state detail.
