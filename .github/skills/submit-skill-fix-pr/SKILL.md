---
name: submit-skill-fix-pr
description: "Submit a pull request with skill fixes. Validates skill structure, bumps versions, and creates a PR with a proper description. TRIGGERS: submit skill fix, create fix PR, skill fix pull request, submit PR, push skill fix"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Submit Skill Fix PR

Creates a pull request after committing skill fixes in `microsoft/GitHub-Copilot-for-Azure`.

## When to Use This Skill

- You have committed skill fixes and need to submit a PR
- You need to validate skill structure before pushing
- You want to create a properly formatted fix PR

## Steps

1. Install NPM dependencies in the `scripts` directory, if necessary.
2. From the `scripts` directory run `npm run frontmatter` and `npm run references` to validate the skill structure. Fix and commit any problems.
3. Ensure that skill version has been bumped for any updated SKILL.md.
4. Push the branch to origin and create a PR into upstream. The PR description should include:
   1. A brief description of the problem(s).
   2. A brief description of the fix(es) and how they address the problems.
   3. A "Fixes #<issue_number>" note. Ask the user if you don't know the issue number.
