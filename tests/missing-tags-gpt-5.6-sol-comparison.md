# Comparison Report

**Skill:** `azure-resource-lookup`  
**Model:** GPT-5.6 Sol  
**Stimulus:** `Missing_tags_response_mentions_tag`

## Answers

### Which performs the task better?

**Without skill performs substantially better.**

- **With skill:** **1/5** runs completed the task correctly. Two runs immediately asked which tags were required, and two more incorrectly concluded that no relevant tag policy was assigned after checking only visible policy assignments. One run discovered the inherited `MSResiliencyTag` management-group policy and correctly reported 23 noncompliant resources.
- **Without skill:** **5/5** runs discovered the inherited `MSResiliencyTag` policy through policy compliance state, identified `ms-resiliency-classification` as required, and consistently reported the same 23 affected resources. Several runs also validated current resource and resource-group tags and listed the allowed values.

The skill routes the agent toward Azure Resource Graph but does not explain how to discover inherited required-tag policies. This appears to encourage clarification instead of checking Azure Policy compliance state.

### Which uses fewer tokens?

**With skill uses fewer tokens on average**, largely because four runs stopped before completing the investigation.

| Condition | Avg. input | Avg. output | Avg. total |
|---|---:|---:|---:|
| With skill | 94,430 | 1,163 | **95,593** |
| Without skill | 135,542 | 3,125 | **138,667** |

With skill used approximately **31.1% fewer total tokens**. Excluding cached input, it used approximately **30.0% fewer tokens**.

This is not a favorable efficiency result: the lower token usage mainly reflects incomplete or incorrect runs rather than a more efficient successful workflow.

**Conclusion:** Without skill clearly performs the task better, completing all five runs correctly versus one of five with skill. With skill uses fewer tokens, but primarily because most runs terminate without answering the request.
