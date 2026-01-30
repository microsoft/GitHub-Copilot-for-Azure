# Stack Selection

Select the optimal technology stack for Azure deployment.

## TASK

Choose between Containers, Serverless, or Logic Apps based on team expertise, application characteristics, and requirements.

## Stack Options

### Containers Stack

**Azure Services**: Container Apps, AKS, Container Registry

**Best When:**
- Team has Docker experience
- Complex runtime dependencies
- Need consistent performance
- Traditional long-running applications
- Microservices architecture

**Trade-offs:**
- Higher operational complexity
- More control over runtime
- Predictable performance

### Serverless Stack

**Azure Services**: Azure Functions, Logic Apps, Event Grid

**Best When:**
- Code-focused teams (less infrastructure)
- Event-driven workloads
- Variable or unpredictable traffic
- Cost optimization priority
- Rapid development cycles

**Trade-offs:**
- Cold start latency
- Execution time limits
- Less runtime control

### Logic Apps Stack

**Azure Services**: Logic Apps, API Management, Service Bus

**Best When:**
- Integration-heavy workloads
- Business process automation
- Low-code/visual workflow design
- Connecting multiple SaaS services
- Approval workflows

**Trade-offs:**
- Less code flexibility
- Connector-based model
- Different debugging experience

## Decision Matrix

| Factor | Containers | Serverless | Logic Apps |
|--------|:----------:|:----------:|:----------:|
| Docker experience | ✓✓ | | |
| Event-driven workloads | ✓ | ✓✓ | ✓ |
| Variable traffic | | ✓✓ | ✓ |
| Complex dependencies | ✓✓ | | |
| Cost optimization | ✓ | ✓✓ | ✓ |
| Integration focus | | ✓ | ✓✓ |
| Visual workflow design | | | ✓✓ |
| Team prefers code | ✓✓ | ✓ | |
| Long-running processes | ✓✓ | | ✓ |

## Assessment Questions

### Team Expertise

1. Does your team regularly work with Docker?
2. Is event-driven programming familiar to the team?
3. Does the team prefer visual workflow tools?

### Application Characteristics

1. Is traffic predictable or highly variable?
2. Are there strict performance/latency requirements?
3. Does the app have complex runtime dependencies?
4. Are processes long-running (>10 minutes)?

### Integration Requirements

1. How many external systems need integration?
2. Are there approval/workflow requirements?
3. Is this primarily a data transformation pipeline?

## Selection Algorithm

```
IF team has Docker experience AND complex dependencies:
    → Containers
ELSE IF event-driven AND variable traffic AND no cold-start concerns:
    → Serverless
ELSE IF integration-heavy AND workflow-centric:
    → Logic Apps
ELSE IF cost is primary concern:
    → Serverless
ELSE:
    → Containers (safest default)
```

## Document Decision

Record in Preparation Manifest:

```markdown
## Stack Selection

**Selected Stack**: Containers

**Rationale**:
- Team has 2+ years Docker experience
- Application has complex Python dependencies
- Consistent performance required for API SLAs
- Microservices architecture with 5 services

**Azure Services**:
- Hosting: Azure Container Apps
- Registry: Azure Container Registry
- Monitoring: Application Insights
```
