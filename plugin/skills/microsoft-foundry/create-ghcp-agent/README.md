# create-agent-from-skill

Claude Code skill to create custom GitHub Copilot agents with your own skills for deployment to Azure AI Foundry.

## What It Does

This skill automates the creation of a fully configured GitHub Copilot hosted agent using your custom Claude Code skills. It:

- Creates a complete deployment structure using bundled template files (included with skill)
- Copies your custom skills into the agent
- Configures GitHub authentication
- Generates all necessary configuration and documentation files
- Optionally deploys the agent to Azure AI Foundry

**Templates Included**: The skill bundles all necessary template files (main.py, Dockerfile, agent.yaml, requirements.txt, azure.yaml) so no external dependencies are required.

## Quick Start

```
/create-agent-from-skill
```

The skill will guide you through:
1. Selecting your skills directory
2. Naming your agent
3. Providing a description
4. Configuring GitHub authentication
5. Choosing whether to deploy immediately

## Prerequisites

### Required
- Custom Claude Code skills (directories with SKILL.md files)
- GitHub Personal Access Token with Copilot API access

### For Deployment (Optional)
- Azure subscription
- Azure Developer CLI (azd) installed
- Docker (for local testing)

## What You Get

After running this skill, you'll have a complete deployment package:

```
my-agent-deployment/
├── src/my-agent/
│   ├── main.py                # Agent implementation
│   ├── agent.yaml             # Agent configuration
│   ├── .env                   # GitHub token
│   ├── Dockerfile             # Container config
│   ├── requirements.txt       # Dependencies
│   ├── README.md              # Agent documentation
│   └── skills/                # Your custom skills
│       ├── skill-1/
│       └── skill-2/
├── azure.yaml                 # Deployment config
└── README.md                  # Deployment guide
```

## How It Works

### Skills Auto-Discovery

The generated agent automatically discovers and loads skills from the `skills/` directory. No code modifications needed - just add or remove skill directories and restart the agent.

### Configuration

The agent is configured via three key files:

1. **agent.yaml** - Defines agent metadata, description, and required environment variables
2. **azure.yaml** - Configures Azure deployment settings (resources, scaling)
3. **.env** - Contains GitHub token for local development

### Deployment Options

**Option 1: Deploy immediately**
- Choose "Yes" when asked about deployment
- The skill invokes `/deploy-agent-to-foundry` automatically
- Guided through Azure setup and deployment

**Option 2: Deploy later**
- Choose "No" and deploy manually when ready
- Use `/deploy-agent-to-foundry` skill
- Or use Azure Developer CLI commands directly

## Examples

### Example 1: Support Bot

Create an agent with customer support skills:

```
Skills directory: ./support-skills
Agent name: support-bot
Description: Customer support agent with ticketing and knowledge base skills
Skills included:
- create-ticket
- search-kb
- escalate-issue
```

### Example 2: DevOps Assistant

Create an agent with deployment and monitoring skills:

```
Skills directory: ./devops-skills
Agent name: devops-assistant
Description: DevOps automation agent for deployments and monitoring
Skills included:
- deploy-service
- check-health
- view-logs
- rollback-deployment
```

### Example 3: Research Agent

Create an agent with research and analysis skills:

```
Skills directory: .claude/skills
Agent name: research-agent
Description: Research assistant with document analysis and summarization
Skills included:
- search-papers
- summarize-document
- compare-sources
```

## Validation

The skill validates all inputs before creating files:

- **Skills directory**: Must exist and contain valid SKILL.md files
- **Agent name**: Must follow kebab-case format (lowercase, hyphens only)
- **Name conflicts**: Checks for existing directories
- **GitHub token**: Warns if format appears invalid
- **Template**: Verifies bundled template files exist (included with skill)

## Local Testing

Test your agent locally before deploying:

```bash
cd my-agent-deployment/src/my-agent

# Install dependencies
pip install -r requirements.txt

# Set GitHub token
export GITHUB_TOKEN=your_token_here

# Run the agent
python main.py
```

## Deployment

### With Claude Code Skill (Recommended)

```bash
cd my-agent-deployment
# Use /deploy-agent-to-foundry in Claude Code
```

### Manual Deployment

```bash
cd my-agent-deployment

# Initialize Azure environment
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic

# Initialize AI agent
azd ai agent init -m src/my-agent/agent.yaml

# Deploy to Azure
azd up
```

## Managing Your Agent

### Add More Skills

1. Copy skill directories into `src/my-agent/skills/`
2. Redeploy: `azd deploy`
3. Skills are automatically discovered

### Update Agent Configuration

1. Edit `src/my-agent/agent.yaml`
2. Redeploy: `azd deploy`

### View Deployment Status

```bash
cd my-agent-deployment
azd show
```

### View Logs

```bash
azd monitor
```

### Delete Deployment

```bash
azd down
```

## Troubleshooting

### Skills Not Found

**Problem**: "No valid skills found in directory"

**Solutions**:
- Ensure each skill is in its own subdirectory
- Verify each skill has a SKILL.md file
- Check SKILL.md has proper frontmatter (name, description)

### Invalid Agent Name

**Problem**: "Invalid agent name format"

**Solutions**:
- Use lowercase letters only
- Use hyphens to separate words (kebab-case)
- No spaces, underscores, or special characters
- Examples: `my-agent`, `support-bot`, `dev-assistant`

### GitHub Token Issues

**Problem**: "Invalid GitHub token format"

**Solutions**:
- Token should start with `ghp_` (classic) or `github_pat_` (fine-grained)
- Generate token at: https://github.com/settings/tokens
- Ensure token has Copilot API access
- Token is stored in .env file for local dev, Azure Key Vault for production

### Directory Conflicts

**Problem**: "Directory already exists"

**Solutions**:
- Choose a different agent name
- Remove existing directory: `rm -rf my-agent-deployment`
- Use a suffix: `my-agent-2`, `my-agent-new`

### Template Not Found

**Problem**: "Template files not found"

**Solutions**:
- Template files are bundled with the skill at `.claude/skills/create-agent-from-skill/template/`
- If missing, reinstall the skill
- Check that main.py, Dockerfile, agent.yaml, requirements.txt, azure.yaml exist in template/

## Technical Details

### Architecture

The agent uses the GitHub Copilot API to provide AI-powered assistance:

1. **CopilotClient** - Connects to GitHub Copilot API
2. **Session Management** - Maintains conversation state
3. **Skills Integration** - Auto-discovers and loads skills
4. **Streaming Responses** - Provides real-time AI responses

### Skills Auto-Discovery

The main.py file automatically discovers skills (lines 24-25, 78):

```python
SKILLS_DIR = (CURRENT_DIR / 'skills').resolve()
# Later...
"skill_directories": [str(SKILLS_DIR)]
```

This means:
- No code modifications needed for new skills
- Just add/remove directories in skills/
- Agent automatically finds and loads them
- Skills available in every Copilot session

### Infrastructure

The `infra/` directory is created by `azd init`, not this skill:
- Contains environment-specific settings
- Managed by Azure Developer CLI
- Generated from Azure templates
- Prevents hardcoded values

## Related Skills

- **deploy-agent-to-foundry** - Deploy your agent to Azure AI Foundry
- **create-agent-framework-agent** - Create agent using agent-framework (alternative template)
- **create-and-deploy-agent** - Combined creation and deployment workflow

## Additional Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-foundry/)
- [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [GitHub Copilot API](https://docs.github.com/en/copilot)
- [Claude Code Skills](https://docs.anthropic.com/claude/docs/skills)

## Support

For issues with:
- **This skill**: Check SKILL.md for detailed workflow
- **Deployment**: Use `/deploy-agent-to-foundry` or see its documentation
- **Azure**: Consult Azure AI Foundry documentation
- **Skills format**: See Claude Code skills documentation

---

Part of the Claude Code skills library for Azure AI Foundry agent deployment.
