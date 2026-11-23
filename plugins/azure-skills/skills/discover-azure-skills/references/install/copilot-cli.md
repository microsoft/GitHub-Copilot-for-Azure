# Copilot CLI installation guidance

Use `<plugin-name>` from the manifest, not the directory: `azure` lives in `azure-skills`.
Guidance is not approval: obtain user approval before running any installation.

Confirm the exact name in the [Awesome Copilot catalog](https://raw.githubusercontent.com/github/awesome-copilot/main/.github/plugin/marketplace.json) or a verified catalog detail page. Supplied verified metadata also suffices. Failed/unavailable lookup means **unknown**, not absent. Never invent a listing or emit an unverified install command, even as a negative example.

For a confirmed listing, offer the HTTPS page `https://awesome-copilot.github.com/plugin/<plugin-name>/` and this **terminal command** (Bash or PowerShell):

```shell
copilot plugin install <plugin-name>@awesome-copilot
```

For a plugin absent from the catalog, or whose listing is unknown, use the direct Microsoft marketplace if its manifest confirms publication there. These are **slash commands inside an interactive Copilot CLI session**, not terminal commands:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install <plugin-name>@azure-skills
```

This direct route is also an alternative for cataloged plugins. Awesome Copilot pins published packages; versions may differ from the direct marketplace. Keep installation/update marketplace identity consistent and avoid duplicate copies. If publication is unconfirmed, offer [publisher documentation](https://github.com/microsoft/azure-skills) instead of a speculative command. Installation does not grant Azure permissions.
