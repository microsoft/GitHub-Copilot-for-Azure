---
name: investigate-integration-test
description: "Investigate a failing integration test from a GitHub issue. Downloads logs/artifacts, analyzes the failure, examines relevant skills, and suggests fixes. TRIGGERS: investigate integration test, debug integration test, failing integration test, test failure investigation, diagnose test failure, analyze test issue"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Integration Test Investigation

Investigates a failing integration test given a GitHub issue in `microsoft/GitHub-Copilot-for-Azure`.

## When to Use This Skill

- A GitHub issue links to a failing integration test run
- You need to diagnose why an integration test is failing
- You want to understand a test failure before implementing a fix

## Steps

1. Read the GitHub issue.
2. Download the test logs and artifacts from the linked run.
3. Look through the logs/artifacts and analyze the test with the prompt specified in the issue to diagnose the failure.
4. Examine the relevant skills under `plugin/skills` for context.
5. Offer a suggested fix for each identified problem. Do not implement any fixes without the user's approval.
