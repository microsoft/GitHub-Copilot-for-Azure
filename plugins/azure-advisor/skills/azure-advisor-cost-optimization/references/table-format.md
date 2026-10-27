# Tables and selected resources

Apply on every model, including Auto. Keep scope, currency, pricing basis, full totals and
coverage outside disclosures. Distinguish returned rows from initially visible rows.

## Opening discovery format

Use all four blocks even for one type or unavailable prices. For Completed, replace
Yearly potential savings with Realized savings throughout.

```text
## Scope
<scope> | <coverage> | <returned pricing basis> | Advisor estimates, not invoices

## Advisor found
<returned count and correct meaning> across <returned type count> recommendation types.

## Savings
- Yearly potential savings: <amount or Unavailable>
- Cost: <amount or Unavailable>
- Currency: <measure currency>
- Pricing basis: <returned basis>

## Recommendation types
|Recommendation type|<Recommendations or Affected resources>|Yearly potential savings|Cost|
|---|---:|---:|---:|
|<exact returned name>|<group count>|<amount>|<amount>|
```

## Inline expansion

Show at most 15 rows initially. Include every further returned row in nested inline
`<details>` / `<summary>` sections, up to 15 rows per section, identical columns, labeled
`Show N more (start-end of total returned)`. Nest the next disclosure after its preceding
batch so each click reveals one batch. Use the actual final batch size.
These controls only reveal content: no `ask_user`, Azure query, selection or new user prompt.
Keep explicit user limits; never invent rows beyond the returned/capped result.
Server truncation is separate from collapsed content.

Use blank lines around Markdown tables in disclosures:

```markdown
<details>
<summary>Show <count> more (<start>-<end> of <total> returned)</summary>

<same table header and next returned rows>

<next nested disclosure, if needed>

</details>
```

## Resource detail

For read-only selected-type details, use this literal layout, not opening discovery:

```text
## Selected recommendation
**<exact returned recommendation name>**

Advisor returned **<count and resource kind>**, with **<returned type savings and lifecycle label>**.
<coverage/truncation; rows returned and initially shown>

**Scope:** <scope> | **Currency:** <currency> | **Pricing basis:** <basis> | Status: <status>.
Figures are Advisor estimates, not invoices.

|Resource|Resource<br>group|Yearly potential<br>savings|Cost|
|---|---|---:|---:|
|<name>|<group>|<amount>|<amount>|
```

Keep the intro short; put Cost in the table, not a second accumulated-cost sentence.
Use the monetary rules in [Output and savings](output-and-savings.md).
For SG/multiple subscriptions, insert Subscription immediately after Resource, using friendly
names or IDs when unavailable. SG scope does not replace row ownership.
For Completed use Realized savings; append [Lifecycle](lifecycle.md) columns.
One table per selected type. End with a brief ownership/retention caution and no-resources-
changed statement; no unrequested safety-check/resource-selection flow.

Preserve priority order; otherwise sort returned lifecycle-appropriate savings descending,
unknown last, stable ties. No padding spaces/spacer columns in pipe markup.
Wrap long headers/names with `<br>`, including unbroken suffixes when needed. Removing breaks
must recover the exact name; no abbreviations/truncation. Keep currency/basis above the table.
USD uses `$`, thousands separators and two decimals; other currencies use unambiguous notation.
Unavailable stays Unavailable, not money.

Full resource IDs belong below tables only for disambiguation, confirmation, artifacts or
explicit requests. Never call recommendation IDs resource IDs. Ordinary analysis omits raw
payloads/links; actionability owns remediation links.

Pagination selects nothing or authorizes updates. Batch confirmation follows
[State updates](state-updates.md).
