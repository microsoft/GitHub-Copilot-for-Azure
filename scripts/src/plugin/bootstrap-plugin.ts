import * as fs from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SkillsConfig {
  plugins: Array<{
    name: string;
    dirname: string;
    skills: string[];
    integrationTestSchedule: Record<string, string>;
  }>;
}

function addPluginToSkillsConfig(repoRoot: string, pluginName: string): void {
  const skillsConfigPath = path.join(repoRoot, "tests", "skills.json");
  const skillsConfig = JSON.parse(fs.readFileSync(skillsConfigPath, "utf8")) as SkillsConfig;

  if (skillsConfig.plugins.some((plugin) => plugin.dirname === pluginName)) {
    console.warn(`Plugin already exists in tests/skills.json, skipping: ${pluginName}`);
    return;
  }

  skillsConfig.plugins.push({
    name: pluginName,
    dirname: pluginName,
    skills: [],
    integrationTestSchedule: {},
  });
  fs.writeFileSync(skillsConfigPath, `${JSON.stringify(skillsConfig, null, 4)}\n`);
}

function createPluginHooks(pluginRoot: string, pluginName: string): void {
  const marker = `# --- ${pluginName} plugin ---`;
  const bashBlock = `${marker}
[[ "$p" == *".copilot/installed-plugins/"*"/${pluginName}/skills/"* ]] && return 0
[[ "$p" == *".claude/plugins/cache/azure-skills/${pluginName}/"*"/skills/"* ]] && return 0
[[ "$p" == *".cursor/plugins/cache/"*"/${pluginName}/"*"/skills/"* ]] && return 0
[[ "$p" == *"agent-plugins/github.com/microsoft/azure-skills/.github/plugins/${pluginName}/skills/"* ]] && return 0
`;
  const powershellBlock = `${marker}
$pluginPathPatterns = @(
    '\\.copilot/installed-plugins/[^/]+/${pluginName}/skills/',
    '\\.claude/plugins/cache/azure-skills/${pluginName}/[0-9.]+/skills/',
    '\\.cursor/plugins/cache/[^/]+/${pluginName}/[^/]+/skills/',
    'agent-plugins/github\\.com/microsoft/azure-skills/\\.github/plugins/${pluginName}/skills/'
)
`;

  const hooksScriptsRoot = path.join(pluginRoot, "hooks", "scripts");
  fs.mkdirSync(hooksScriptsRoot, { recursive: true });
  fs.writeFileSync(path.join(hooksScriptsRoot, "pluginPathAllowPattern.sh"), bashBlock);
  fs.writeFileSync(path.join(hooksScriptsRoot, "pluginPathAllowPattern.ps1"), powershellBlock);
}

async function getPluginName(): Promise<string> {
  const { values } = parseArgs({
    options: {
      plugin: { type: "string" },
    },
    strict: true,
  });

  let pluginName = values.plugin?.trim();
  if (!pluginName) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      pluginName = (await readline.question("Plugin name: ")).trim();
    } finally {
      readline.close();
    }
  }

  if (!NAME_PATTERN.test(pluginName)) {
    throw new Error("Plugin name must contain only lowercase letters, numbers, and hyphens");
  }

  return pluginName;
}

async function main(): Promise<void> {
  const pluginName = await getPluginName();
  const pluginManifestBase = {
    name: pluginName,
    description: "<Provide a description>",
    version: "0.0.0-placeholder",
    author: {
      name: "Microsoft",
      url: "https://www.microsoft.com"
    },
    homepage: "https://github.com/microsoft/github-copilot-for-azure",
    repository: "https://github.com/microsoft/GitHub-Copilot-for-Azure",
    license: "MIT",
    keywords: [
      "azure",
      "cloud"
    ]
  };
  const portablePluginManifest = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    ...pluginManifestBase
  };
  const legacyPluginManifestBase = {
    ...pluginManifestBase,
    skills: "./skills/",
    mcpServers: "./.mcp.json"
  };
  const copilotPluginManifest = {
    ...legacyPluginManifestBase,
    hooks: "./hooks/copilot-hooks.json"
  };
  const claudeCodePluginManifest = {
    ...legacyPluginManifestBase,
    hooks: "./hooks/claude-hooks.json"
  };
  const cursorPluginManifest = {
    ...legacyPluginManifestBase,
    hooks: "./hooks/cursor-hooks.json"
  };
  const repoRoot = path.resolve(__dirname, "../../..");
  const azureSkillsPluginRoot = path.join(repoRoot, "plugins/azure-skills");
  const pluginRoot = path.join(repoRoot, `plugins/${pluginName}`);

  // Plugin root
  fs.mkdirSync(pluginRoot);

  // Plugin manifests
  fs.writeFileSync(path.join(pluginRoot, "plugin.json"), JSON.stringify(portablePluginManifest, null, 2));
  fs.mkdirSync(path.join(pluginRoot, ".plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".plugin/plugin.json"), JSON.stringify(copilotPluginManifest, null, 2));
  fs.mkdirSync(path.join(pluginRoot, ".claude-plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), JSON.stringify(claudeCodePluginManifest, null, 2));
  fs.mkdirSync(path.join(pluginRoot, ".cursor-plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".cursor-plugin/plugin.json"), JSON.stringify(cursorPluginManifest, null, 2));

  // skills
  fs.mkdirSync(path.join(pluginRoot, "skills"));

  // MCP server declaration
  fs.writeFileSync(path.join(pluginRoot, "mcp.json"), JSON.stringify({
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {}
  }, null, 2));
  fs.writeFileSync(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: {} }, null, 2));

  // License
  fs.copyFileSync(path.join(azureSkillsPluginRoot, "LICENSE"), path.join(pluginRoot, "LICENSE"));

  // Readme
  const readme = `# ${pluginName}

<Describe the plugin and its prerequisites.>

## Installation

This scaffold does not confirm publication or an Awesome Copilot listing.

### Publication checklist (authors)

- TODO: Build and publish the package from \`output/${pluginName}\` and register
  it in the Microsoft marketplace before enabling the direct instructions below.
- TODO: Verify the installable name in \`plugin.json\` (currently \`${pluginName}\`).
  Use the manifest name, not the source directory, in installation commands.
- TODO: If accepted into [Awesome Copilot](https://awesome-copilot.github.com/),
  verify the listing and replace the client TODOs below with its actual links
  and command. Do not construct catalog URLs for an unpublished plugin.

### VS Code

TODO (after the Awesome Copilot listing is confirmed): Add the listing's
**Install in VS Code** link and its HTTPS detail page as a browser fallback.

### GitHub Copilot app

TODO (after the Awesome Copilot listing is confirmed): Add the listing's
**Install** link for the app and its HTTPS detail page as a browser fallback.

### Copilot CLI

TODO (after the Awesome Copilot listing is confirmed): Copy the listing's
**Copy CLI install command** for use in a terminal.

#### Direct Microsoft marketplace (only after publication is confirmed)

Use these instructions only after \`${pluginName}\` is published and registered
in \`microsoft/azure-skills\`. The marketplace name is \`azure-skills\`;
it is not the plugin name or its source directory.

From a terminal, after adding that marketplace in an interactive session:

\`\`\`text
copilot plugin install ${pluginName}@azure-skills
\`\`\`

Alternatively, inside an interactive Copilot CLI session (not a terminal):

\`\`\`text
/plugin marketplace add microsoft/azure-skills
/plugin install ${pluginName}@azure-skills
\`\`\`

Choose one marketplace for this plugin; do not install duplicate copies.
Use that same marketplace for updates. Awesome Copilot pins published packages
and may differ from the direct Microsoft marketplace.

## Telemetry

The \`track-telemetry\` hook installs a pinned native \`ghcfa-telem\` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
\`AZURE_MCP_COLLECT_TELEMETRY=false\` in the environment of the process running
the agent.
`;
  fs.writeFileSync(path.join(pluginRoot, "README.md"), readme);

  // Version
  const versionManifest = {
    $schema: "https://raw.githubusercontent.com/dotnet/Nerdbank.GitVersioning/main/src/NerdBank.GitVersioning/version.schema.json",
    version: "1.0",
    pathFilters: [".", ":/hooks"]
  };
  fs.writeFileSync(path.join(pluginRoot, "version.json"), JSON.stringify(versionManifest, null, 2));

  // Plugin-local hooks are assembled with shared hooks at build time
  createPluginHooks(pluginRoot, pluginName);

  addPluginToSkillsConfig(repoRoot, pluginName);

  console.log(`Bootstrapped ${pluginName} at plugins/${pluginName}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});