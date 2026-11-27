# Steps

Obtain user approval before installation; guidance is not authorization.

1. Add `azure-skills` marketplace

Run this slash command in Claude Code

```text
/plugin marketplace add microsoft/azure-skills
```

2. Install the target plugin

Run this slash command in Claude Code

```text
/plugin install <plugin-name>@azure-skills
```

> Note: `<plugin-name>` is the discovered plugin's manifest name, not its directory name (`azure`, not `azure-skills`). These are Claude Code interactive slash commands, separate from Copilot client guidance.
