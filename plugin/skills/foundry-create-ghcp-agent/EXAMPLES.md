# create-agent-from-skill Examples

This document provides detailed examples of using the create-agent-from-skill skill to create custom GitHub Copilot agents with different types of skills.

## Example 1: Customer Support Agent

### Scenario

You have a collection of customer support skills and want to create an agent that can help with ticketing, knowledge base searches, and issue escalation.

### Skills Directory Structure

```
support-skills/
├── create-ticket/
│   ├── SKILL.md
│   └── README.md
├── search-knowledge-base/
│   ├── SKILL.md
│   └── README.md
├── escalate-issue/
│   ├── SKILL.md
│   └── README.md
└── check-ticket-status/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Custom path → `/home/user/projects/support-skills`
   - **Agent name**: Custom name → `customer-support-agent`
   - **Description**: Custom description → `AI-powered customer support agent with ticketing, knowledge base search, and escalation capabilities. Helps customers resolve issues and manages support workflow.`
   - **GitHub token**: Enter token → `ghp_xxxxxxxxxxxx`
   - **Deploy now?**: No, I'll deploy later

3. **Result**:
   ```
   Agent Created Successfully!

   Agent Name: customer-support-agent
   Location: /home/user/projects/customer-support-agent-deployment
   Skills Included: 4

   Skills:
   - create-ticket: Create and manage customer support tickets
   - search-knowledge-base: Search internal knowledge base for solutions
   - escalate-issue: Escalate issues to senior support or engineering
   - check-ticket-status: Check status and history of support tickets

   Next Steps:
   To deploy your agent:

   Option 1 (Recommended):
     cd customer-support-agent-deployment
     # Use /deploy-agent-to-foundry in Claude Code

   Option 2 (Manual):
     cd customer-support-agent-deployment
     azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic
     azd ai agent init -m src/customer-support-agent/agent.yaml
     azd up
   ```

4. **Testing locally**:
   ```bash
   cd customer-support-agent-deployment/src/customer-support-agent
   pip install -r requirements.txt
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   python main.py
   ```

5. **Deploy when ready**:
   ```bash
   cd customer-support-agent-deployment
   # Use /deploy-agent-to-foundry
   ```

### Use Cases

- Customer asks about an issue → Agent searches knowledge base
- Issue needs tracking → Agent creates ticket
- Complex problem → Agent escalates to engineering
- Customer follows up → Agent checks ticket status

## Example 2: DevOps Assistant

### Scenario

You have DevOps automation skills for deployments, monitoring, and incident response. You want to create an agent that helps your team with operational tasks.

### Skills Directory Structure

```
devops-skills/
├── deploy-service/
│   ├── SKILL.md
│   ├── README.md
│   └── deploy.sh
├── check-service-health/
│   ├── SKILL.md
│   └── README.md
├── view-logs/
│   ├── SKILL.md
│   └── README.md
├── rollback-deployment/
│   ├── SKILL.md
│   └── README.md
└── create-incident/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Custom path → `/home/user/devops-skills`
   - **Agent name**: Custom name → `devops-assistant`
   - **Description**: Custom description → `DevOps automation agent for service deployments, health monitoring, log analysis, and incident management. Streamlines operational workflows.`
   - **GitHub token**: Enter token → `github_pat_xxxxxxxxxxxx`
   - **Deploy now?**: Yes, deploy immediately

3. **Result**:
   ```
   Agent Created Successfully!

   Agent Name: devops-assistant
   Location: /home/user/devops-assistant-deployment
   Skills Included: 5

   Skills:
   - deploy-service: Deploy services to production or staging
   - check-service-health: Check health status of running services
   - view-logs: Retrieve and analyze service logs
   - rollback-deployment: Rollback a deployment to previous version
   - create-incident: Create incident tickets for issues

   Deploying to Azure AI Foundry...
   [Output from /deploy-agent-to-foundry skill...]
   ```

4. **Deployment completes automatically**, agent is live and accessible via Azure AI Foundry.

### Use Cases

- "Deploy user-service to production" → Agent runs deployment
- "Check if API is healthy" → Agent monitors health endpoints
- "Show me recent errors" → Agent retrieves and filters logs
- "Rollback the last deployment" → Agent reverts to previous version
- "Create incident for API outage" → Agent creates incident ticket

## Example 3: Research and Analysis Agent

### Scenario

You have research skills for document analysis, paper searches, and data summarization. You want an agent that helps with academic or business research.

### Skills Directory Structure

```
research-skills/
├── search-academic-papers/
│   ├── SKILL.md
│   └── README.md
├── summarize-document/
│   ├── SKILL.md
│   └── README.md
├── extract-citations/
│   ├── SKILL.md
│   └── README.md
├── compare-sources/
│   ├── SKILL.md
│   └── README.md
└── generate-bibliography/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Custom path → `./research-skills`
   - **Agent name**: Generate from skills → (generates `research-analysis-agent`)
   - **Description**: Auto-generate → (generates description from skills)
   - **GitHub token**: Enter token → `ghp_xxxxxxxxxxxx`
   - **Deploy now?**: No, I'll deploy later

3. **Result**:
   ```
   Agent Created Successfully!

   Agent Name: research-analysis-agent
   Location: /home/user/research-analysis-agent-deployment
   Skills Included: 5

   Skills:
   - search-academic-papers: Search academic databases for relevant papers
   - summarize-document: Generate concise summaries of research documents
   - extract-citations: Extract and format citations from documents
   - compare-sources: Compare information across multiple sources
   - generate-bibliography: Generate formatted bibliographies

   Next Steps:
   To deploy your agent:

   Option 1 (Recommended):
     cd research-analysis-agent-deployment
     # Use /deploy-agent-to-foundry in Claude Code
   ```

### Use Cases

- "Find papers about machine learning in healthcare" → Agent searches databases
- "Summarize this 50-page report" → Agent generates summary
- "Extract all citations from this paper" → Agent extracts references
- "Compare these three sources" → Agent identifies differences and consensus
- "Generate APA bibliography" → Agent formats citations

## Example 4: Data Science Toolkit

### Scenario

You have data analysis and visualization skills. You want an agent that helps with data science tasks.

### Skills Directory Structure

```
.claude/skills/
├── load-dataset/
│   ├── SKILL.md
│   └── README.md
├── clean-data/
│   ├── SKILL.md
│   └── README.md
├── generate-statistics/
│   ├── SKILL.md
│   └── README.md
├── create-visualization/
│   ├── SKILL.md
│   └── README.md
└── train-model/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Current directory (.claude/skills) → (selected)
   - **Agent name**: Custom name → `data-science-assistant`
   - **Description**: Custom description → `Data science agent for dataset analysis, cleaning, visualization, and model training. Accelerates data exploration and ML workflows.`
   - **GitHub token**: Enter token → `ghp_xxxxxxxxxxxx`
   - **Deploy now?**: Yes, deploy immediately

3. **Result**: Agent created and deployed automatically

### Use Cases

- "Load the sales data CSV" → Agent loads dataset
- "Clean missing values in the revenue column" → Agent applies cleaning
- "Show me statistics for customer age" → Agent generates descriptive stats
- "Create a scatter plot of price vs quantity" → Agent visualizes data
- "Train a regression model" → Agent trains and evaluates model

## Example 5: Code Review Assistant

### Scenario

You have skills for code analysis, style checking, and security scanning. You want an agent that assists with code reviews.

### Skills Directory Structure

```
code-review-skills/
├── analyze-complexity/
│   ├── SKILL.md
│   └── README.md
├── check-code-style/
│   ├── SKILL.md
│   └── README.md
├── security-scan/
│   ├── SKILL.md
│   └── README.md
├── suggest-improvements/
│   ├── SKILL.md
│   └── README.md
└── generate-tests/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Custom path → `/workspace/code-review-skills`
   - **Agent name**: Custom name → `code-review-bot`
   - **Description**: Custom description → `Automated code review assistant that analyzes complexity, checks style, scans for security issues, and suggests improvements.`
   - **GitHub token**: Enter token → `ghp_xxxxxxxxxxxx`
   - **Deploy now?**: Yes, deploy immediately

3. **Result**: Agent deployed and ready for code reviews

### Use Cases

- "Analyze this function's complexity" → Agent measures cyclomatic complexity
- "Check code style" → Agent runs linters and style checkers
- "Scan for security vulnerabilities" → Agent identifies potential issues
- "Suggest improvements" → Agent recommends refactoring
- "Generate unit tests" → Agent creates test cases

## Example 6: Content Management Agent

### Scenario

You have CMS-related skills for content creation, publishing, and SEO. You want an agent that helps manage website content.

### Skills Directory Structure

```
cms-skills/
├── create-blog-post/
│   ├── SKILL.md
│   └── README.md
├── optimize-seo/
│   ├── SKILL.md
│   └── README.md
├── publish-content/
│   ├── SKILL.md
│   └── README.md
└── schedule-post/
    ├── SKILL.md
    └── README.md
```

### Workflow

1. **Invoke the skill**:
   ```
   /create-agent-from-skill
   ```

2. **Answer questions**:
   - **Skills path**: Custom path → `./cms-skills`
   - **Agent name**: Custom name → `content-manager`
   - **Description**: Custom description → `Content management agent for creating, optimizing, and publishing blog posts and web content with SEO optimization.`
   - **GitHub token**: Enter token → `ghp_xxxxxxxxxxxx`
   - **Deploy now?**: No, I'll deploy later

3. **Testing with local content**:
   ```bash
   cd content-manager-deployment/src/content-manager
   pip install -r requirements.txt
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   python main.py
   ```

4. **Deploy after testing**:
   ```bash
   cd content-manager-deployment
   # Use /deploy-agent-to-foundry
   ```

### Use Cases

- "Create a blog post about AI trends" → Agent drafts content
- "Optimize this post for SEO" → Agent improves keywords and meta tags
- "Publish to production" → Agent deploys content
- "Schedule for next Monday" → Agent sets publish date

## Common Patterns

### Testing Before Deployment

For critical agents, test locally first:

```bash
# Create agent without deploying
Choose "No, I'll deploy later"

# Test locally
cd my-agent-deployment/src/my-agent
pip install -r requirements.txt
export GITHUB_TOKEN=your_token
python main.py

# Deploy when satisfied
cd ../..
# Use /deploy-agent-to-foundry
```

### Iterating on Skills

Update skills without recreating agent:

```bash
# Copy updated skills
cp -r /path/to/updated-skills/* my-agent-deployment/src/my-agent/skills/

# Redeploy
cd my-agent-deployment
azd deploy
```

### Managing Multiple Agents

Create agents for different purposes:

```bash
# Support agent
/create-agent-from-skill
→ customer-support-agent-deployment/

# DevOps agent
/create-agent-from-skill
→ devops-assistant-deployment/

# Research agent
/create-agent-from-skill
→ research-agent-deployment/
```

Each agent is independent and can be deployed to different Azure projects or regions.

### Auto-Generated Names

Let the skill generate names from skills:

```
Skills path: ./my-skills
Agent name: Generate from skills
→ Skill generates name like "task-automation-agent"
```

Useful when you want a descriptive name based on what the skills do.

## Troubleshooting Examples

### Example: Skills in Wrong Format

**Problem**: Skills directory has files but no SKILL.md

```
my-skills/
├── script1.py
├── script2.py
└── README.md
```

**Solution**: Add SKILL.md to each skill:

```
my-skills/
├── automation/
│   ├── SKILL.md       # Add this
│   └── script1.py
└── analysis/
    ├── SKILL.md       # Add this
    └── script2.py
```

### Example: Invalid Agent Name

**Problem**: Used underscores or spaces

```
Agent name: my_agent ✗
Agent name: My Agent ✗
```

**Solution**: Use kebab-case

```
Agent name: my-agent ✓
```

### Example: GitHub Token Missing Access

**Problem**: Token doesn't have Copilot access

**Solution**: Create new token with correct permissions:
1. Go to https://github.com/settings/tokens
2. Create token with Copilot API scope
3. Use new token when creating agent

## Tips and Best Practices

### Organizing Skills

Group related skills in the same directory:

```
skills/
├── database/          # Database skills
├── api/               # API skills
├── deployment/        # Deployment skills
└── monitoring/        # Monitoring skills
```

### Naming Conventions

Use descriptive, action-oriented names:

- ✓ `customer-support-agent`
- ✓ `devops-assistant`
- ✓ `code-review-bot`
- ✗ `agent1`
- ✗ `test`
- ✗ `my_bot`

### Documentation

The skill generates comprehensive READMEs, but you can enhance them:

```bash
# After creation, add custom sections
cd my-agent-deployment/src/my-agent
# Edit README.md to add your own examples, architecture diagrams, etc.
```

### Version Control

Track your agent in git:

```bash
cd my-agent-deployment
git init
git add .
git commit -m "Initial agent setup"
git remote add origin <your-repo>
git push -u origin main
```

### Environment-Specific Tokens

Use different tokens for dev/staging/prod:

```bash
# Development
echo "GITHUB_TOKEN=ghp_dev_token" > src/my-agent/.env

# Production (set in Azure Key Vault during azd up)
# Token is automatically injected from Key Vault
```

## Advanced Examples

### Multi-Region Deployment

Deploy the same agent to multiple regions:

```bash
# Create agent once
/create-agent-from-skill
→ my-agent-deployment/

# Deploy to US East
cd my-agent-deployment
azd env new production-east
azd env set AZURE_LOCATION eastus
azd up

# Deploy to Europe
azd env new production-europe
azd env set AZURE_LOCATION westeurope
azd up
```

### Custom Skill Combinations

Mix skills from different sources:

```bash
# Combine skills from multiple directories
mkdir combined-skills
cp -r /project1/skills/* combined-skills/
cp -r /project2/skills/* combined-skills/

# Create agent with combined skills
/create-agent-from-skill
Skills path: ./combined-skills
```

### CI/CD Integration

Automate agent updates:

```yaml
# .github/workflows/deploy-agent.yml
name: Deploy Agent
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Azure
        run: |
          cd my-agent-deployment
          azd auth login --client-id ${{ secrets.AZURE_CLIENT_ID }}
          azd deploy
```

---

These examples demonstrate the flexibility and power of the create-agent-from-skill skill. Adapt these patterns to your specific use cases and organizational needs.
