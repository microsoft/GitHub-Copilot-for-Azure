# Skill Writing Checklist

This checklist helps avoid conflicts between skills and ensures clear, actionable skill definitions.

## ✅ Dos

### 1. Include Trigger Phrases
List specific phrases/keywords that should activate your skill:
```markdown
**Trigger phrases** (use this skill when you see these):
- "evaluate my Foundry agent"
- "builtin.coherence" (specific API/SDK terms)
- References to `openai_client.evals`
```

### 2. Be Specific About Scope
- Name the **exact product/service** (e.g., "Foundry agents" not just "agents")
- Mention **specific SDK/API names** (e.g., `azure-ai-projects` not just "Azure SDK")
- Include **version requirements** when relevant

### 3. Include "When NOT to Use" Section
Explicitly list scenarios where this skill should NOT be used:
```markdown
## When NOT to Use This Skill
- User is evaluating a **non-Foundry application** → Use AI Toolkit instead
- User mentions `azure-ai-evaluation` SDK → That's AI Toolkit, not this skill
```

### 4. Call Out Conflicting Skills by Name
If another skill covers a similar domain, explicitly differentiate:
```markdown
| Approach | SDK | Use For |
|----------|-----|---------|
| **This Skill** | `azure-ai-projects` | Foundry agents |
| AI Toolkit | `azure-ai-evaluation` | Non-Foundry apps |
```

### 5. Prefer Built-in/Managed Solutions
- Recommend built-in evaluators, templates, or managed services first
- Custom solutions should be positioned as "when built-in doesn't meet your needs"
- Reduces maintenance burden and improves consistency

### 6. Include Concrete Examples
- Show actual code snippets, not just descriptions
- Include sample inputs/outputs
- Provide interpreation guides for results

### 7. Version Your Dependencies
```markdown
### Python Packages
pip install "azure-ai-projects>=2.0.0b1"

**Note:** Version 2.0.0b1+ required for X feature.
```

## ❌ Don'ts

### 1. Don't Use Generic Trigger Words
❌ Bad: "evaluate", "test", "check"
✅ Good: "evaluate my Foundry agent", "run agent evaluations"

### 2. Don't Overlap with Other Skills Without Disambiguation
If multiple skills could handle "evaluation":
- Explicitly state which evaluation type this skill handles
- Reference the other skill by name for the other cases

### 3. Don't Assume Context
- Don't assume the user has a Foundry project
- Include prerequisite checks
- Provide clear error messages for missing requirements

### 4. Don't Maintain Custom Prompts When Built-ins Exist
❌ Bad: Writing custom evaluation prompts for coherence/safety
✅ Good: Using `builtin.coherence`, `builtin.violence` etc.

### 5. Don't Mix SDK Patterns
If your skill uses `azure-ai-projects`:
- Don't show examples using `azure-ai-evaluation` 
- Don't mix OpenAI SDK patterns with Azure-specific patterns

### 6. Don't Forget Data Mapping Gotchas
Document the tricky parts:
- `{{item.response}}` vs `{{sample.output_text}}` differences
- Required vs optional fields
- Init parameters that are easy to forget

## Conflict Prevention Template

Add this section to skills that might conflict with others:

```markdown
## Skill Boundaries

### This Skill Handles
- [Specific scenario 1]
- [Specific scenario 2]

### Related Skills (Use Instead For)
| Scenario | Use This Skill Instead |
|----------|----------------------|
| Non-Foundry evaluation | AI Toolkit (`aitk-evaluation_planner`) |
| Agent creation | `microsoft-foundry` skill |
| Azure deployment | `azure-deploy` skill |

### Detection Heuristics
Use this skill if user mentions:
- ✅ "Foundry agent" + "evaluate"
- ✅ `builtin.*` evaluator names
- ✅ `azure-ai-projects` SDK

Do NOT use this skill if user mentions:
- ❌ `azure-ai-evaluation` SDK
- ❌ LangChain, AutoGen (non-Foundry frameworks)
- ❌ "create agent" (that's building, not evaluating)
```

## Checklist Before Publishing

- [ ] Description is < 200 chars and specific
- [ ] "When to Use" includes trigger phrases
- [ ] "When NOT to Use" section exists
- [ ] Conflicting skills are called out by name
- [ ] SDK/API versions are specified
- [ ] Code examples use correct, tested patterns
- [ ] Built-in solutions preferred over custom
- [ ] Data mapping gotchas documented
- [ ] Prerequisites clearly listed
- [ ] Error scenarios and troubleshooting included
