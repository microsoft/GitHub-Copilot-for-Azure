# 5. Optional visuals and verified links

After useful evidence, optionally offer an inline view or help creating an AMG
dashboard unless a choice/decline is retained. The offer authorizes no writes or
queries. A dashboard choice goes to the available `troubleshoot-observability`
visual-evidence flow without reassessment; this health workflow creates no HTML,
Grafana JSON, workbook or published dashboard.

For three quantitative KPIs or a material comparison/trend, optionally offer
one 1600x900 SVG using `scripts/render_inline_health_visual.py`. It requires
explicit consent for sanitized input JSON and SVG writes at agreed paths and an
already approved Python interpreter; never install Python. Do not issue new remote queries
solely for visuals. If declined, unavailable or unsupported, return the complete chat assessment.
Read [inline visual schema and skips](inline-health-visual.md).
Use three to five state-colored cards, at most two compact comparisons, verified
thresholds/baselines and up to five already-collected infrastructure metrics.
Missing signals are `Unavailable`. Embed once; do not list local artifacts as Resources.

Use only stable verified resource links; omit unresolved slots. When relevant,
order up to five: Application Map, representative end-to-end transaction (otherwise
verified component), Foundry Monitoring/Traces, affected Function/App Service,
AKS Container Insights. Do not invent portal routes.
The optional `scripts/build_appinsights_trace_link.py` needs an approved interpreter
and already resolved telemetry itemId UUID/timestamps, not operation ID alone.
Follow [transaction inputs](transaction-links.md); no queries just
for links. Otherwise use the verified component link.
