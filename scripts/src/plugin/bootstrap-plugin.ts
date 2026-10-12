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
    ],
    skills: "./skills/",
    mcpServers: "./.mcp.json"
  };
  const copilotPluginManifest = {
    ...pluginManifestBase,
    hooks: "./hooks/copilot-hooks.json"
  };
  const claudeCodePluginManifest = {
    ...pluginManifestBase,
    hooks: "./hooks/claude-hooks.json"
  };
  const cursorPluginManifest = {
    ...pluginManifestBase,
    hooks: "./hooks/cursor-hooks.json"
  };
  const repoRoot = path.resolve(__dirname, "../../..");
  const azureSkillsPluginRoot = path.join(repoRoot, "plugins/azure-skills");
  const pluginRoot = path.join(repoRoot, `plugins/${pluginName}`);

  // Plugin root
  fs.mkdirSync(pluginRoot);

  // Plugin manifests
  fs.mkdirSync(path.join(pluginRoot, ".plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".plugin/plugin.json"), JSON.stringify(copilotPluginManifest, null, 2));
  fs.mkdirSync(path.join(pluginRoot, ".claude-plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), JSON.stringify(claudeCodePluginManifest, null, 2));
  fs.mkdirSync(path.join(pluginRoot, ".cursor-plugin"));
  fs.writeFileSync(path.join(pluginRoot, ".cursor-plugin/plugin.json"), JSON.stringify(cursorPluginManifest, null, 2));

  // skills
  fs.mkdirSync(path.join(pluginRoot, "skills"));

  // MCP server declaration
  fs.writeFileSync(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: {} }, null, 2));

  // License
  fs.copyFileSync(path.join(azureSkillsPluginRoot, "LICENSE"), path.join(pluginRoot, "LICENSE"));

  // Readme
  const readme = `# <Your Plugin>

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