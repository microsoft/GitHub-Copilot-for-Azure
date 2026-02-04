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

---

# Test Report: [TEST_NAME]

**Date:** [RUN_DATE]  
**Duration:** [DURATION]  
**Status:** [STATUS_EMOJI] [STATUS_TEXT]  
**Confidence:** [CONFIDENCE_EMOJI] [CONFIDENCE_LEVEL]

## 📝 Test Prompt

```
[PROMPT_TEXT]
```

## 📊 Result Summary

| Metric | Value |
|--------|-------|
| Status | [PASSED/FAILED] |
| Retries | [NUMBER] |
| Duration | [MS]ms ([SECONDS]s) |
| Skill | [SKILL_NAME] |
| Task Type | [TASK_TYPE] |

## 🎯 Confidence Level

**Overall Confidence:** [EMOJI] [LEVEL] ([PERCENTAGE]%)

| Factor | Impact |
|--------|--------|
| [FACTOR] | [+/- NUMBER] |

**Confidence Indicators:**
- [INDICATOR]

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

## 📈 Token Usage

| Metric | Value |
|--------|-------|
| Input Tokens | [NUMBER] |
| Output Tokens | [NUMBER] |
| Total Tokens | [NUMBER] |

## 🔐 Azure Authentication

- **Azure CLI:** [STATUS]

> **Note:** [AUTH_NOTES]

## 🚀 Further Optimization

### Recommended Actions

| Priority | Action | Benefit | Effort |
|----------|--------|---------|--------|
| [EMOJI] [PRIORITY] | [ACTION] | [BENEFIT] | [EFFORT] |

### Details

1. **[ACTION_TITLE]**
   - [DETAIL]

## 📚 Learnings

### What Worked
- [ITEM]

### Areas for Improvement
- [ITEM]

### [SECTION_TITLE]
[Optional section for special notes like "Auth Notes"]

> [NOTE_CONTENT]

---
*Generated at [TIMESTAMP]*
