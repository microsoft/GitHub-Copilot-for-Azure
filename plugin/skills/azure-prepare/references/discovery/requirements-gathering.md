# Requirements Gathering

Engage users conversationally to understand project requirements and constraints.

## TASK

Gather comprehensive project requirements through structured conversation to inform architecture decisions.

## CRITICAL: THIS STEP IS MANDATORY

**DO NOT SKIP requirements gathering.** Even for simple projects:
- Use the `ask_user` tool to confirm each category
- Do not assume defaults without explicit confirmation
- Document responses in the manifest immediately

If the user seems impatient:
> "I want to make sure we set this up correctly for your needs. A few quick questions will help me choose the right Azure services and avoid unnecessary costs."

## Discovery Categories

### 1. Project Classification

| Classification | Description | Typical Choices |
|----------------|-------------|-----------------|
| **POC** | Proof of concept, experimentation | Minimal infra, cost-optimized |
| **Development Tool** | Internal tooling, developer productivity | Balanced, team-focused |
| **Production Application** | Customer-facing, business-critical | Full reliability, monitoring |

**Questions to ask:**
- What is the primary purpose of this project?
- Who is the intended audience?
- What stage is this project in?

### 2. Scale Category

| Scale | User Base | Considerations |
|-------|-----------|----------------|
| **Small** | <1,000 users | Single region, basic SKUs |
| **Medium** | 1K-100K users | Auto-scaling, multi-zone |
| **Large** | 100K+ users | Multi-region, premium SKUs |

**Questions to ask:**
- How many users do you expect?
- What geographic regions need coverage?
- What are your availability requirements?

### 3. Budget Constraints

| Budget Profile | Focus | Trade-offs |
|----------------|-------|------------|
| **Cost-Optimized** | Minimize spend | Lower SKUs, shared resources |
| **Balanced** | Value for money | Standard SKUs, reasonable limits |
| **Performance-Focused** | Maximum capability | Premium SKUs, reserved capacity |

**Questions to ask:**
- Are there budget constraints or targets?
- Is this a fixed budget or flexible?
- Any preference for pay-as-you-go vs. reserved?

### 4. Architectural Preferences

| Preference | Best For |
|------------|----------|
| **Containers** | Docker experience, complex dependencies |
| **Serverless** | Event-driven, variable traffic |
| **Hybrid** | Mix of patterns |
| **No Preference** | Let skill recommend |

**Questions to ask:**
- Does your team have Docker/container experience?
- Is the workload event-driven or request-driven?
- Any specific technology constraints?

## Conversation Flow

### Opening

> I'll help you prepare your application for Azure. Let me understand your requirements first.

### Core Questions

1. **Purpose**: "What type of project is this—a proof of concept, internal tool, or production application?"

2. **Scale**: "How many users do you expect, and in which regions?"

3. **Budget**: "Are there budget constraints I should consider?"

4. **Technology**: "Does your team have experience with containers, or would you prefer serverless?"

### Capture Responses

Document in Preparation Manifest:

```markdown
## Project Requirements

| Attribute | Value | Notes |
|-----------|-------|-------|
| Classification | Production | Customer-facing app |
| Scale | Medium | Expected 10K users |
| Budget | Balanced | Standard enterprise budget |
| Architecture Preference | Containers | Team has Docker experience |
| Primary Region | East US | User base concentrated in US East |
| Availability Target | 99.9% | Business-critical |
```

## Defaults When Not Specified

If user doesn't provide specifics, **ASK FOR CONFIRMATION before using defaults**:

> "Since you didn't specify, I'll use [default]. Is that okay, or would you prefer something different?"

| Attribute | Default |
|-----------|---------|
| Classification | Development Tool |
| Scale | Small |
| Budget | Balanced |
| Architecture | Based on codebase analysis |
| Region | Closest to user's location |

**NEVER silently apply defaults. Always confirm with user.**
