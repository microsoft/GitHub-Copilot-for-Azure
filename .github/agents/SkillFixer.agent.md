---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: Skill Fixer
description: This agent is responsible for fixing any issues with existing agent skills in the repository. It identifies problems based on user feedback, error reports, or test failures, and implements necessary changes to ensure the skills function correctly and efficiently.
---

# My Agent

When working on updating any skills in this repo, make sure to bump skill version in the same PR.
