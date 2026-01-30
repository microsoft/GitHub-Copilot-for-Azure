---
name: azure-cost-optimization
description: Analyze Azure costs and generate optimization recommendations. Use for spending analysis, finding waste, rightsizing, or cost reports.
---

# Azure Cost Optimization

Find cost savings via orphaned resource cleanup, rightsizing, and usage-based recommendations.

## When to Use

- Optimize Azure costs or reduce spending
- Find orphaned/unused resources
- Rightsize VMs, containers, services
- Generate cost reports
- Redis-specific: See [azure-redis.md](./references/azure-redis.md)

## Workflow

| Step | Action | Reference |
|------|--------|-----------|
| 0-1 | Prerequisites, best practices | [cost-analysis-workflow.md](./references/cost-analysis-workflow.md) |
| 2 | Run azqr scan | [azure-quick-review.md](./references/azure-quick-review.md) |
| 3-5 | Discover resources, query costs, validate pricing | [cost-analysis-workflow.md](./references/cost-analysis-workflow.md) |
| 6-9 | Metrics, report, audit trail | [metrics-and-reporting.md](./references/metrics-and-reporting.md) |

## Output

- `output/costoptimizereport<timestamp>.md` - Recommendations
- `output/cost-query-result<timestamp>.json` - Audit trail

## References

- [cost-analysis-workflow.md](./references/cost-analysis-workflow.md)
- [metrics-and-reporting.md](./references/metrics-and-reporting.md)
- [best-practices.md](./references/best-practices.md)
- [azure-quick-review.md](./references/azure-quick-review.md)
- [azure-redis.md](./references/azure-redis.md)
