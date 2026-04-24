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
/plugin marketplace add microsoft/azure-skills
```

#### 2. Install the Azure Plugin

Install the Azure plugin:

```
/plugin install azure@azure-skills
```

---

## Local Development Setup

To develop and test skills locally, you build the plugin from source and point Copilot CLI at the build output.

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/GitHub-Copilot-for-Azure.git
cd GitHub-Copilot-for-Azure
```

### 2. Build the Plugin

Install dependencies and run the build. This copies the plugin source files into `output/`, stamping version numbers automatically via [Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning).

```bash
npm install
npm run build
```

The `output/` directory now contains the fully built plugin, ready for use.

### 3. Run Copilot CLI with the Local Plugin

Use the `--plugin-dir` flag to point Copilot CLI at your build output:

```bash
copilot --plugin-dir ./output
```

This loads the locally built plugin instead of any marketplace-installed version.

### 4. Reloading Skills After Changes

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

> **Tip:** Use `/skills reload` after rebuilding for faster iteration during development.

### 5. Testing Pull Requests Locally

You can quickly test any open pull request by checking out its branch and building. This is especially useful during code review to verify changes work as expected.

#### Using GitHub CLI

Install the [GitHub CLI](https://cli.github.com/) if you haven't already, then run:

```bash
gh pr checkout <PR-NUMBER>
npm run build
copilot --plugin-dir ./output
```

For example, to test PR #42:

```bash
gh pr checkout 42
npm run build
copilot --plugin-dir ./output
```

#### Switching Back

To return to the main branch after testing:

```bash
git checkout main
npm run build
```

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

> ⚠️ Char count of skill descriptions in this repo is close to the char count budget in tools like Copilot CLI. Exceeding the char count budget may result in any skill being truncated at runtime, causing inconsistent agent behavior. Consider adding the new content to an existing skill or rebrand an existing skill to cover the new content.

_NOTE:_ You can use the "Azure Skill Brainstormer", "Azure Skill Creator", or "Skill Fixer" agents in Copilot to help you build and maintain skills. They are recognizable across all github copilot agent hosts, such as Copilot Coding Agent, Copilot CLI and VSCode copilot chat.
- The Creator agent expects you already know what scenarios the skill should address
- The Brainstormer agent will help you identify scenarios
- The Skill Fixer agent works on your skills related tasks and follows rules it was pre-configured with, such as skill version bumping.

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

1. Rebuild the plugin: `npm run build`
2. Start Copilot CLI with `copilot --plugin-dir ./output`
3. Run `/skills reload` if you already have a session open
4. Test the skill by asking relevant questions
5. Verify all referenced documentation and examples work

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
