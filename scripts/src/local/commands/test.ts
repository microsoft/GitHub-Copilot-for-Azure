/**
 * Test Command
 *
 * Unified integration test that:
 * 1. Verifies the local plugin setup (config, MCP registration, skills)
 * 2. Launches the Copilot CLI and confirms each MCP server responds
 *    to a real tool call
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const TIMEOUT_MS = 120_000;
const MARKETPLACE_NAME = "github-copilot-for-azure";
const PLUGIN_NAME = "azure";

interface TestOptions {
  verbose: boolean;
}

function parseArgs(args: string[]): TestOptions {
  return {
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ── Setup verification helpers ──────────────────────────────────────

function normalizePath(p: string): string {
  return p.toLowerCase().replace(/\\/g, "/");
}

interface CopilotConfig {
  marketplaces?: Record<string, { source?: { source?: string; repo?: string } }>;
  installed_plugins?: { name: string; marketplace: string; enabled: boolean; cache_path: string }[];
}

function readCopilotConfig(): CopilotConfig | null {
  const configPath = join(homedir(), ".copilot", "config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

function checkPluginConfig(expectedCachePath: string): TestResult {
  const config = readCopilotConfig();
  if (!config) {
    return { name: "Plugin config", passed: false, detail: "~/.copilot/config.json not found" };
  }

  const marketplace = config.marketplaces?.[MARKETPLACE_NAME];
  if (!marketplace || marketplace.source?.source !== "github" ||
      marketplace.source?.repo !== "microsoft/github-copilot-for-azure") {
    return { name: "Plugin config", passed: false, detail: `Marketplace "${MARKETPLACE_NAME}" not configured correctly` };
  }

  const plugin = (config.installed_plugins ?? []).find(
    p => p.name === PLUGIN_NAME && p.marketplace === MARKETPLACE_NAME
  );
  if (!plugin) {
    return { name: "Plugin config", passed: false, detail: `Plugin "${PLUGIN_NAME}" not found in installed_plugins` };
  }
  if (!plugin.enabled) {
    return { name: "Plugin config", passed: false, detail: "Plugin is disabled" };
  }
  if (normalizePath(plugin.cache_path) !== normalizePath(expectedCachePath)) {
    return { name: "Plugin config", passed: false, detail: `cache_path mismatch: ${plugin.cache_path} (expected ${expectedCachePath})` };
  }

  return { name: "Plugin config", passed: true, detail: `cache_path → ${plugin.cache_path}` };
}

function checkNestedInstall(pluginPath: string): TestResult {
  const nestedSkills = join(pluginPath, "azure", "skills");
  if (existsSync(nestedSkills)) {
    return { name: "Nested install", passed: false, detail: `Found nested plugin at ${join(pluginPath, "azure")} — remove it` };
  }
  return { name: "Nested install", passed: true, detail: "No nested plugin install" };
}

function checkMcpRegistration(pluginPath: string): TestResult {
  const mcpJsonPath = join(pluginPath, ".mcp.json");
  if (!existsSync(mcpJsonPath)) {
    return { name: "MCP registration", passed: false, detail: "No .mcp.json in plugin directory" };
  }

  let expected: string[];
  try {
    const pluginMcp = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    expected = Object.keys(pluginMcp.mcpServers ?? {});
  } catch {
    return { name: "MCP registration", passed: false, detail: "Failed to parse .mcp.json" };
  }

  if (expected.length === 0) {
    return { name: "MCP registration", passed: true, detail: "No MCP servers defined" };
  }

  const userMcpPath = join(homedir(), ".copilot", "mcp-config.json");
  let registered: string[] = [];
  if (existsSync(userMcpPath)) {
    try {
      const userMcp = JSON.parse(readFileSync(userMcpPath, "utf-8"));
      registered = Object.keys(userMcp.mcpServers ?? {});
    } catch { /* empty */ }
  }

  const missing = expected.filter(s => !registered.includes(s));
  if (missing.length > 0) {
    return { name: "MCP registration", passed: false, detail: `Missing in mcp-config.json: ${missing.join(", ")}` };
  }

  return { name: "MCP registration", passed: true, detail: `All ${expected.length} servers registered: ${expected.join(", ")}` };
}

function checkSkills(pluginPath: string, verbose: boolean): TestResult {
  const skillsDir = join(pluginPath, "skills");
  if (!existsSync(skillsDir)) {
    return { name: "Skills validation", passed: false, detail: "skills/ directory not found" };
  }

  const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_"))
    .map(d => d.name);

  const invalid: { name: string; error: string }[] = [];

  for (const skill of skillDirs) {
    const skillMdPath = join(skillsDir, skill, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      invalid.push({ name: skill, error: "missing SKILL.md" });
      continue;
    }

    let content: string;
    try {
      content = readFileSync(skillMdPath, "utf-8");
    } catch {
      invalid.push({ name: skill, error: "unreadable SKILL.md" });
      continue;
    }

    if (!content.startsWith("---")) {
      invalid.push({ name: skill, error: "missing YAML frontmatter" });
      continue;
    }

    const fmEnd = content.indexOf("---", 3);
    if (fmEnd === -1) {
      invalid.push({ name: skill, error: "unclosed YAML frontmatter" });
      continue;
    }

    const frontmatter = content.slice(3, fmEnd);
    if (!/^name:\s*.+/m.test(frontmatter)) {
      invalid.push({ name: skill, error: 'frontmatter missing "name"' });
      continue;
    }
    if (!/^description:\s*.+/m.test(frontmatter) && !/^description:\s*\|/m.test(frontmatter)) {
      invalid.push({ name: skill, error: 'frontmatter missing "description"' });
      continue;
    }

    const nameMatch = frontmatter.match(/^name:\s*(.+)/m);
    if (nameMatch && nameMatch[1].trim() !== skill) {
      invalid.push({ name: skill, error: `name "${nameMatch[1].trim()}" doesn't match directory` });
      continue;
    }
  }

  if (invalid.length > 0) {
    const details = invalid.map(s => `${s.name}: ${s.error}`).join("; ");
    return { name: "Skills validation", passed: false, detail: `${invalid.length} invalid: ${details}` };
  }

  if (verbose) {
    console.log(`      ${skillDirs.join(", ")}`);
  }

  return { name: "Skills validation", passed: true, detail: `All ${skillDirs.length} skills have valid SKILL.md` };
}

// ── MCP live-test helpers ───────────────────────────────────────────

function getExpectedMcpServers(pluginPath: string): string[] {
  const mcpJsonPath = join(pluginPath, ".mcp.json");
  if (!existsSync(mcpJsonPath)) return [];
  try {
    const config = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    return Object.keys(config.mcpServers ?? {});
  } catch {
    return [];
  }
}

function runCopilotPrompt(prompt: string, verbose: boolean): string {
  // Reject prompts that could be interpreted as CLI flags
  if (prompt.startsWith("-")) {
    throw new Error("Invalid prompt: must not start with '-'");
  }
  const args = ["-p", prompt, "--allow-all-tools", "--allow-all-paths"];
  if (verbose) {
    console.log(`   🔧 Running: copilot ${args.join(" ")}`);
  }

  try {
    const output = execFileSync("copilot", args, {
      encoding: "utf-8",
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    return output;
  } catch (error) {
    if (error instanceof Error && "stdout" in error) {
      return (error as { stdout: string }).stdout ?? "";
    }
    return "";
  }
}

interface McpToolProbe {
  server: string;
  prompt: string;
  successPattern: RegExp;
  invokedPattern: RegExp;
}

// Lightweight tool calls to verify each MCP server actually responds.
// Prompts avoid double quotes to prevent shell escaping issues.
const MCP_TOOL_PROBES: McpToolProbe[] = [
  {
    server: "context7",
    prompt: "Call the context7-resolve-library-id tool with libraryName set to react and query set to react hooks. If it returns data, say CONTEXT7_OK. If it fails, say CONTEXT7_FAIL.",
    successPattern: /CONTEXT7_OK/i,
    invokedPattern: /context7-resolve-library-id/i,
  },
  {
    server: "playwright",
    prompt: "Call the playwright-browser_tabs tool with action set to list. If it returns data or an error response, say PLAYWRIGHT_OK. If the tool is not found, say PLAYWRIGHT_FAIL.",
    successPattern: /PLAYWRIGHT_OK/i,
    invokedPattern: /playwright-browser_tabs/i,
  },
  {
    server: "azure",
    prompt: "Call the azure-documentation tool with intent set to azure functions overview and learn set to true. If it returns data, say AZURE_OK. If it fails, say AZURE_FAIL.",
    successPattern: /AZURE_OK/i,
    invokedPattern: /azure-documentation/i,
  },
];

// ── Main test function ──────────────────────────────────────────────

export function test(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, "plugin");

  console.log("\n🧪 Local Plugin Integration Test\n");
  console.log("────────────────────────────────────────────────────────────");

  if (!existsSync(localPluginPath)) {
    console.log('   ❌ Plugin directory not found. Run "npm run local setup" first.\n');
    process.exitCode = 1;
    return;
  }

  const results: TestResult[] = [];

  // ── Phase 1: Setup verification (no Copilot CLI needed) ──

  console.log("\n📋 Phase 1: Setup Verification\n");

  const configResult = checkPluginConfig(localPluginPath);
  results.push(configResult);
  console.log(`   ${configResult.passed ? "✅" : "❌"} ${configResult.name}: ${configResult.detail}`);

  const nestedResult = checkNestedInstall(localPluginPath);
  results.push(nestedResult);
  console.log(`   ${nestedResult.passed ? "✅" : "❌"} ${nestedResult.name}: ${nestedResult.detail}`);

  const mcpRegResult = checkMcpRegistration(localPluginPath);
  results.push(mcpRegResult);
  console.log(`   ${mcpRegResult.passed ? "✅" : "❌"} ${mcpRegResult.name}: ${mcpRegResult.detail}`);

  const skillsResult = checkSkills(localPluginPath, options.verbose);
  results.push(skillsResult);
  console.log(`   ${skillsResult.passed ? "✅" : "❌"} ${skillsResult.name}: ${skillsResult.detail}`);

  // Abort early if setup is broken
  const setupPassed = results.every(r => r.passed);
  if (!setupPassed) {
    console.log("\n────────────────────────────────────────────────────────────");
    console.log("\n❌ TEST FAILED — setup verification did not pass\n");
    console.log('   Run "npm run local setup --force" to fix.\n');
    process.exitCode = 1;
    return;
  }

  // ── Phase 2: Live MCP server tests ──

  const expectedMcpServers = getExpectedMcpServers(localPluginPath);

  if (expectedMcpServers.length === 0) {
    console.log("\n   ⚠️  No MCP servers defined — skipping live tests");
  } else {
    console.log("\n📋 Phase 2: MCP Server Tool Invocation\n");
    console.log(`   Testing ${expectedMcpServers.join(", ")}...\n`);

    const serverResults: { server: string; passed: boolean; detail: string }[] = [];

    for (const probe of MCP_TOOL_PROBES) {
      if (!expectedMcpServers.includes(probe.server)) continue;

      console.log(`   🔌 ${probe.server}:`);
      console.log("      ⏳ Calling tool...");

      const output = runCopilotPrompt(probe.prompt, options.verbose);

      if (options.verbose) {
        console.log(`      📄 Output (first 300 chars): ${output.slice(0, 300)}`);
      }

      const passed = probe.successPattern.test(output);
      const invoked = probe.invokedPattern.test(output);
      const serverOk = passed || invoked;
      let detail: string;
      if (passed) {
        detail = "Tool call succeeded";
      } else if (invoked) {
        detail = "Tool was invoked (server responded, but tool returned an error — may need setup)";
      } else {
        detail = "Tool call failed — server may not be connected";
      }
      serverResults.push({ server: probe.server, passed: serverOk, detail });
      console.log(`      ${serverOk ? "✅" : "❌"} ${detail}\n`);
    }

    // Check for expected servers that have no probe defined
    const testedServers = MCP_TOOL_PROBES.map(p => p.server);
    const untestedServers = expectedMcpServers.filter(s => !testedServers.includes(s));
    if (untestedServers.length > 0) {
      console.log(`   ⚠️  No tool probe defined for: ${untestedServers.join(", ")}`);
    }

    const toolTestPassed = serverResults.every(r => r.passed);
    results.push({
      name: "MCP tool invocation",
      passed: toolTestPassed,
      detail: toolTestPassed
        ? `All ${serverResults.length} MCP servers responded to tool calls`
        : `Failed: ${serverResults.filter(r => !r.passed).map(r => r.server).join(", ")}`,
    });
  }

  // ── Summary ──

  console.log("────────────────────────────────────────────────────────────");

  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log("\n✅ TEST PASSED\n");
    console.log("   Plugin setup is correct and MCP servers are responding.\n");
  } else {
    console.log("\n❌ TEST FAILED\n");
    for (const r of results) {
      console.log(`   ${r.passed ? "✅" : "❌"} ${r.name}: ${r.detail}`);
    }
    console.log('\n   Run "npm run local setup --force" then retry.\n');
    process.exitCode = 1;
  }
}
