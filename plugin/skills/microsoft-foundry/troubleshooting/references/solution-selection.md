# Solution Selection Pattern for 429 Troubleshooting

## When to Use AskUserQuestion

After diagnosing a 429 error, **always present solution options** to the user via `AskUserQuestion` rather than dictating a fix.

**Use AskUserQuestion when:**
- ✅ Multiple valid solutions exist (scaling, retry logic, multi-region, quota increase)
- ✅ Trade-offs between solutions (speed vs. complexity, cost vs. setup time)
- ✅ User context matters (dev/test vs. production, urgency, budget)

**Skip AskUserQuestion when:**
- ❌ Only one correct solution exists (just execute it)
- ❌ The diagnosis is still incomplete (gather more info first)

## Example Question Structures

### Scenario 1: Low Deployment Allocation (Most Common)

**Context:** Deployment has 1K TPM allocated, but 50K TPM available in regional quota.

```yaml
question: "I found your deployment has only 1K TPM allocated, but you have 50K TPM available in your quota. How would you like to resolve the 429 errors?"
header: "Solution"
multiSelect: false
options:
  - label: "Scale deployment capacity (Recommended)"
    description: "Increase from 1K to 10K+ TPM using available quota. Immediate fix, takes ~30 seconds to apply."

  - label: "Implement retry logic only"
    description: "Add exponential backoff to your code while keeping current capacity. Helps with bursts but doesn't solve sustained load."

  - label: "Request quota increase"
    description: "Submit portal request for more regional quota. Takes 1-3 business days for approval."

  - label: "Deploy to multiple regions"
    description: "Distribute load across regions for geographic redundancy. More complex setup, best for high-scale production."
```

### Scenario 2: Regional Quota Exhausted

**Context:** Deployment using maximum regional quota (e.g., 50K/50K TPM).

```yaml
question: "Your deployment is using the maximum regional quota (50K TPM). How would you like to proceed?"
header: "Solution"
multiSelect: false
options:
  - label: "Request quota increase (Recommended)"
    description: "Submit portal request for higher regional quota. Takes 1-3 business days, allows scaling in current region."

  - label: "Deploy to additional regions"
    description: "Set up multi-region deployment for load distribution. Immediate capacity increase, requires load balancer setup."

  - label: "Optimize token usage"
    description: "Reduce tokens per request (shorter prompts, truncate context). May impact quality but works with current capacity."

  - label: "Implement advanced retry logic"
    description: "Add request queuing and exponential backoff. Helps manage bursts but won't solve sustained over-quota."
```

### Scenario 3: Burst Traffic Pattern

**Context:** 429 errors only during peak hours, plenty of capacity during normal hours.

```yaml
question: "Your 429 errors only occur during peak hours (9am-5pm). How would you like to handle this?"
header: "Solution"
multiSelect: false
options:
  - label: "Scale for peak capacity (Recommended)"
    description: "Increase deployment capacity to handle peak load. Simple solution, slightly higher cost during off-peak."

  - label: "Implement request queuing"
    description: "Queue requests during peaks and process them smoothly. Adds latency but maintains current capacity."

  - label: "Use auto-scaling pattern"
    description: "Deploy/scale up during peaks, scale down off-peak. Most cost-efficient but requires automation setup."
```

### Scenario 4: Multiple Deployments Competing for Quota

**Context:** Multiple deployments in same region/SKU sharing quota pool.

```yaml
question: "You have 3 deployments sharing 50K TPM quota, and all are hitting limits. How would you like to resolve this?"
header: "Solution"
multiSelect: false
options:
  - label: "Request quota increase (Recommended)"
    description: "Increase regional quota to give all deployments more headroom. Takes 1-3 business days."

  - label: "Rebalance capacity allocation"
    description: "Reduce capacity on lower-priority deployments to free up quota for high-priority ones. Immediate but may impact other workloads."

  - label: "Deploy to multiple regions"
    description: "Move some deployments to other regions to access separate quota pools. More complex setup."

  - label: "Consolidate deployments"
    description: "Merge multiple deployments into fewer deployments with shared capacity. Requires application changes."
```

## Best Practices

### 1. Always Include Context

Start the question with key diagnostic findings:
- Current deployment capacity (TPM/RPM)
- Available regional quota
- Error pattern (constant, burst, time-of-day)

### 2. Make Recommendations Clear

Mark the most appropriate option as "(Recommended)" based on:
- Severity of the issue
- User's likely context (if known)
- Speed to resolution vs. complexity

### 3. Show Trade-Offs in Descriptions

Each option description should mention:
- **Benefit**: What it solves
- **Speed**: How long it takes
- **Complexity**: Setup effort required
- **Limitation**: What it doesn't solve (if applicable)

### 4. Don't Overwhelm

Limit to 4 options maximum. If there are more possibilities, combine similar ones or present the most relevant subset.

### 5. Support User's Choice

After the user selects, execute their choice with:
- Detailed step-by-step guidance
- Verification commands
- What to expect next

**Never second-guess or discourage their selection** - if they chose "retry logic only" when you recommended scaling, help them implement excellent retry logic.

## What NOT to Do

❌ **Don't dictate the solution:**
```
"The scaling solution is the proper fix for your use case."
```

✅ **Do present options:**
```
"Here are your options for resolving this..."
[Interactive question with 3-4 choices]
```

❌ **Don't make it a yes/no question:**
```
"Should I scale your deployment?"
```

✅ **Do show all viable alternatives:**
```
[Scale / Retry Logic / Quota Increase / Multi-Region]
```

❌ **Don't bury options in text:**
```
"You could scale, or you could implement retry logic, or maybe request a quota increase..."
```

✅ **Do use structured options:**
```yaml
options:
  - label: "Scale deployment"
    description: "..."
  - label: "Implement retry logic"
    description: "..."
```

## Integration with Diagnostic Workflow

The typical flow should be:

1. **Step 1-3**: Diagnose the issue (check deployment limits, regional quota, error patterns)
2. **Step 4**: Implement basic retry logic (always a good practice)
3. **Step 5**: **Present solutions via AskUserQuestion** ← This is the decision point
4. **Step 6**: Execute the user's chosen solution with detailed guidance

This gives users agency while ensuring they understand the trade-offs between different approaches.
