# Contributing to GitHub Copilot for Azure

Thank you for your interest in contributing to GitHub Copilot for Azure! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any questions or comments.

## Ways to Contribute

- **Report bugs** - File issues for bugs you encounter
- **Request features** - Suggest new features or improvements
- **Submit pull requests** - Contribute code, documentation, or skills
- **Create skills** - Build new Azure skills to extend functionality
- **Improve documentation** - Help make our docs clearer and more comprehensive

## Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- [Git](https://git-scm.com/downloads)
- [Node.js 18+](https://nodejs.org) and NPM
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)

### First-Time Setup

#### 1. Add the Plugin Marketplace

In GitHub Copilot CLI, add the plugin marketplace:

```
/plugin marketplace add microsoft/github-copilot-for-azure
```

#### 2. Install the Azure Plugin

Install the Azure plugin:

```
/plugin install azure@github-copilot-for-azure
```

---

## Local Development Setup

To develop and test skills locally, you'll need to link your cloned repository to the installed plugins folder. This allows you to make changes and see them reflected immediately without reinstalling the plugin.

> **Important:** Do NOT run `/plugin install azure@github-copilot-for-azure` when developing locally. The symlink setup below IS the installation. Running the install command would create a nested copy that shadows your local changes.

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/GitHub-Copilot-for-Azure.git
cd GitHub-Copilot-for-Azure
```

### 2. Install Dependencies

```bash
cd scripts
npm install
cd ..
```

### 3. Set Up Local Development (Recommended)

The easiest way to set up local development is using the provided scripts:

```bash
# From the repository root
cd scripts

# Create the symlink
npm run local setup

# Verify the setup is correct
npm run local verify
```

The setup script will:
- Create a symlink from `~/.copilot/installed-plugins/github-copilot-for-azure` to your local `plugin/` folder
- Handle Windows junction fallback if admin privileges aren't available

The verify script will:
- Check for nested plugin installs (which shadow your local changes)
- Test that file changes propagate correctly via the symlink
- Compare file contents between local and installed locations

Use `npm run local verify --fix` to automatically fix common issues.

### 3b. Manual Symlink Setup (Alternative)

If you prefer to create the symlink manually:

#### Windows (Command Prompt - Run as Administrator)

```cmd
mklink /J "%USERPROFILE%\.copilot\installed-plugins\github-copilot-for-azure" "C:\path\to\GitHub-Copilot-for-Azure\plugin"
```

#### Windows (PowerShell - Run as Administrator)

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\installed-plugins\github-copilot-for-azure" -Target "C:\path\to\GitHub-Copilot-for-Azure\plugin"
```

#### macOS / Linux

```bash
ln -s ~/path/to/GitHub-Copilot-for-Azure/plugin ~/.copilot/installed-plugins/github-copilot-for-azure
```

> **Note:** Replace the paths above with your actual cloned repository location.

### 4. Reloading Skills After Changes

After making changes to skills:

1. **In an active Copilot CLI session**, run:
   ```
   /skills reload
   ```
   This reloads all skills without restarting the CLI.

2. **Alternatively**, restart the GitHub Copilot CLI to pick up changes.

> **Tip:** Use `/skills reload` for faster iteration during development.

### 5. Verify the Symlink

Verify that the symlink was created correctly:

```bash
# Using the verify script (recommended)
cd scripts
npm run local verify

# Or manually:
# Windows (PowerShell)
Get-ChildItem "$env:USERPROFILE\.copilot\installed-plugins" | Format-List

# macOS / Linux
ls -la ~/.copilot/installed-plugins/
```

You should see `github-copilot-for-azure` pointing to your cloned repository's `plugin` folder.

### 6. Remove an Existing Symlink (If Needed)

If you need to remove or recreate a symlink:

#### Windows (Command Prompt - Run as Administrator)
```cmd
rmdir "%USERPROFILE%\.copilot\installed-plugins\github-copilot-for-azure"
```

#### Windows (PowerShell - Run as Administrator)
```powershell
Remove-Item "$env:USERPROFILE\.copilot\installed-plugins\github-copilot-for-azure" -Force
```

#### macOS / Linux
```bash
rm ~/.copilot/installed-plugins/github-copilot-for-azure
```

### 7. Testing Pull Requests Locally

Once your symlink is set up, you can quickly test any open pull request by checking out its branch. This is especially useful during code review to verify changes work as expected.

#### Using GitHub CLI

Install the [GitHub CLI](https://cli.github.com/) if you haven't already, then run:

```bash
gh pr checkout <PR-NUMBER>
```

For example, to test PR #42:

```bash
gh pr checkout 42
```

This automatically:
1. Fetches the PR branch from the contributor's fork
2. Creates a local branch tracking the PR
3. Updates your symlinked plugin folder with the PR's changes

After checking out, run `/skills reload` in your Copilot CLI session (or restart the CLI) to pick up the changes and test the skill or feature.

#### Switching Back

To return to the main branch after testing:

```bash
git checkout main
```

> **Tip:** You can also use `gh pr checkout <PR-NUMBER> --force` to discard any local changes and switch to the PR branch.

---

## Contributing Skills

Skills are the core building blocks of GitHub Copilot for Azure. Each skill provides domain-specific knowledge and capabilities.

### Skill Structure

Skills are located under `plugin/skills/`. Each skill folder should contain:

```
plugin/skills/your-skill-name/
├── SKILL.md              # Main skill definition (required)
├── LICENSE.txt           # License file (if applicable)
├── references/           # Additional reference documentation
│   └── *.md
├── examples/             # Example code and templates
│   └── *
└── scripts/              # Helper scripts
    └── *
```

### Creating a New Skill

_NOTE:_ If you open the repo in VS Code, you can use the "Azure Skill Brainstormer" or "Azure Skill Creator" agents in Copilot to help you build out an initial version of the skill.
- The Creator agents expects you already know what scenarios the skill should address
- The Brainstormer agent will help you identify scenarios

1. **Create your skill folder** under `plugin/skills/your-skill-name/`

2. **Write your SKILL.md** following the existing patterns in other skills

3. **Provide context** in your skill:
   - Links to relevant Azure documentation
   - Descriptions of MCP or command-line tools to include
   - Example use cases and scenarios

### Skill Guidelines

- Keep skills focused on a specific Azure service or capability
- The `description` frontmatter should:
   - be short
   - describe _what_ the skill does and _when_ to use it
   - include trigger phrases (see existing skills for examples)
- Focus on one "golden path" rather than providing multiple approaches
- To ensure consistency across skills, prefer Azure MCP tools (for data collection operations) and `azd` (for deployment) over `az`.
- Include practical examples and common use cases
- Reference official Microsoft documentation
- Test your skill thoroughly before submitting
- **Follow the [Agent Skills Specification](https://agentskills.io/specification)**
- See [.github/skills/skill-authoring/SKILL.md](.github/skills/skill-authoring/SKILL.md) for detailed guidelines

### Running Sensei for Compliance

**Sensei** is an automated tool that improves skill frontmatter compliance using the Ralph loop pattern. It iteratively refines skills until they reach **Medium-High** compliance with passing tests.

#### When to Run Sensei

| Use Case | Command |
|----------|---------|
| Before committing a new skill | `Run sensei on <skill-name>` |
| After updating skill description/triggers | `Run sensei on <skill-name>` |
| Fast iteration (skip integration tests) | `Run sensei on <skill-name> --skip-integration` |
| Audit multiple skills | `Run sensei on <skill1>, <skill2>` |
| Audit all Low-adherence skills | `Run sensei on all Low-adherence skills` |

#### Usage

In your Copilot CLI session, invoke the sensei skill:

```
Run sensei on azure-deploy
```

Sensei will analyze the skill and produce an assessment:

```
## 📊 SENSEI ASSESSMENT: azure-deploy

### Current State

**Frontmatter:**
name: azure-deploy
description: "Execute Azure deployments after preparation and validation are complete.
  USE FOR: azd up, azd deploy, push to Azure, publish to Azure, ship to production...
  DO NOT USE FOR: preparing new apps (use azure-prepare), validating before deploy..."

### Scoring

| Criteria | Status | Notes |
|----------|--------|-------|
| Description > 150 chars | ✅ | ~540 chars |
| Has "USE FOR:" triggers | ✅ | 14 trigger phrases |
| Has "DO NOT USE FOR:" | ✅ | 3 anti-triggers with redirects |
| Description < 1024 chars | ✅ | ~540 chars |
| SKILL.md < 500 tokens | ✅ | ~450 tokens estimate |
| Tests exist | ✅ | Unit, trigger, and integration tests |

### **Score: Medium-High** ✅
```

After improvements, sensei displays a before/after summary:

```
## 📊 SENSEI SUMMARY: azure-deploy

| Aspect | Before | After |
|--------|--------|-------|
| **Score** | Medium-High | Medium-High ✅ |
| **Test Files** | 1 (integration only) | 3 (unit + triggers + integration) |
| **Tests Passing** | N/A | 43/43 ✅ |
```

Sensei then prompts you to **Commit**, **Create Issue**, or **Skip**.

#### Test Scaffolding

If tests don't exist for your skill, sensei automatically scaffolds them from the `tests/_template/` directory:

- `triggers.test.ts` - Tests that verify skill triggers on appropriate prompts
- `unit.test.ts` - Tests for skill metadata and content validation

The scaffolded tests include parameterized test cases for:
- **Should Trigger** prompts - phrases that should activate the skill
- **Should NOT Trigger** prompts - phrases that should not activate (anti-triggers)

> **Note:** Tests must pass before sensei prompts for action. Review and adjust the generated test prompts to match your skill's actual triggers.

#### Running Integration Tests

After sensei completes, run integration tests to verify skill invocation:

```bash
cd tests
npm run test:integration -- --testPathPattern=<skillname>
```

**Example output:**

```
PASS azure-deploy/integration.test.ts
  azure-deploy - Integration Tests
    ✓ invokes azure-deploy skill for deployment prompt
    ✓ invokes azure-deploy skill for publish to Azure prompt
    ✓ creates whiteboard application and deploys to Azure
    ✓ creates discussion board and deploys to Azure
    ✓ creates todo list with frontend and API and deploys to Azure

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

> **Prerequisites:** Integration tests require `@github/copilot-cli` installed and authenticated. Some tests may require `azd auth login`.

#### Scoring Metrics

Sensei evaluates skills against these compliance levels:

| Score | Requirements |
|-------|--------------|
| **Low** | Description < 150 chars (always Low), OR missing explicit triggers/anti-triggers |
| **Medium** | Description ≥ 150 chars, has trigger keywords/phrases, may lack full `USE FOR:`/`DO NOT USE FOR:` structure |
| **Medium-High** ⭐ | Has `USE FOR:` triggers AND `DO NOT USE FOR:` anti-triggers |
| **High** | Medium-High + `compatibility` field documenting requirements |

**Target: Medium-High** - All skills should have explicit triggers and anti-triggers.

**Token Budgets:**

| File | Soft Limit | Hard Limit |
|------|------------|------------|
| SKILL.md | 500 tokens | 5000 tokens |
| Description | — | 1024 chars |

---

> **📚 Reference:** See [sensei skill](.github/skills/sensei/SKILL.md) for full documentation, including the complete Ralph loop workflow and detailed scoring criteria. Related: [skill-authoring](.github/skills/skill-authoring/SKILL.md), [markdown-token-optimizer](.github/skills/markdown-token-optimizer/SKILL.md).

### Token Management

#### Why Token Limits?

AI agents load skill content into their context window, which has finite capacity. Large skills:
- Consume context space needed for user conversations
- Slow down agent response times
- May get truncated, losing important instructions

The [agentskills.io specification](https://agentskills.io/specification) recommends keeping SKILL.md under 5000 tokens, with detailed content in `references/` directories that load on-demand.

#### Token Limits

| File Type | Soft Limit | Hard Limit | Action if Exceeded |
|-----------|------------|------------|-------------------|
| SKILL.md | 500 tokens | 5000 tokens | Move content to `references/` |
| references/*.md | 1000 tokens | 2000 tokens | Split into multiple files |
| docs/*.md | 1500 tokens | 3000 tokens | Restructure content |

Token estimation: **~4 characters = 1 token**

#### Commands

Run these from the repository root:

```bash
# First time setup (installs dependencies)
npm install

# Show help and available commands
npm run tokens help

# Count tokens in all markdown files
npm run tokens count

# Check all markdown files against token limits
npm run tokens check

# Get optimization suggestions
npm run tokens suggest                    # All files
npm run tokens suggest -- docs/           # Specific directory
npm run tokens suggest -- path/to/file.md # Specific file

# Compare token counts between git refs
npm run tokens compare                           # HEAD vs main
npm run tokens compare -- --base HEAD~1          # vs previous commit
npm run tokens compare -- --base feature-branch  # vs specific branch
```

**Example output from `npm run tokens compare`:**

```
📊 TOKEN CHANGE REPORT
══════════════════════════════════════════════════════════════════════
Comparing: main → HEAD
──────────────────────────────────────────────────────────────────────

📈 Total Change: +350 tokens (+5%)
   Before: 7,000 tokens
   After:  7,350 tokens
   Files:  3 modified, 1 added, 0 removed

Changed Files:
──────────────────────────────────────────────────────────────────────
🆕 plugin/skills/my-new-skill/SKILL.md
   0 → 450 tokens [+450 (+100%)]
📈 plugin/skills/existing-skill/SKILL.md
   500 → 600 tokens [+100 (+20%)]
```

**Example output from `npm run tokens check`:**

```
📊 Token Limit Check
════════════════════════════════════════════════════════════
Files Checked: 83
Files Exceeded: 5

⚠️  Files exceeding limits:
────────────────────────────────────────────────────────────
  ❌ plugin/skills/my-skill/SKILL.md
     850 tokens (limit: 500, over by 350)
     Pattern: SKILL.md

💡 Tip: Move detailed content to references/ subdirectories
```

#### CI Integration

Pull requests automatically run token analysis which includes:

1. **Token Comparison** - Shows token changes between your PR and the base branch
   - Total token increase/decrease with percentage
   - Per-file breakdown of changes
   - Highlights files with significant increases (>20%)

2. **Limit Check** - Warns if any files exceed their token limits

The bot will comment on your PR with a combined report. Address warnings by:

1. Moving detailed content to `references/` subdirectory
2. Using tables instead of verbose lists
3. Removing decorative elements (excessive emojis, redundant headers)
4. Linking to external documentation instead of duplicating it

See [markdown-token-optimizer](.github/skills/markdown-token-optimizer/SKILL.md) skill for optimization techniques.

---

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with clear, descriptive messages:
   ```bash
   git add .
   git commit -m "Add: Description of your changes"
   ```

3. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** against the `main` branch

5. **Address review feedback** and ensure all checks pass

### Commit Message Guidelines

Use clear, descriptive commit messages:

- `Add: New azure-cosmos-db skill`
- `Fix: Correct authentication example in plugin README`
- `Update: Improve Azure Functions deployment docs`
- `Remove: Deprecated references from skill`

### Pull Request Checklist

- [ ] Changes are tested locally
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages are clear and descriptive
- [ ] No breaking changes (or breaking changes are documented)
- [ ] Skills follow the established patterns

---

## Reporting Issues

### Before Filing an Issue

1. Search [existing issues](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues) to avoid duplicates
2. Check the [Troubleshooting guide](./Troubleshooting.md)
3. Verify you're using the latest version

### Filing a Bug Report

Include the following information:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Numbered steps to reproduce the bug
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, GitHub Copilot CLI version
- **Logs/Screenshots**: Any relevant error messages or screenshots

### Requesting Features

For feature requests, include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your suggested approach
- **Alternatives**: Any alternatives you've considered

---

## Development Tips

### Testing Changes

After making changes to a skill:

1. Run `/skills reload` in your Copilot CLI session to reload all skills
2. Test the skill by asking relevant questions
3. Verify all referenced documentation and examples work

> **Tip:** Use `/skills reload` instead of restarting the CLI for faster iteration during development.

### Debugging

- Review the [Troubleshooting guide](./Troubleshooting.md) for common issues
- Use verbose logging when available

### Staying Updated

Keep your fork in sync with the upstream repository:

```bash
# Add upstream remote (one-time setup)
git remote add upstream https://github.com/microsoft/GitHub-Copilot-for-Azure.git

# Fetch and merge upstream changes
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Questions?

- Check the [README](./README.md) for general information
- Review the [Troubleshooting guide](./Troubleshooting.md) for common issues
- Search or file [GitHub Issues](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues)

Thank you for contributing to GitHub Copilot for Azure! 🚀
