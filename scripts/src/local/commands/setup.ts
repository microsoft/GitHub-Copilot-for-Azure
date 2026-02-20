/**
 * Setup Command
 * 
 * Configures ~/.copilot/config.json to point the azure plugin's cache_path
 * directly at the local plugin directory for development.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKETPLACE_NAME = "github-copilot-for-azure";
const PLUGIN_NAME = "azure";

interface Marketplace {
  source: {
    source: string;
    repo: string;
  };
}

interface InstalledPlugin {
  name: string;
  marketplace: string;
  installed_at: string;
  enabled: boolean;
  cache_path: string;
}

interface CopilotConfig {
  marketplaces?: Record<string, Marketplace>;
  installed_plugins?: InstalledPlugin[];
  [key: string]: unknown;
}

interface SetupOptions {
  force: boolean;
}

function parseArgs(args: string[]): SetupOptions {
  return {
    force: args.includes("--force") || args.includes("-f"),
  };
}

function getCopilotDir(): string {
  return join(homedir(), ".copilot");
}

function getCopilotConfigPath(): string {
  return join(getCopilotDir(), "config.json");
}

function readCopilotConfig(): CopilotConfig | null {
  const configPath = getCopilotConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

function writeCopilotConfig(config: CopilotConfig): boolean {
  const configPath = getCopilotConfigPath();
  const copilotDir = getCopilotDir();
  
  try {
    // Ensure .copilot directory exists
    if (!existsSync(copilotDir)) {
      mkdirSync(copilotDir, { recursive: true });
    }
    
    // Backup first
    const backupPath = configPath + ".bak";
    if (existsSync(configPath)) {
      writeFileSync(backupPath, readFileSync(configPath));
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

interface McpConfig {
  mcpServers?: Record<string, {
    type?: string;
    command?: string;
    args?: string[];
    url?: string;
    tools?: string[];
  }>;
}

function getMcpConfigPath(): string {
  return join(getCopilotDir(), 'mcp-config.json');
}

function readMcpConfig(): McpConfig | null {
  const configPath = getMcpConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeMcpConfig(config: McpConfig): boolean {
  const configPath = getMcpConfigPath();
  const copilotDir = getCopilotDir();

  try {
    if (!existsSync(copilotDir)) {
      mkdirSync(copilotDir, { recursive: true });
    }
    const backupPath = configPath + '.bak';
    if (existsSync(configPath)) {
      writeFileSync(backupPath, readFileSync(configPath));
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function readPluginMcpJson(pluginPath: string): McpConfig | null {
  const mcpJsonPath = join(pluginPath, '.mcp.json');
  if (!existsSync(mcpJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function setupMcpServers(pluginPath: string, options: { force: boolean }): boolean {
  console.log('\n🔌 MCP Server Registration\n');

  const pluginMcp = readPluginMcpJson(pluginPath);
  if (!pluginMcp?.mcpServers || Object.keys(pluginMcp.mcpServers).length === 0) {
    console.log('   ⚠️  No MCP servers found in plugin/.mcp.json');
    return true;
  }

  const serverNames = Object.keys(pluginMcp.mcpServers);
  console.log(`   Found ${serverNames.length} MCP servers: ${serverNames.join(', ')}`);

  let userMcp = readMcpConfig();
  if (!userMcp) {
    userMcp = { mcpServers: {} };
  }
  if (!userMcp.mcpServers) {
    userMcp.mcpServers = {};
  }

  let added = 0;
  let skipped = 0;
  for (const [name, entry] of Object.entries(pluginMcp.mcpServers)) {
    if (userMcp.mcpServers[name] && !options.force) {
      console.log(`   ⏭️  ${name}: already registered (use --force to overwrite)`);
      skipped++;
      continue;
    }
    userMcp.mcpServers[name] = {
      type: (entry as Record<string, unknown>).type as string ?? 'stdio',
      ...(entry as Record<string, unknown>),
    };
    console.log(`   ✅ ${name}: registered`);
    added++;
  }

  if (added > 0) {
    if (!writeMcpConfig(userMcp)) {
      console.log('   ❌ Failed to write MCP config');
      return false;
    }
    console.log(`\n   📝 Updated ${getMcpConfigPath()}`);
  }

  console.log(`\n   Summary: ${added} added, ${skipped} skipped`);
  return true;
}

function getExpectedMarketplace(): Marketplace {
  return {
    source: {
      source: "github",
      repo: "microsoft/github-copilot-for-azure",
    },
  };
}

function createExpectedPlugin(cachePath: string): InstalledPlugin {
  return {
    name: PLUGIN_NAME,
    marketplace: MARKETPLACE_NAME,
    installed_at: new Date().toISOString(),
    enabled: true,
    cache_path: cachePath,
  };
}

function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\/g, "/");
}

function isMarketplaceCorrect(config: CopilotConfig): boolean {
  const marketplace = config.marketplaces?.[MARKETPLACE_NAME];
  if (!marketplace) return false;
  
  const expected = getExpectedMarketplace();
  return marketplace.source?.source === expected.source.source &&
         marketplace.source?.repo === expected.source.repo;
}

function isPluginCorrect(config: CopilotConfig, expectedCachePath: string): boolean {
  const plugins = config.installed_plugins ?? [];
  const plugin = plugins.find(p => p.name === PLUGIN_NAME && p.marketplace === MARKETPLACE_NAME);
  
  if (!plugin) return false;
  
  return normalizePath(plugin.cache_path) === normalizePath(expectedCachePath) && plugin.enabled;
}

export function setup(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, "plugin");
  const configPath = getCopilotConfigPath();

  console.log("\n🔧 Local Development Setup\n");
  console.log("────────────────────────────────────────────────────────────");

  // Check local plugin exists
  console.log("\n📁 Local plugin path:");
  console.log(`   ${localPluginPath}`);
  if (!existsSync(localPluginPath)) {
    console.log("   ❌ Not found\n");
    console.error("Error: Local plugin directory not found.");
    process.exitCode = 1;
    return;
  }
  console.log("   ✅ Exists");

  // Read or create config
  console.log("\n📄 Copilot config:");
  console.log(`   ${configPath}`);
  
  let config = readCopilotConfig();
  const configExisted = config !== null;
  
  if (!config) {
    console.log("   📂 Creating new config...");
    config = {};
  } else {
    console.log("   ✅ Exists");
  }

  // Check if already configured correctly
  const marketplaceOk = isMarketplaceCorrect(config);
  const pluginOk = isPluginCorrect(config, localPluginPath);

  if (marketplaceOk && pluginOk) {
    console.log("\n✅ Plugin config already correct!");
    // Still register MCP servers
    setupMcpServers(localPluginPath, options);
    console.log("────────────────────────────────────────────────────────────");
    console.log("\n✅ Setup complete!\n");
    return;
  }

  // Show what needs to be updated
  console.log("\n📝 Configuration changes needed:");
  
  if (!marketplaceOk) {
    console.log(`   • Add/update marketplace: ${MARKETPLACE_NAME}`);
  }
  
  if (!pluginOk) {
    const existingPlugin = config.installed_plugins?.find(
      p => p.name === PLUGIN_NAME && p.marketplace === MARKETPLACE_NAME
    );
    if (existingPlugin) {
      console.log("   • Update plugin cache_path from:");
      console.log(`     ${existingPlugin.cache_path}`);
      console.log(`     to: ${localPluginPath}`);
    } else {
      console.log(`   • Add plugin: ${PLUGIN_NAME}`);
    }
  }

  // Check if force is needed when config already exists with different values
  if (configExisted && !options.force && (!marketplaceOk || !pluginOk)) {
    const existingPlugin = config.installed_plugins?.find(
      p => p.name === PLUGIN_NAME
    );
    if (existingPlugin && normalizePath(existingPlugin.cache_path) !== normalizePath(localPluginPath)) {
      console.log("\n   ⚠️  Plugin already exists with different cache_path.");
      console.log("   Use --force to update.\n");
      process.exitCode = 1;
      return;
    }
  }

  // Update marketplace
  if (!config.marketplaces) {
    config.marketplaces = {};
  }
  config.marketplaces[MARKETPLACE_NAME] = getExpectedMarketplace();

  // Update installed_plugins
  if (!config.installed_plugins) {
    config.installed_plugins = [];
  }

  // Find and update or add the plugin
  const existingPluginIndex = config.installed_plugins.findIndex(
    p => p.name === PLUGIN_NAME && p.marketplace === MARKETPLACE_NAME
  );

  if (existingPluginIndex >= 0) {
    // Update existing plugin
    config.installed_plugins[existingPluginIndex] = {
      ...config.installed_plugins[existingPluginIndex],
      cache_path: localPluginPath,
      enabled: true,
    };
  } else {
    // Remove any other azure plugins first
    config.installed_plugins = config.installed_plugins.filter(p => p.name !== PLUGIN_NAME);
    // Add new plugin
    config.installed_plugins.push(createExpectedPlugin(localPluginPath));
  }

  // Write config
  console.log("\n💾 Writing config...");
  if (!writeCopilotConfig(config)) {
    console.log("   ❌ Failed to write config\n");
    process.exitCode = 1;
    return;
  }
  console.log("   ✅ Config updated");

  // Register MCP servers
  setupMcpServers(localPluginPath, options);

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("\n✅ Setup complete!\n");
  console.log("   Your config now points to the local plugin. Changes to skills");
  console.log("   will be picked up by Copilot CLI (restart CLI after changes).\n");
  console.log('   Run "npm run local verify" to confirm the setup.\n');
}
