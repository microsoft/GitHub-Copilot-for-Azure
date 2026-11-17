# 3. Classify and rank once

Use the [canonical contract](health-contract.md) for overall
`HEALTHY`, `DEGRADED` or `INCONCLUSIVE`, finding states and ranking. Readiness is
not health. Stale/empty or provisioning-only evidence cannot establish current
health. Partial observations remain scoped, not complete coverage.

Parent success cannot erase failed children, HTTP errors, retries or fallback;
transport success does not establish semantic quality, safety or task success.
Unsupported evaluators are coverage gaps, not quality failures. No new evaluation
is required. Running/Ready and zero restarts cannot rule out resource pressure.
Missing required pressure signals prevent a full healthy verdict. Test fixtures
may explain a failure, not make it healthy. Correlation is not causation;
do not invent confidence percentages or certified root cause.
