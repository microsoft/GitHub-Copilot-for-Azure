# Report Template

Use this structure. Replace instructional placeholders; do not leave empty sections. Account for every loaded rule exactly once and reconcile all totals.

# Microsoft Foundry Agent Best-Practice Review

> **Release recommendation:** one sentence stating `DO NOT RELEASE`, `REMEDIATE BEFORE RELEASE`, `NEEDS VALIDATION`, or `READY FROM REPOSITORY EVIDENCE`, followed by the reason.

| Review context | Value |
|---|---|
| Repository | path/name |
| Review date | ISO date |
| Detected architecture | agent type, framework, language |
| Deployment and tools | method, protocols, relevant tools |
| Rules | default version and custom rules |
| Evidence boundary | repository only; no live Azure validation |

## Executive summary

State the decision and customer impact in a short paragraph.

| Critical | High | Medium | Low | Advisory | Needs review |
|---:|---:|---:|---:|---:|---:|
| n | n | n | n | n | n |

### Top three priorities

1. **Problem** — impact — immediate action.
2. **Problem** — impact — immediate action.
3. **Problem** — impact — immediate action.

### Release blockers

List finding IDs and why each blocks release, or state “None identified.”

## Best-practice posture

| Domain | PASS | FAIL | REVIEW | N/A | Expert observation |
|---|---:|---:|---:|---:|---|
| Identity and secrets | | | | | |
| Configuration and SDK | | | | | |
| Agent and tools | | | | | |
| Observability | | | | | |
| Evaluation | | | | | |
| Infrastructure and lifecycle | | | | | |
| **Total** | | | | | |

Do not calculate a compliance percentage.

## Prioritized remediation roadmap

| When | Finding | Action | Value | Effort | Owner profile |
|---|---|---|---|---|---|
| Now / before release | ID | concrete action | risk reduced | S/M/L | application/platform/security |
| Next / within 30 days | ID | concrete action | capability gained | S/M/L | profile |
| Later / continuous improvement | ID | concrete action | capability gained | S/M/L | profile |

## Detailed findings

Order by severity, then domain. Repeat this block for each `FAIL` and `REVIEW`.

### `<RULE-ID>` — Finding title

| Attribute | Assessment |
|---|---|
| Status / severity | `FAIL — High` |
| Recommendation type | Required remediation / Recommended improvement / Customer decision |
| Why it matters | Repository-specific impact |
| Observed evidence | Clickable `file:line`, with secret values redacted |
| Expected state | Testable target state |

**Recommendation**

Concrete changes tailored to this repository.

**Implementation notes**

Likely files/components, approach, tradeoffs, compatibility, and prerequisites. Do not edit them.

**How to validate**

- Repository or test evidence.
- Live Azure/manual evidence where required.

**Microsoft guidance**

- [Directly relevant title](https://learn.microsoft.com/...) — explain the connection in one phrase.

## Customer validation required

| Finding | Missing evidence | Customer validation action |
|---|---|---|
| ID | what repository cannot prove | exact portal/CLI/process evidence to collect |

## Passed checks

List one row per `PASS` rule ID. Do not combine several rules into a category row.

| Rule | Evidence summary |
|---|---|
| ID | concise evidence |

## Not applicable and advisory checks

List one row per `N/A` or advisory rule ID. Do not omit an ID even when several share the same rationale.

| Rule | Status | Rationale |
|---|---|---|
| ID | N/A/PASS | applicability reasoning |

## Method and limitations

- List scanned source/config/IaC/CI/evaluation areas.
- List excluded generated/dependency directories.
- Disclose custom rules and pinned documentation date.
- State: “This is an automated, repository-based best-practice review. It is not Microsoft certification, a compliance attestation, penetration testing, or validation of the deployed Azure environment.”

