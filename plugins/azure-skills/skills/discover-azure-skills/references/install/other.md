# Other clients: skills-only fallback

Obtain user approval before installation; providing guidance is not authorization.
For a client without a verified native plugin route, offer this individual-skill fallback from a terminal (Bash or PowerShell) only when the individual skill's publication is confirmed. Substitute the published directory and skill name; if publication is unknown, explain the limitation without inventing a skill URL:

```shell
npx skills@1.7.4 add https://github.com/microsoft/azure-skills/tree/main/.github/plugins/<plugin-dirname>/skills/<skill-name>
```

This installs **skills only**, not the plugin's **MCP servers or hooks**. Do not describe it as a full plugin installation or assume tool-dependent skills will work. Select a skill location supported by the target client (many recognize `.agents/skills`); avoid duplicate copies. Plugin installation and Azure access remain separate.