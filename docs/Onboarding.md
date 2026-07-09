# Onboarding

> Note: if you are an MSFT employee, in addition to following the steps in this doc, please also follow the steps in the [internal-onboarding-doc](https://eng.ms/docs/cloud-ai-platform/devdiv/developer-ai-lukehoban/developer-ai-kvenkatrajan/azure-github-copilot-extension-for-vs-code-backend/github-copilot-for-azure/partnerhub/azureskills/onboarding-new-skills) to onboard your new skill.

## Identify Areas for New Skills

Skills should be concise and focused prompts that help with a specific task. The LLM sees the descriptions of the skills and decides which one to load based on the user's intent. They can be treated as additional user prompts.

A good skill has the following characteristics:

- A good skill has a clear objective for a specific task. This allows the skill to be reliably triggered by user prompts asking the agent to execute the target task. Skills without clear objectives or that do not focus on a specific task introduce unnecessary ambiguity, causing the LLM to not load them at the right time.
- A good skill enables the agent to execute all the necessary steps to complete the target task. Skills combine non-deterministic LLM inference with deterministic logic by asking the agent to call tools or execute pre-written scripts.
- A good skill respects the shared context window by optimizing its token consumption. A skill's description is loaded up-front for all sessions. As the agent loads more of its content, it consumes more tokens.
- A good skill improves the agent outcome. Users frequently ask the agent to complete a task without giving execution details. Compared to when there is no such skill, a good skill reduces ambiguity by giving the agent instructions to follow and pre-written scripts to use. This reduces the chance for the agent to go off the rails.

If you have a new skill candidate that improves the agent outcome for an Azure-related task, you are welcome to contribute your new skill to this repo.

### Submit Onboarding Request

If you want to add a new skill, please submit an onboarding issue following this template [skill-onboarding-issue](/.github/ISSUE_TEMPLATE/skill_onboarding_request.yml) describing what you plan to add. If you want to extend an existing skill, please submit an onboarding issue following this template [skill-extension-issue](/.github/ISSUE_TEMPLATE/skill_extension_request.yml).

We will triage your onboarding request and provide feedback. We encourage you to build a simple version of the skill as a proof of concept. However, since we may request changes, we recommend that you wait for our feedback before diving into implementing the full skill.

## Local Development

Before making code changes, ensure you have the following installed:

- [Git](https://git-scm.com/downloads)
- [Node.js 22+](https://nodejs.org) and NPM
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)

We encourage you to develop in a fork and submit PRs back to the upstream repo, instead of working directly in this repo. Use the following command to fork this repo and open your fork locally.

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/GitHub-Copilot-for-Azure.git
cd GitHub-Copilot-for-Azure
```

### Skill Structure

Skills in this repo are organized in an agent plugin. Pre-built skills are located under `plugin/skills/`. Each skill folder contains:

```
plugin/skills/your-skill-name/
├── SKILL.md              # Main skill definition (required)
├── LICENSE.txt           # License file (if applicable)
├── references/           # Additional reference documentation
│   └── *.md
└── scripts/              # Helper scripts
    └── *
```

You should add your new skill as one of the pre-built skills.

1. **Create your skill folder** under `plugin/skills/your-skill-name/`
2. **Write your SKILL.md** following the existing patterns
    - Use [sensei](/.github/skills/sensei/SKILL.md) to assist with writing the frontmatter
    - Use [skill-authoring](/.github/skills/skill-authoring/SKILL.md) to assist with writing the SKILL.md and references.

> ⚠️ Char count of skill descriptions in this repo is close to the char count budget in tools like Copilot CLI. Exceeding the char count budget may result in skills being truncated at runtime, causing inconsistent agent behavior. Consider adding the new content to an existing skill or rebrand an existing skill to cover the new content.

To build the skills for testing, install dependencies and run the build. This copies the plugin source files into `output/`, stamping version numbers automatically via [Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning).

```bash
npm install
npm run build
```

The `output/` directory now contains the fully built plugin, ready for use.

### Token Management

AI agents load skill content into their context window, which has finite capacity. Large skills:
- Consume context space needed for user conversations
- Slow down agent response times
- May get truncated, losing important instructions

We recommend skills to respect these token limits.

| File Type | Limit | Action if Exceeded |
|-----------|------------|-------------------|
| SKILL.md | <5000 tokens | Move content to `references/` |
| references/*.md | <2000 tokens | Split into multiple files |

Token estimation: **~4 characters = 1 token**

### Testing

Tests should be performed on the built skills in the `output/` directory.

### Automated Testing with Vally

In this repo, we use [Vally](https://microsoft.github.io/vally/) to programmatically test skills with a Copilot SDK agent. Every skill must have routing tests that check if the skill can be invoked when the agent receives user prompts related to the target task and end-to-end integration tests that validate if the skill improves the agent outcome in the expected way.

Use [vally-eval](/.github/skills/vally-eval/SKILL.md) to assist implementing vally eval suites for the new skill. The vally-eval skill can teach you how to implement the vally eval suites, hook them to the nightly integration test system for nightly runs and get results of the nightly integration tests.

Use [sensei](/.github/skills/sensei/SKILL.md) to refine the frontmatter to pass the routing tests.

### Manual Testing with Copilot CLI

Use the `--plugin-dir` flag to point Copilot CLI at your build output:

```bash
copilot --plugin-dir ./output
```

This loads the locally built plugin instead of any marketplace-installed version. Then prompt the Copilot CLI agent to perform a task and see how the skill is used.

After making changes to skill files under `plugin/`:

1. **Rebuild** the plugin to update the `output/` directory:
   ```bash
   npm run build
   ```
2. **In an active Copilot CLI session**, run:
   ```
   /skills reload
   ```
   This reloads all skills without restarting the CLI.
3. **Alternatively**, restart the Copilot CLI to pick up changes.

## Submitting Changes

Before submitting a PR for adding the new skill, run the vally eval suites of the new skill and make sure the results indicate the new skill has the characteristics of a good skill. Run these scripts to catch and fix minor issues that would be flagged by CI.

```bash
# in repo root
npx --yes @microsoft/vally-cli@^0.7.0 lint plugin/skills/ --eval-spec evals/ --strict --grader-plugin ./tests/vally/vally-graders.ts

# in tests/
npm run typecheck
npm run lint

# in scripts/
npm run lint
npm run checkCopilotCliCharBudget
npm run vally validate-stimulus
```

When submitting the PR, prefix the PR title with `feature:` and link the PR to your onboarding issue.

## Releasing

Once a skill is merged, it will be synced to the [azure-skills](https://github.com/microsoft/azure-skills) repo. Users will install the skills by installing the `azure` plugin from the azure-skills repo. For example, in Copilot CLI:

```bash
# Copilot CLI
/plugin marketplace add microsoft/azure-skills
/plugin install azure@azure-skills
```
