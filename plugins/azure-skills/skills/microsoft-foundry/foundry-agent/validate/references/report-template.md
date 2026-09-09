[Use this Markdown structure. Replace bracketed text.]

````markdown
# Microsoft Foundry Agent Validation

| Field | Value |
|---|---|
| Hosted agent | [service name] |
| Agent root | [agent root] |
| Generated | [ISO date-time] |
| Report ID | `[report ID]` |

## Summary

[Keep nonzero rows only. Keep this order.]

| Status | Count |
|---|---:|
| Feedbacks | [failed count] |
| Passed checks | [passed count] |
| Inconclusive | [inconclusive count] |
| Not applicable | [not applicable count] |

## Failed rules

[Omit if empty. Include every failed result.]

| Level | Rule ID | Title |
|---|---|---|
| [error | warning | recommendation] | `[rule ID]` | [rule title] |

## Feedbacks

[Omit if empty. Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

<details>
<summary>[rule title]</summary>

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Preserve lines. Plain text only.]

```text
[sourceCode]
```

#### Details

[Explain the result, cite redacted `file:line` evidence when available, and state how to fix failures or what evidence is missing for inconclusive results.]

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

[Omit if absent. Preserve lines. Plain text only.]

```text
[sourceCode]
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

[Omit if absent. Preserve lines. Plain text only.]

```text
[sourceCode]
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

[Omit if absent. Preserve lines. Plain text only.]

```text
[sourceCode]
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
