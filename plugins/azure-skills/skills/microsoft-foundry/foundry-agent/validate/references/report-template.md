[Use this Markdown structure. Replace bracketed text.]

````markdown
# Microsoft Foundry Agent Validation

## Summary

**Report ID:** `[report ID]`<br>
**Hosted agent:** [service name]<br>
**Agent root:** [agent root]<br>
**Generated:** [ISO date-time]

**Results:** [failed count] feedbacks · [passed count] passed · [inconclusive count] inconclusive · [not applicable count] not applicable

[Omit zero-count statuses.]

[Omit this table when there are no failed results.]

| Level | Rule ID | Failed rule |
|---|---|---|
| [error | warning | recommendation] | `[rule ID]` | [rule title] |

## Feedbacks

[Omit if empty. Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Render each array item on its own line. Plain text only.]

```text
[sourceCode item]
```

#### Details

[Explain the result and cite redacted `file:line` evidence when available.]

#### Recommended action

[State the concrete action required to resolve this finding.]

#### Guidance

[Repeat each item.]

- [guidance title](<[guidance link]>)

</details>

## Passed checks

[Omit if empty. Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Render each array item on its own line. Plain text only.]

```text
[sourceCode item]
```

#### Details

[Explain the result, cite redacted `file:line` evidence when available, and state how to fix failures or what evidence is missing for inconclusive results.]

#### Guidance

[Repeat each item.]

- [guidance title](<[guidance link]>)

</details>

## Inconclusive

[Omit if empty. Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Render each array item on its own line. Plain text only.]

```text
[sourceCode item]
```

#### Details

[Explain the result, cite redacted `file:line` evidence when available, and state how to fix failures or what evidence is missing for inconclusive results.]

#### Guidance

[Repeat each item.]

- [guidance title](<[guidance link]>)

</details>

## Not applicable

[Omit if empty. Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Render each array item on its own line. Plain text only.]

```text
[sourceCode item]
```

#### Details

[Explain the result, cite redacted `file:line` evidence when available, and state how to fix failures or what evidence is missing for inconclusive results.]

#### Guidance

[Repeat each item.]

- [guidance title](<[guidance link]>)

</details>

## Limitation

This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.
````
