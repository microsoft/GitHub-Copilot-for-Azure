# Test Report Template

## CRITICAL INSTRUCTIONS

**YOU MUST OUTPUT THE REPORT DIRECTLY - DO NOT describe what you're doing or what the report contains.**

**FORMAT REQUIREMENTS:**
- Start immediately with the markdown report (starting with the # heading)
- Do NOT include any preamble, explanation, or meta-commentary
- Do NOT say "I've created a report" or "Here is the report"
- ONLY output the actual report content itself
- Follow the exact structure below, replacing [PLACEHOLDERS] with actual data
- Use the exact emojis and formatting shown
- Omit optional sections only if truly no data is available

# Test Report: [TEST_NAME]

**Date:** [RUN_DATE]
**Duration:** [DURATION]
**Status:** [STATUS_EMOJI] [STATUS_TEXT]

## 📝 Test Prompt

```
[PROMPT_TEXT]
```

## 📊 Result Summary

| Metric | Value |
|--------|-------|
| Status | [PASSED/FAILED] |
| Trials | [NUMBER] |
| Duration | [MS]ms ([SECONDS]s) |
| Skill | [SKILL_NAME] |

## ⚠️ Warnings (Non-Blocking)

> These issues were detected during execution but **did not prevent the task from completing**.
> They are documented for awareness and potential optimization.

### Warning Summary

| Category | Count | Why It Didn't Matter |
|----------|-------|---------------------|
| [CATEGORY] | [NUMBER] | [EXPLANATION] |

### Warning Details

#### [CATEGORY NAME]

**Why it didn't block success:** [EXPLANATION]

- \`[ERROR MESSAGE]\`
- *...and [NUMBER] more*

## 🎯 Success Artifacts

### 🌐 Deployed URLs

| URL | Type | Skill | Status |
|-----|------|-------|--------|
| [[URL]]([URL]) | [TYPE] | [SKILL] | ✅ |

### 📄 Generated Files & Reports
[Optional section]

| Path | Type | Skill |
|------|------|-------|
| \`[PATH]\` | [TYPE] | [SKILL] |

### 🔌 Endpoints & Connection Info
[Optional section]

| Endpoint | Type | Skill |
|----------|------|-------|
| \`[ENDPOINT]\` | [TYPE] | [SKILL] |

### 🎯 Skills Invoked

| Skill | Type | Category |
|-------|------|----------|
| \`[SKILL]\` | [TYPE] | [CATEGORY] |

### 🔧 Tools Invoked

| Tool | Count | Actions |
|------|-------|---------|
| \`[TOOL]\` | [NUMBER]x | [ACTIONS] |

### 🔌 Azure MCP Tools Used
[Optional section]

| Tool | Type | Category |
|------|------|----------|
| \`[TOOL]\` | [TYPE] | [CATEGORY] |

## Trajectory Summary

Provide a narrative summary of what happened during each trial, what went well and what went wrong. Focus on these 3 aspects:

- Quality:
    - Did the LLM invoke reasonable tools for the task?
    - Did the LLM present sufficient and accurate information related to the task?
    - Did the agent pause at a reasonable place for clarification? 
- Consistency: (only applicable for tests with more than 1 trial)
    - Did the LLM select the same tools?
    - Did the LLM pass the same or similar parameters when using the same tools?
    - Did the LLM generate a response following the same text pattern?
- Cost:
    - How many tokens did the test run use? Break the report down to cached input, uncached input (computed by subtracting cached input from total input) and output.

**Runs:** [run-count] | **Pass Rate:** [rate]% ([passed]/[total])

**What Happened:**
{Narrative description of the test execution flow. Describe the key steps the agent took, which tools were called, and the final outcome. Be specific — reference actual agent behavior observed in the logs.}

**✅ What Went Well:**
- {Positive observation — e.g., "Agent produced accurate output matching expected response", "agent consistently used the same tool", "agent paused for clarification at a reasonable place"}
- ...

Be honest. If nothing went well, just say so.

**❌ What Went Wrong:**
- {Negative observation — e.g., "Response was missing required fields","agent didn't invoke the tools in consistent ways", "agent should have paused but moved forward"}
- ...

Be honest. If nothing went wrong, just say so.

**📈 Token Usage:**

| Trial | Cached Input Tokens | Uncached Input Tokens | Output Tokens | Credit Score |
|-------|---------------------|-----------------------|---------------|--------------|
| [TRIAL_NUMBER] | [CACHED_INPUT] | [UNCACHED_INPUT] | [OUTPUT] | [CREDIT_SCORE] |
| ... | ... | ... | ... | ... |

> **Credit score formula:** $\text{Credit Score} = (\text{Uncached Input} + 0.1 \times \text{Cached Input}) + 5 \times \text{Output}$. 5 is the estimated cost multiplier for output tokens compared to uncached input tokens. This score estimates relative monetary token cost; the actual monetary token cost depends on the actual price of the model.

## 🚀 Recommended Actions

Suggestions for the skill author based on problems discovered during testing. Each item should identify the problem, cite supporting evidence from test results, and propose a potential fix or investigation. Be honest. If you don't have any recommended action, just say so.

1. **[area-title]** — [Description of the problem. Reference specific test cases, pass rates, or agent behaviors that surfaced this issue. Suggest what the skill author could change in the skill definition, prompts, triggers, or instructions to address it.]
2. **[area-title]** — [Description and suggestion]
3. ...

---
*Generated at [TIMESTAMP]*
