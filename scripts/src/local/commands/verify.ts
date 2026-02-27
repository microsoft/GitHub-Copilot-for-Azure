/**
 * Verify Command
 * 
 * Verifies that the Copilot config.json is correctly configured to use
 * the local plugin by:
 * 1. Checking for nested plugin install (plugin/azure/ should not exist)
 * 2. Checking the marketplace entry exists with correct source
 * 3. Checking the installed_plugins entry has correct cache_path
 * 4. Verifying the plugin directory exists and has expected content
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { setup } from "./setup.js";

const MARKETPLACE_NAME = "github-copilot-for-azure";
const PLUGIN_NAME = "azure";

interface Marketplace {
  source?: {
    source?: string;
    repo?: string;
  };
}

interface InstalledPlugin {
  name: string;
  marketplace: string;
  version?: string;
  installed_at?: string;
  enabled: boolean;
  cache_path: string;
}

interface CopilotConfig {
  marketplaces?: Record<string, Marketplace>;
  installed_plugins?: InstalledPlugin[];
  [key: string]: unknown;
}

interface VerifyOptions {
  fix: boolean;
  verbose: boolean;
}

function parseArgs(args: string[]): VerifyOptions {
  return {
    fix: args.includes("--fix"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

function getCopilotConfigPath(): string {
  return join(homedir(), ".copilot", "config.json");
}

interface ConfigReadResult {
  config: CopilotConfig | null;
  error?: string;
  fileExists: boolean;
}

function readCopilotConfig(): ConfigReadResult {
  const configPath = getCopilotConfigPath();
  if (!existsSync(configPath)) {
    return { config: null, fileExists: false };
  }
  try {
    return { config: JSON.parse(readFileSync(configPath, "utf-8")), fileExists: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: null, error: `Failed to parse config: ${message}`, fileExists: true };
  }
}

function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\/g, "/");
}

interface MarketplaceCheckResult {
  passed: boolean;
  exists: boolean;
  hasCorrectSource: boolean;
  actual?: Marketplace;
}

function checkMarketplace(config: CopilotConfig): MarketplaceCheckResult {
  const marketplace = config.marketplaces?.[MARKETPLACE_NAME];

  if (!marketplace) {
    return { passed: false, exists: false, hasCorrectSource: false };
  }

  const hasCorrectSource =
    marketplace.source?.source === "github" &&
    marketplace.source?.repo === "microsoft/github-copilot-for-azure";

  return {
    passed: hasCorrectSource,
    exists: true,
    hasCorrectSource,
    actual: marketplace,
  };
}

interface PluginCheckResult {
  passed: boolean;
  exists: boolean;
  hasCorrectCachePath: boolean;
  isEnabled: boolean;
  actual?: InstalledPlugin;
  expectedCachePath: string;
}

function checkPlugin(config: CopilotConfig, expectedCachePath: string): PluginCheckResult {
  const plugins = config.installed_plugins ?? [];
  const plugin = plugins.find(
    p => p.name === PLUGIN_NAME && p.marketplace === MARKETPLACE_NAME
  );

  if (!plugin) {
    return {
      passed: false,
      exists: false,
      hasCorrectCachePath: false,
      isEnabled: false,
      expectedCachePath,
    };
  }

  const hasCorrectCachePath = normalizePath(plugin.cache_path) === normalizePath(expectedCachePath);
  const isEnabled = plugin.enabled === true;

  return {
    passed: hasCorrectCachePath && isEnabled,
    exists: true,
    hasCorrectCachePath,
    isEnabled,
    actual: plugin,
    expectedCachePath,
  };
}

function checkNestedInstall(localPath: string): { passed: boolean; error?: string } {
  const nestedPluginPath = join(localPath, "azure");

  if (existsSync(nestedPluginPath)) {
    // Check if it has skills (confirming it's an installed plugin copy)
    const nestedSkillsPath = join(nestedPluginPath, "skills");
    if (existsSync(nestedSkillsPath)) {
      return {
        passed: false,
        error: `Found nested plugin at ${nestedPluginPath}. This was likely created by "/plugin install". ` +
          `Remove it with: Remove-Item "${nestedPluginPath}" -Recurse -Force`
      };
    }
  }

  return { passed: true };
}

function checkPluginContent(pluginPath: string, verbose: boolean): { passed: boolean; details: string[] } {
  const details: string[] = [];

  if (!existsSync(pluginPath)) {
    return { passed: false, details: ["Plugin directory does not exist"] };
  }

  // Check for essential files
  const essentialPaths = [
    "README.md",
    "skills",
  ];

  let allExist = true;
  for (const path of essentialPaths) {
    const fullPath = join(pluginPath, path);
    if (existsSync(fullPath)) {
      if (verbose) {
        details.push(`✅ ${path}`);
      }
    } else {
      details.push(`❌ Missing: ${path}`);
      allExist = false;
    }
  }

  // Count skills
  const skillsPath = join(pluginPath, "skills");
  if (existsSync(skillsPath)) {
    try {
      const skills = readdirSync(skillsPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith("_"))
        .map(d => d.name);
      details.push(`📦 ${skills.length} skills found`);
      if (verbose && skills.length > 0) {
        const preview = skills.slice(0, 5).join(", ");
        details.push(`   ${preview}${skills.length > 5 ? `, ... (+${skills.length - 5} more)` : ""}`);
      }
    } catch {
      details.push("⚠️  Could not enumerate skills");
    }
  }

  return { passed: allExist, details };
}

interface McpCheckResult {
  passed: boolean;
  missing: string[];
  present: string[];
  expected: string[];
  parseError?: string;
}

function checkMcpServers(pluginPath: string): McpCheckResult {
  const mcpJsonPath = join(pluginPath, ".mcp.json");
  if (!existsSync(mcpJsonPath)) {
    return { passed: true, missing: [], present: [], expected: [] };
  }

  let pluginMcp: { mcpServers?: Record<string, unknown> };
  try {
    pluginMcp = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
  } catch (e) {
    return { passed: false, missing: [], present: [], expected: [], parseError: `.mcp.json is invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  const expected = Object.keys(pluginMcp.mcpServers ?? {});
  if (expected.length === 0) {
    return { passed: true, missing: [], present: [], expected };
  }

  const mcpConfigPath = join(homedir(), ".copilot", "mcp-config.json");
  let userMcp: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(mcpConfigPath)) {
    try {
      userMcp = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
    } catch { /* empty */ }
  }

  const registered = Object.keys(userMcp.mcpServers ?? {});
  const missing = expected.filter(s => !registered.includes(s));
  const present = expected.filter(s => registered.includes(s));

  return { passed: missing.length === 0, missing, present, expected };
}

interface SkillCheckResult {
  passed: boolean;
  valid: string[];
  invalid: { name: string; error: string }[];
}

function checkSkills(pluginPath: string): SkillCheckResult {
  const skillsDir = join(pluginPath, "skills");
  if (!existsSync(skillsDir)) {
    return { passed: false, valid: [], invalid: [{ name: "skills/", error: "directory not found" }] };
  }

  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_"))
    .map(d => d.name);

  const valid: string[] = [];
  const invalid: { name: string; error: string }[] = [];

  for (const dir of skillDirs) {
    const skillMdPath = join(skillsDir, dir, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      invalid.push({ name: dir, error: "missing SKILL.md" });
      continue;
    }

    const content = readFileSync(skillMdPath, "utf-8");
    const hasFrontmatter = content.startsWith("---") && content.indexOf("---", 3) > 3;
    if (!hasFrontmatter) {
      invalid.push({ name: dir, error: "SKILL.md missing YAML frontmatter" });
      continue;
    }

    valid.push(dir);
  }

  return { passed: invalid.length === 0, valid, invalid };
}

export function verify(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, "plugin");
  const configPath = getCopilotConfigPath();

  console.log("\n🔍 Verifying Local Plugin Setup\n");
  console.log("────────────────────────────────────────────────────────────");

  // Check local plugin exists
  console.log("\n📁 Local plugin:");
  console.log(`   ${localPluginPath}`);
  if (!existsSync(localPluginPath)) {
    console.log("   ❌ Not found\n");
    process.exitCode = 1;
    return;
  }
  console.log("   ✅ Exists");

  // Check config file
  console.log("\n📄 Copilot config:");
  console.log(`   ${configPath}`);

  const configResult = readCopilotConfig();

  if (configResult.error) {
    console.log(`   ❌ ${configResult.error}`);
    process.exitCode = 1;
    return;
  }

  if (!configResult.config) {
    console.log("   ❌ Config file not found");
    if (options.fix) {
      console.log("\n   🔧 Running setup...\n");
      setup(rootDir, []);
      return;
    }
    console.log('   Run "npm run local setup" or use --fix to create.\n');
    process.exitCode = 1;
    return;
  }
  console.log("   ✅ Exists");

  console.log("\n────────────────────────────────────────────────────────────");

  // Test 1: Check for nested plugin install
  console.log("\n🧪 Test 1: Nested Plugin Check");
  const nestedCheck = checkNestedInstall(localPluginPath);

  if (nestedCheck.passed) {
    console.log("   ✅ No nested plugin install detected");
  } else {
    console.log(`   ❌ ${nestedCheck.error}`);
  }

  // Test 2: Check marketplace configuration
  console.log("\n🧪 Test 2: Marketplace Configuration");
  const marketplaceCheck = checkMarketplace(configResult.config);

  if (marketplaceCheck.passed) {
    console.log(`   ✅ Marketplace "${MARKETPLACE_NAME}" is correctly configured`);
  } else {
    if (!marketplaceCheck.exists) {
      console.log(`   ❌ Marketplace "${MARKETPLACE_NAME}" not found in config`);
    } else {
      console.log("   ❌ Marketplace has incorrect source configuration");
      if (marketplaceCheck.actual?.source) {
        console.log(`      Current: source="${marketplaceCheck.actual.source.source}", repo="${marketplaceCheck.actual.source.repo}"`);
      }
      console.log("      Expected: source=\"github\", repo=\"microsoft/github-copilot-for-azure\"");
    }
  }

  // Test 3: Check plugin configuration
  console.log("\n🧪 Test 3: Plugin Configuration");
  const pluginCheck = checkPlugin(configResult.config, localPluginPath);

  if (pluginCheck.passed) {
    console.log(`   ✅ Plugin "${PLUGIN_NAME}" is correctly configured`);
    console.log(`      cache_path: ${pluginCheck.actual?.cache_path}`);
  } else {
    if (!pluginCheck.exists) {
      console.log(`   ❌ Plugin "${PLUGIN_NAME}" not found in installed_plugins`);
    } else {
      if (!pluginCheck.hasCorrectCachePath) {
        console.log("   ❌ Plugin cache_path is incorrect");
        console.log(`      Current:  ${pluginCheck.actual?.cache_path}`);
        console.log(`      Expected: ${pluginCheck.expectedCachePath}`);
      }
      if (!pluginCheck.isEnabled) {
        console.log("   ⚠️  Plugin is disabled");
      }
    }
  }

  // Test 4: Check plugin content
  console.log("\n🧪 Test 4: Plugin Content Check");
  const contentCheck = checkPluginContent(localPluginPath, options.verbose);

  if (contentCheck.passed) {
    console.log("   ✅ Plugin directory has expected structure");
  } else {
    console.log("   ❌ Plugin directory structure issues:");
  }
  for (const detail of contentCheck.details) {
    console.log(`      ${detail}`);
  }

  // Test 5: Check MCP servers
  console.log("\n🧪 Test 5: MCP Server Registration");
  const mcpCheck = checkMcpServers(localPluginPath);

  if (mcpCheck.parseError) {
    console.log(`   ❌ ${mcpCheck.parseError}`);
  } else if (mcpCheck.expected.length === 0) {
    console.log("   ⚠️  No .mcp.json found or no servers defined");
  } else if (mcpCheck.passed) {
    console.log(`   ✅ All ${mcpCheck.expected.length} MCP servers registered: ${mcpCheck.present.join(", ")}`);
  } else {
    console.log(`   ❌ Missing MCP servers: ${mcpCheck.missing.join(", ")}`);
    if (mcpCheck.present.length > 0) {
      console.log(`   ✅ Registered: ${mcpCheck.present.join(", ")}`);
    }
  }

  // Test 6: Check production skills
  console.log("\n🧪 Test 6: Production Skills Validation");
  const skillsCheck = checkSkills(localPluginPath);

  if (skillsCheck.passed) {
    console.log(`   ✅ All ${skillsCheck.valid.length} skills have valid SKILL.md with frontmatter`);
  } else {
    for (const inv of skillsCheck.invalid) {
      console.log(`   ❌ ${inv.name}: ${inv.error}`);
    }
    if (skillsCheck.valid.length > 0) {
      console.log(`   ✅ ${skillsCheck.valid.length} skills valid`);
    }
  }

  console.log("\n────────────────────────────────────────────────────────────");

  // Summary
  const allPassed = nestedCheck.passed &&
    marketplaceCheck.passed &&
    pluginCheck.passed &&
    contentCheck.passed &&
    mcpCheck.passed &&
    skillsCheck.passed;

  if (allPassed) {
    console.log("\n✅ VERIFICATION PASSED\n");
    console.log("   Config is correctly pointing to local plugin.");
    console.log("   Changes to skills will be picked up by Copilot CLI.\n");
  } else {
    console.log("\n❌ VERIFICATION FAILED\n");

    if (!nestedCheck.passed) {
      console.log("   ⚠️  Nested plugin install detected (plugin/azure/).");
      console.log("      This shadows your local skills. Remove it to use local development.");
      if (options.fix) {
        const nestedPath = join(localPluginPath, "azure");
        console.log(`\n   🔧 Removing nested plugin at ${nestedPath}...`);
        try {
          rmSync(nestedPath, { recursive: true });
          console.log("   ✅ Removed nested plugin");
        } catch (error) {
          console.log(`   ❌ Failed to remove: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    if (!marketplaceCheck.passed || !pluginCheck.passed) {
      console.log("   ⚠️  Config needs to be updated.");
      if (options.fix) {
        console.log("\n   🔧 Running setup to fix config...\n");
        setup(rootDir, ["--force"]);

        // Re-verify after fix
        console.log("\n   🔄 Re-running verification...\n");
        verify(rootDir, args.filter(a => a !== "--fix"));
        return;
      }
    }

    if (!contentCheck.passed) {
      console.log("   ⚠️  Plugin directory is missing expected content.");
    }

    if (!options.fix) {
      console.log('\n   Run "npm run local verify --fix" to attempt automatic fixes.');
      console.log('   Or run "npm run local setup --force" to reconfigure.\n');
    }

    process.exitCode = 1;
  }
}
