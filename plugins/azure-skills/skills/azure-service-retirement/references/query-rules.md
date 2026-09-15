# Retirement Query Rules

## Filters

- General retirement request: pass `subCategory: "ServiceUpgradeAndRetirement"`.
- Tracking IDs: pass user values through `trackingIds`. The tool infers the retirement subcategory, so `subCategory` may be omitted.
- Date condition: pass one `retirementDate` as `<operator>:<yyyy-MM-dd>`. Supported operators are `eq` (on), `lt` (before), `le` (on or before), `gt` (after), and `ge` (on or after). The tool infers the retirement subcategory.
- Tracking IDs and one date condition may be combined.
- If `subCategory` accompanies `trackingIds` or `retirementDate`, it must be exactly `ServiceUpgradeAndRetirement`. Never combine retirement filters with another subcategory.
- Preserve explicitly requested supported filters: `resourceGroup`, `resourceType`, `resource`, `impact`, `status`, `recommendationTypeId`, `search`, `top`, and `tenant`. Add no unrelated filters. Omit `status` to use the active-recommendations default.

Never pass empty or invented filter values.

## Examples

```json
{"subscription":"<subscription>","subCategory":"ServiceUpgradeAndRetirement"}
```

```json
{"subscription":"<subscription>","trackingIds":["QNY1-HB8","9G0V-_G8"]}
```

```json
{"subscription":"<subscription>","retirementDate":"le:2027-03-31"}
```

```json
{"subscription":"<subscription>","trackingIds":["QNY1-HB8"],"retirementDate":"ge:2026-09-19"}
```

## Relative Dates

Resolve dates at execution time. "Already retired" is `lt:<today>`; "before the end of this quarter" is `le:<quarter-end>`; "after today" is `gt:<today>`.

Only one comparison is supported. For a bounded period, use the closest server-side boundary, disclose the limitation, and apply the remaining boundary to returned results without claiming the query enforced both bounds.

## Response

Sort expired and nearest deadlines first. Include when returned: recommendation name, retirement date, days remaining or passed, impact, resource name and ARM resource ID, subscription, resource group, Service Health tracking IDs, recommended action or replacement, and recommendation status.