# Microsoft Foundry Agent Validation

| Field | Value |
|---|---|
| Hosted agent | service name |
| Agent root | hosted-agent root directory |
| Generated | ISO date-time |
| Report ID | `YYYYMMDDTHHMMSSZ` |

## Summary

Render a two-column table with one row for each status whose count is greater than zero. Omit zero-count statuses. Use this order and display mapping:

1. `fail` -> Feedbacks
2. `pass` -> Passed checks
3. `inconclusive` -> Inconclusive
4. `skipped` -> Not applicable

| Status | Count |
|---|---:|
| Feedbacks | failure count |
| Passed checks | pass count |

Create detailed status sections using the same order and display mapping as the summary. Omit a status section when its count is zero. Within each status, order results by level (`error`, `warning`, `recommendation`) while preserving original rule order for results with the same level.

Use a second-level heading containing only the display label. Do not append the count, for example:

```markdown
## Feedbacks
```

Render each result in that section as:

### Rule title

- **Rule:** `RULE-ID`
- **Level:** error / warning / recommendation

#### Source code

When `sourceCode` is present, render it as a plain-text fenced code block. Preserve every line exactly and do not turn locations into links. Omit this section when `sourceCode` is absent.

#### Details

Explain the result, cite redacted `file:line` evidence when available, and state how to fix failures or what evidence is missing for inconclusive results.

#### Guidance

Render every entry from the rule's `guidance` array as a Markdown list item. For a `{ title, link }` object, use `title` as the link text and `link` as the destination. For a URL string, use `View guidance` as the link text, adding a numeric suffix when more than one URL string needs a fallback label.

## Limitation

This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.
