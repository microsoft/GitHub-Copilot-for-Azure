# 3. Compare, with or without Python

When an approved runnable **Python 3.9+** already exists, use:

```text
python "<skill-directory>\scripts\recovery.py" <sanitized-input.json>
```

Resolve `<skill-directory>` to this installed skill's actual directory, not the
application workspace or an assumed `.github` location.

The helper is stdlib-only, deterministic for supplied input/current time, reads
one bounded local JSON file and prints minimized JSON; it never writes files,
queries tools, or verifies source truth. Do not install Python. A product's
bundled interpreter may be used for explicitly authorized offline developer
validation, not represented as a supported customer dependency.

If no supported interpreter exists, select **tools-only mode**. Use only actual
available local-read/comparison tools and the contract's same arithmetic,
chronology, completeness and verdict precedence rules against supplied
evidence. If exact arithmetic/validation is unavailable, report INCONCLUSIVE.
Do not fabricate helper output or claim deterministic schema validation ran.
No new report/input artifacts are required for tools-only comparison.

For mean/fraction metrics compare `total / sample_count` against the explicitly
agreed bound in each window. For percentile metrics compare the explicitly
supplied **source-computed** `percentile_value` directly, with the same explicit
percentile definition (for example p95), unit, eligible population and query
semantics in both windows. Never reconstruct percentiles from averages, multiply
them into totals, or average subwindow percentiles. Actual represented sample
counts, observation spans, provenance and all other gates still apply.
Confirm the original symptom actually violated its
bound. For a required post-change violation, report NOT_RECOVERED even when an
unrelated check is denied; do not suppress a demonstrated failure. Recovery
requires every required check to pass with complete fresh adequate comparable
evidence, including established original symptoms. Uncertain symptoms are never
recovered. Unsupported metrics or ambiguous populations remain INCONCLUSIVE;
do not substitute request success for quality or tails with averages.

Passing aggregate gates does not establish a continuous/sustained SLO between
observations. When sustained recovery is the agreed criterion, declare separate
required checks for each agreed subwindow and retain gaps explicitly; do not
infer unseen intervals from an overall percentile or first/last timestamps.
