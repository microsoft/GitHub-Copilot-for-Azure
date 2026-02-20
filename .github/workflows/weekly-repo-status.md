---
description: |
  This workflow creates weekly repo status reports. It gathers recent repository
  activity (issues, PRs, discussions, releases, code changes) and generates
  engaging GitHub issues with productivity insights, community highlights,
  and project recommendations.

on:
  schedule:
    - cron: "0 18 * * 5"
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

network: defaults

tools:
  github:
    # If in a public repo, setting `lockdown: false` allows
    # reading issues, pull requests and comments from 3rd-parties
    # If in a private repo this has no particular effect.
    lockdown: false

safe-outputs:
  create-issue:
    title-prefix: "[repo-status] "
    labels: [report, weekly-status]
source: githubnext/agentics/workflows/daily-repo-status.md@3a74730dbaddf484a9002a4bf34cd588cace7767
engine: copilot
---

# Weekly Repo Status

Create an upbeat weekly status report for the repo as a GitHub issue.

## What to include

- Recent repository activity (issues, PRs, discussions, releases, code changes)
- Progress tracking, goal reminders and highlights
- Project status and recommendations
- Actionable next steps for maintainers

## Required Stats

Include the following statistics for the current week (since last Friday):

### Issues
- **Weekly issues opened** — total count, and a breakdown by skill (e.g. azure-deploy, azure-prepare, azure-validate, etc.); issues not specific to any individual skill should be grouped under **extension**
- **Weekly issues closed** — total count with links to each closed issue (no duplicates); likewise group non-skill issues under **extension**

### Pull Requests
- **PRs created and in progress** — count of new PRs opened this week that are still open
- **PRs merged and closed** — count of PRs that were merged or closed this week
- **PRs discarded** — count of PRs closed without merging (abandoned/rejected)

> Do not include duplicate issue or PR links. Each issue/PR should appear at most once.

## Style

- Be positive, encouraging, and helpful 🌟
- Use emojis moderately for engagement
- Keep it concise - adjust length based on actual activity

## Process

1. Gather recent activity from the repository for the past 7 days
2. Study the repository, its issues and its pull requests
3. Collect closed issues from this week and group opened issues by skill label
4. Tally PR counts: merged/closed vs. open vs. discarded (closed without merge)
5. Create a new GitHub issue with your findings, stats, and insights