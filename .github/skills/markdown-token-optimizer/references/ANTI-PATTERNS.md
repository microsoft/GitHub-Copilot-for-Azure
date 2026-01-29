# Anti-Patterns: Common Token Wasters

Patterns that inflate token counts without adding value.

## Decorative Elements

### Excessive Emojis

**Bad:**
```markdown
# 🚀 Getting Started 🎉

Welcome! 👋 Let's get you set up! 💪

## 📋 Prerequisites ✨

You'll need: 🔧
- Node.js 🟢
- Azure CLI ☁️
```

**Good:**
```markdown
# Getting Started

## Prerequisites

- Node.js 18+
- Azure CLI
```

**Token cost:** ~2 tokens per emoji. 10 decorative emojis = 20 wasted tokens.

**When emojis ARE appropriate:**
- Status indicators: ✅ ❌ ⚠️
- Severity levels in tables
- Actual meaning (not decoration)

### Horizontal Rules Overuse

**Bad:**
```markdown
## Section One

Content here.

---

## Section Two

More content.

---

## Section Three
```

**Good:**
```markdown
## Section One

Content here.

## Section Two

More content.

## Section Three
```

**Token cost:** ~3 tokens per `---`

## Redundant Content

### Repeated Introductions

**Bad:**
```markdown
## Prerequisites

Before you begin, make sure you have the following prerequisites installed.

### Node.js

Node.js is required. Make sure Node.js is installed before proceeding.

### Azure CLI

Azure CLI is required. Make sure Azure CLI is installed before proceeding.
```

**Good:**
```markdown
## Prerequisites

- Node.js 18+
- Azure CLI 2.50+
```

### Echo Headers

**Bad:**
```markdown
## Troubleshooting

This section covers troubleshooting steps.

### Common Issues

Here are some common issues you might encounter.
```

**Good:**
```markdown
## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth fails | Run `az login` |
```

## Verbose Constructions

### Filler Words

**Bad:**
```markdown
In order to successfully deploy your application to Azure, 
you will first need to make sure that you have properly 
configured all of the necessary prerequisites.
```

**Good:**
```markdown
Before deploying to Azure, configure these prerequisites:
```

**Savings:** ~20 tokens

### Unnecessary Qualifiers

**Bad:**
```markdown
- It's very important to always remember to...
- You should definitely make sure to...
- It's absolutely essential that you...
```

**Good:**
```markdown
- Remember to...
- Ensure...
- Required:...
```

## Structural Issues

### Inline Documentation That Should Be Referenced

**Bad (in SKILL.md):**
```markdown
## Complete API Reference

### GET /users
Returns all users. Accepts `limit` (default 10, max 100) and 
`offset` (default 0) query parameters. Response is JSON array 
of User objects with fields: id (string), name (string), 
email (string), createdAt (ISO 8601 timestamp)...

[continues for 200 more lines]
```

**Good:**
```markdown
## API Reference

See [references/API.md](references/API.md) for endpoints.

Key endpoints: `GET /users`, `POST /users`, `GET /users/:id`
```

### Duplicate Examples

**Bad:**
```markdown
## Example 1: Basic Usage
\`\`\`bash
az storage account create -n myaccount -g mygroup -l eastus
\`\`\`

## Example 2: With Tags
\`\`\`bash  
az storage account create -n myaccount -g mygroup -l eastus --tags env=dev
\`\`\`

## Example 3: With SKU
\`\`\`bash
az storage account create -n myaccount -g mygroup -l eastus --sku Standard_GRS
\`\`\`
```

**Good:**
```markdown
## Examples

Basic: `az storage account create -n NAME -g RG -l LOCATION`

Options: `--tags env=dev`, `--sku Standard_GRS`

More examples: [references/EXAMPLES.md](references/EXAMPLES.md)
```

## Detection Checklist

When reviewing a file, check for:

- [ ] More than 3 decorative emojis
- [ ] Sections that start with "This section..."
- [ ] Phrases like "In order to", "It is important"
- [ ] Same command/text appearing 3+ times
- [ ] Code blocks longer than 10 lines
- [ ] Tables with 10+ rows in main SKILL.md
- [ ] Headers followed immediately by similar subheaders
