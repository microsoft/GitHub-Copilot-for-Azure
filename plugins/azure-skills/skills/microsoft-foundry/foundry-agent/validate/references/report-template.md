[Use this Markdown structure. Replace bracketed text using only the finalized JSON report reread from disk.]

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

[For `fail`, explain the result and cite redacted `file:line` evidence when available. For `pass`, explain the evidence that proves the check passed. For `inconclusive`, explain why evidence cannot prove pass or fail and what is missing. For `skipped`, explain why the rule does not apply.]

#### Recommended action

[For `fail` only, state the concrete action required. Otherwise omit.]

#### Guidance

[Repeat each item as a Markdown link. For an object, use its `title` and `link`. For a legacy URL string, use the unchanged URL as both label and destination.]

</details>

## Limitation

This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.
````
