import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const pluginName = "new-plugin";
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
  fs.writeFileSync(path.join(pluginRoot, "README.md"), "");

  // Version
  const versionManifest = {
    $schema: "https://raw.githubusercontent.com/dotnet/Nerdbank.GitVersioning/main/src/NerdBank.GitVersioning/version.schema.json",
    version: "1.0",
    pathFilters: ["."]
  };
  fs.writeFileSync(path.join(pluginRoot, "version.json"), JSON.stringify(versionManifest, null, 2));

  // Hooks will be copied at build time

  console.log(`Bootstrapped ${pluginName} at plugins/${pluginName}`);
}

main();