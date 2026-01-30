# Ralph Loop Workflow

Detailed workflow documentation for the Ralph loop pattern.

## Overview

The Ralph loop is an iterative improvement cycle inspired by the ["Ralph Wiggum" technique](https://www.humanlayer.dev/blog/brief-history-of-ralph) - letting AI implement features one at a time until complete.

## Loop States

```
         ┌──────────────────┐
         │      START       │
         │  (skill-name)    │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │    1. READ       │◀──────────────────┐
         │  Load SKILL.md   │                   │
         │  Load tests      │                   │
         └────────┬─────────┘                   │
                  │                             │
                  ▼                             │
         ┌──────────────────┐                   │
         │    2. SCORE      │                   │
         │  Rule-based      │                   │
         │  compliance      │                   │
         └────────┬─────────┘                   │
                  │                             │
                  ▼                             │
         ┌──────────────────┐                   │
         │  Score >= M-H?   │──NO───┐           │
         │  Tests pass?     │       │           │
         └────────┬─────────┘       │           │
                  │ YES             │           │
                  ▼                 │           │
         ┌──────────────────┐       │           │
         │    COMPLETE      │       │           │
         │  Next skill      │       │           │
         └──────────────────┘       │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │   3. SCAFFOLD    │ │
                           │  (if no tests)   │ │
                           └────────┬─────────┘ │
                                    │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │   4. IMPROVE     │ │
                           │   FRONTMATTER    │ │
                           └────────┬─────────┘ │
                                    │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │   5. IMPROVE     │ │
                           │   TESTS          │ │
                           └────────┬─────────┘ │
                                    │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │   6. VERIFY      │ │
                           │   Run tests      │ │
                           └────────┬─────────┘ │
                                    │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │   7. COMMIT      │ │
                           │   Save progress  │ │
                           └────────┬─────────┘ │
                                    │           │
                                    ▼           │
                           ┌──────────────────┐ │
                           │  Iteration < 5?  │─┘
                           └────────┬─────────┘
                                    │ NO
                                    ▼
                           ┌──────────────────┐
                           │    TIMEOUT       │
                           │   Next skill     │
                           └──────────────────┘
```

## Step Details

### Step 1: READ

**Action:** Load the skill's current state

**Files to read:**
```
plugin/skills/{skill-name}/SKILL.md    # Required
tests/{skill-name}/unit.test.js        # If exists
tests/{skill-name}/triggers.test.js    # If exists
tests/{skill-name}/integration.test.js # If exists
```

**Extract:**
- Frontmatter (name, description, compatibility)
- Current trigger/anti-trigger phrases
- Existing test prompts

### Step 2: SCORE

**Action:** Evaluate frontmatter compliance

**Checks:**
1. Description length >= 150 chars
2. Contains trigger phrases ("USE FOR:" etc.)
3. Contains anti-triggers ("DO NOT USE FOR:" etc.)
4. Has compatibility field (optional for Medium-High)

**Output:** Low | Medium | Medium-High | High

### Step 3: SCAFFOLD (Conditional)

**Condition:** `tests/{skill-name}/` does not exist

**Action:** Create test directory from template

**Commands:**
```bash
cp -r tests/_template tests/{skill-name}
```

**Then update in each test file:**
```javascript
const SKILL_NAME = '{skill-name}';  // Replace placeholder
```

### Step 4: IMPROVE FRONTMATTER

**Action:** Enhance the SKILL.md frontmatter

**Goals:**
1. Add "USE FOR:" section with trigger phrases
2. Add "DO NOT USE FOR:" section with anti-triggers
3. Keep description under 1024 characters
4. Maintain clarity and usefulness

**Strategy:**
- Read skill content to understand purpose
- Identify related skills for anti-triggers
- Extract keywords that should trigger this skill
- Identify scenarios that should NOT trigger this skill

**Template:**
```yaml
---
name: {skill-name}
description: |
  [What the skill does - 1-2 sentences]
  USE FOR: [phrase1], [phrase2], [phrase3], [phrase4], [phrase5]
  DO NOT USE FOR: [scenario1] (use other-skill), [scenario2] (use another-skill)
---
```

### Step 5: IMPROVE TESTS

**Action:** Update test prompts to match new frontmatter

**Files to update:**
- `tests/{skill-name}/triggers.test.js`

**Updates needed:**

1. **shouldTriggerPrompts** (minimum 5):
   - Match the "USE FOR:" phrases
   - Include variations and natural language
   - Cover the skill's primary use cases

2. **shouldNotTriggerPrompts** (minimum 5):
   - Match the "DO NOT USE FOR:" scenarios
   - Include unrelated topics (weather, poetry)
   - Include other cloud providers (AWS, GCP)
   - Include related but different Azure services

### Step 6: VERIFY

**Action:** Run tests to ensure changes work

**Command:**
```bash
cd tests && npm test -- --testPathPattern={skill-name}
```

**Expected outcome:**
- All tests pass
- Snapshots may need updating (auto-update is OK)

**If tests fail:**
- Analyze failure
- Adjust frontmatter or test prompts
- Re-run (counts as sub-iteration)

### Step 7: COMMIT

**Action:** Save progress with descriptive commit

**Commands:**
```bash
git add plugin/skills/{skill-name}/SKILL.md
git add tests/{skill-name}/
git commit -m "willie: improve {skill-name} frontmatter"
```

**Commit message format:**
```
willie: improve {skill-name} frontmatter

- Added USE FOR trigger phrases
- Added DO NOT USE FOR anti-triggers  
- Updated test prompts to match
- Score: Low → Medium-High
```

### Step 8: REPEAT or EXIT

**Check:** Has the target been reached?

**Exit conditions (move to next skill):**
- Score >= Medium-High AND tests pass
- Iteration count >= 5 (timeout)
- Unrecoverable error

**Continue condition:**
- Score < Medium-High OR tests failing
- Iteration count < 5

---

## Batch Processing

When multiple skills are queued:

```
Skills: [skill-a, skill-b, skill-c]

┌─────────────────────────────────────────┐
│  Process skill-a                        │
│  └─ Loop until complete or timeout      │
│  └─ Commit                              │
├─────────────────────────────────────────┤
│  Process skill-b                        │
│  └─ Loop until complete or timeout      │
│  └─ Commit                              │
├─────────────────────────────────────────┤
│  Process skill-c                        │
│  └─ Loop until complete or timeout      │
│  └─ Commit                              │
├─────────────────────────────────────────┤
│  SUMMARY REPORT                         │
│  ├─ skill-a: Low → Medium-High ✓        │
│  ├─ skill-b: Medium → Medium-High ✓     │
│  └─ skill-c: Low → Medium (timeout)     │
└─────────────────────────────────────────┘
```

---

## Error Handling

### Test Failures

1. Log the specific failure
2. Attempt to fix (adjust prompts or frontmatter)
3. Re-run tests
4. If still failing after 2 attempts, commit partial progress and note in message

### Git Conflicts

1. Stash changes: `git stash`
2. Pull latest: `git pull --rebase`
3. Apply changes: `git stash pop`
4. Resolve conflicts manually if needed

### Skill Not Found

1. Verify skill exists: `ls plugin/skills/{skill-name}`
2. Check spelling (case-sensitive)
3. Report error and skip to next skill

---

## Progress Tracking

Willie tracks progress via git commits. To review:

```bash
# See all willie improvements
git log --oneline --grep="willie:"

# See specific skill history
git log --oneline -- plugin/skills/{skill-name}/SKILL.md

# See diff for a commit
git show {commit-hash}
```
