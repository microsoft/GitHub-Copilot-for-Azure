# Comparison Report

**Skill:** `azure-resource-lookup` (with skill)

## Answers

| Stimulus | Claude Sonnet 4.6 | GPT-5.6 Sol | GPT-5.6 Terra |
|---|---|---|---|
| Cross-subscription inventory mentions resources | **Yes - 5/5.** Correct Resource Graph aggregation across subscriptions. | **Yes - 5/5.** Consistent totals and type breakdowns. | **Yes - 5/5.** Accurate and consistent results. |
| Cross-subscription resource inventory | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. |
| Find orphaned/unattached disks | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. |
| Orphaned disks response mentions disk | **Yes - 5/5.** Correctly found that the subscription contained no disks. | **Yes - 5/5.** Correct and consistent. | **Yes - 5/5.** Correct and consistent. |
| Find resources missing required tags | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. |
| Missing-tags response mentions tag | **Yes - 5/5.** Returned concrete tag-coverage and untagged-resource results. | **No - 1/5.** Four runs stopped after clarification or incomplete policy checks; one found the actual inherited policy and 23 noncompliant resources. | **Mostly - 3/5.** Three runs returned genuine results; two stopped after incomplete policy checks. |
| Find unhealthy/degraded resources | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. | **N/A - 0/5 completed.** Harness stopped each run on skill invocation or tool limit. |
| Resource-health response mentions health | **Yes - 5/5.** Correctly checked Azure health and provisioning state. | **Yes - 5/5.** Accurate and consistent health results. | **Yes - 5/5.** Accurate results, including transparent reporting of unknown or unsupported states. |
| List websites in subscription | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. |
| Websites response mentions web app/site | **Yes - 5/5.** Listed actual Web Apps and Function Apps with resource details. | **Yes - 5/5.** Accurate lists with transparent scoping. | **Yes - 5/5.** Accurate and consistent listings. |
| Resources by location across subscriptions | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. | **N/A - 0/5 completed.** Harness stopped each run when the skill was invoked. |
| Resources-by-location mentions location | **Yes - 5/5.** Accurate location breakdown across subscriptions. | **Yes - 5/5.** Accurate and consistent, including the empty second subscription. | **Yes - 5/5.** Accurate and consistent. |

## Overall assessment

Six stimuli allowed full task execution; the other six intentionally terminated when the skill was invoked and cannot independently establish task-completion quality.

| Model | Correct assessable runs | Assessable-run verdict | Strict completed total |
|---|---:|---|---:|
| Claude Sonnet 4.6 | **30/30 (100%)** | **Yes.** Consistently selected appropriate Azure Resource Graph and health queries and returned grounded results. | **30/60 (50%)** |
| GPT-5.6 Sol | **26/30 (86.7%)** | **Mostly.** Strong overall, but unreliable when required tags were not explicitly defined. | **26/60 (43.3%)** |
| GPT-5.6 Terra | **28/30 (93.3%)** | **Mostly.** Consistently strong except for two incomplete required-tag investigations. | **28/60 (46.7%)** |

**Conclusion:** When the harness permits completion, all three models generally do a decent job with the skill. Claude Sonnet 4.6 completed every assessable run correctly; GPT-5.6 Sol and Terra were also strong, with failures concentrated in the ambiguous required-tags task. The low strict totals across all 60 runs are caused by the harness intentionally truncating half of the with-skill trajectories, not by observed incorrect final answers.
