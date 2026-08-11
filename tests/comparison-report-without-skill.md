# Comparison Report

**Skill:** `azure-resource-lookup`

## Answers

| Stimulus | Claude Sonnet 4.6 | GPT-5.6 Sol | GPT-5.6 Terra |
|---|---|---|---|
| Cross-subscription inventory mentions resources | **No - 1/5.** Usually queried only the default subscription, producing inconsistent totals. | **Yes - 5/5.** Correctly enumerated both subscriptions: 255 resources, 26 types. | **No - 2/5.** Correct when attempted, but usually refused without using tools. |
| Cross-subscription resource inventory | **No - 0/5.** Never verified all subscriptions. | **Mostly - 3/5.** Correct results, but two runs exhausted the tool budget after KQL errors. | **No - 1/5.** Mostly irrelevant tool use or refusal. |
| Find orphaned/unattached disks | **No - 0/5.** Repeated invalid `az disk list` usage and never completed. | **Yes - 5/5.** Recovered using resource listing and correctly found no disks. | **Mostly - 4/5.** One unnecessary cloud-provider clarification. |
| Orphaned disks response mentions disk | **Yes - 5/5.** Extra tool budget allowed recovery. | **Yes - 5/5.** | **Yes - 5/5.** |
| Find resources missing required tags | **No - 0/5.** Never completed policy discovery. | **No - 0/5.** Investigation exceeded the tool budget. | **No - 0/5.** Refused or exceeded the budget. |
| Missing-tags response mentions tag | **No - 0/5 correct.** Produced polished answers but guessed tag requirements and reported the wrong resources. | **Yes - 5/5.** Found the inherited `MSResiliencyTag` policy and the same 23 noncompliant resources consistently. | **No - 2/5.** Correct when attempted, but usually refused. |
| Find unhealthy/degraded resources | **No - 0/5.** Misidentified the platform or inspected local machine health. | **No - 1/5.** Usually explored unrelated cloud/container tools first. | **No - 0/5.** Irrelevant exploration or incomplete execution. |
| Resource-health response mentions health | **No - 0/5.** Never tried Azure. | **Yes - 5/5.** Correctly used Azure Resource Health. | **No - 1/5.** Usually assumed credentials were unavailable. |
| List websites in subscription | **No - 0/5.** Interpreted "subscription" as billing or SaaS. | **No - 1/5.** Only one run inferred Azure and listed the 14 sites. | **No - 0/5.** Asked for account/export data instead. |
| Websites response mentions web app/site | **No - 0/5.** | **No - 0/5.** | **No - 1/5.** One run eventually found the Azure subscription context. |
| Resources by location across subscriptions | **No - 1/5.** Correct approach was usually too verbose to finish. | **Mostly - 4/5.** Efficient and accurate Resource Graph queries. | **No - 1/5.** Usually supplied commands rather than executing them. |
| Resources-by-location mentions location | **Yes - 5/5.** Extra budget allowed completion. | **Yes - 5/5.** | **No - 2/5.** Knew the query but often declined to run it. |

## Overall assessment

| Model | Correct runs | Without-skill verdict |
|---|---:|---|
| Claude Sonnet 4.6 | **12/60 (20%)** | **Not adequate.** Frequently misses Azure context, mishandles multi-subscription scope, and can return confidently incorrect tag results. |
| GPT-5.6 Sol | **39/60 (65%)** | **Decent but inconsistent.** Strongest model, particularly when the prompt explicitly implies Azure, but ambiguous wording and tight tool budgets remain significant weaknesses. |
| GPT-5.6 Terra | **19/60 (32%)** | **Not adequate.** Often refuses or asks the user to execute a query despite having working Azure access. |

**Conclusion:** Only GPT-5.6 Sol performs a generally decent job without the skill, and even it is unreliable for ambiguous prompts such as "websites in my subscription." The skill is clearly valuable for Azure-context recognition, inherited-policy discovery, multi-subscription correctness, and efficient tool selection.
