---
name: azure-cost-optimization
description: Reduce Azure costs through right-sizing, reserved instances, serverless adoption, and resource optimization. Provides guidance for compute, database, and storage cost reduction, along with governance strategies including tagging and budgets.
---

# Reducing Azure Costs

## Quick Wins

| Action | Potential Savings |
|--------|-------------------|
| Right-size VMs and databases | 20-40% |
| Use reserved instances | Up to 72% |
| Stop dev/test resources | 50-70% |
| Move to serverless | Variable |
| Delete unused resources | 100% |

## Cost Analysis

### Using CLI

```bash
# Get current costs (requires Cost Management API)
az consumption usage list --top 10

# List resources by tag (find untagged)
az resource list --query "[?tags.Environment==null]" --output table
```

### Review Azure Advisor

```bash
az advisor recommendation list --category cost
```

## Compute Optimization

### Container Apps
- Use scale-to-zero for dev/test
- Right-size CPU and memory limits
- Review minimum replica count

### App Service
- Right-size App Service plans
- Consolidate apps on shared plans
- Use Basic tier for dev/test
- Consider Consumption Functions for event-driven

### AKS
- Enable cluster autoscaler
- Use Spot instances for batch workloads
- Right-size node pools
- Stop clusters when not in use (dev/test)

### Virtual Machines
- Use B-series for burstable workloads
- Consider Spot VMs for interruptible workloads
- Auto-shutdown for dev/test
- Reserved instances for baseline

## Database Optimization

### Azure SQL
- Use serverless for variable workloads
- Elastic pools for multiple databases
- Right-size DTU/vCore
- Reserved capacity for production

### Cosmos DB
- Use autoscale instead of manual provisioning
- Enable TTL for automatic data expiration
- Optimize partition keys
- Use serverless for dev/test

### Redis
- Right-size cache tier
- Consider Basic tier for dev/test
- Use memory efficiently

## Storage Optimization

### Blob Storage
- Implement lifecycle management policies
- Use appropriate access tiers (Hot/Cool/Cold/Archive)
- Delete old snapshots and versions
- Right-size redundancy (LRS for dev)

## Reserved Instances

| Service | 1-Year Savings | 3-Year Savings |
|---------|----------------|----------------|
| VMs | ~35% | ~55% |
| SQL Database | ~30% | ~50% |
| Cosmos DB | ~20% | ~35% |

## Governance

### Tagging Strategy

Require these tags for cost tracking:
- `Environment` (prod, dev, test)
- `CostCenter`
- `Owner`
- `Project`

### Budgets and Alerts

```bash
# Create budget (via portal or ARM template)
# Set alerts at 50%, 75%, 100%
```

## Checklist

- [ ] Review Azure Advisor cost recommendations
- [ ] Identify and delete unused resources
- [ ] Right-size over-provisioned resources
- [ ] Implement auto-shutdown for dev/test
- [ ] Consider reserved instances for production
- [ ] Set up budgets and alerts
- [ ] Implement tagging for cost attribution
- [ ] Review storage lifecycle policies
- [ ] Enable scale-to-zero where possible
