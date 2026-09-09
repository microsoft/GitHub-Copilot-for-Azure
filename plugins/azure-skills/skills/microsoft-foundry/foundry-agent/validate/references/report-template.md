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

[Repeat nonzero statuses in order. Use labels without counts.]

## Feedbacks

[Repeat results. Sort levels: error, warning, recommendation. Keep rule order for ties.]

### [rule title]

- **Rule:** `[rule ID]`
- **Level:** [error | warning | recommendation]

#### Source code

[Omit if absent. Preserve lines. Plain text only.]

```text
[sourceCode]
```

#### Details

[details]

#### Guidance

[Repeat each item.]

- [guidance title]([guidance link])
- [View guidance]([URL])

[First form: objects. Second: strings. Number only multiple strings.]

## Limitation

This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.
````
