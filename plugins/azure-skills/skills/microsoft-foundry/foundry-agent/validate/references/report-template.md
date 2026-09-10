[Project every finalized JSON result into this structure using only the JSON report reread from disk. Do not inspect the repository, reevaluate rules, add prose, or omit results.]

````markdown
# Microsoft Foundry Agent Validation

## Summary

**Report ID:** `[report ID]`<br>
**Hosted agent:** [service name]<br>
**Agent root:** [agent root]<br>
**Generated:** [ISO date-time]

**Results:** [failed count] feedbacks · [passed count] passed · [inconclusive count] inconclusive · [not applicable count] not applicable

[Omit zero-count statuses. Omit this table when there are no failed results.]

| Level | Rule ID | Failed rule |
|---|---|---|
| [error | warning | recommendation] | `[rule ID]` | [rule title] |

[Create nonempty sections in this order: `fail` → `## Feedbacks`; `pass` → `## Passed checks`; `inconclusive` → `## Inconclusive`; `skipped` → `## Not applicable`.]

[In each section, sort levels: error, warning, recommendation. Keep rule order for ties. Repeat this collapsed block for each result.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Rationale

[Copy `rationale` from the rule.]

#### Source code

[Omit if absent. Render each array item as inline code, separated by `, `. Items use `file:line` or `file:start-end`.]

`main.py:7-9`, `infra/main.bicep:44`

#### Details

[Copy `details` from JSON exactly.]

#### Recommended action

[For `fail`, copy `recommendedAction` exactly. Otherwise omit.]

#### Guidance

[Repeat each item as a Markdown link. For an object, use its `title` and `link`. For a legacy URL string, use the unchanged URL as both label and destination.]

</details>

## Limitation

This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.
````
