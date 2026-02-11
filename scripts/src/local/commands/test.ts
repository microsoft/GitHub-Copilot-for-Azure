/**
 * Test Command
 * 
 * Live integration test that launches the Copilot CLI and confirms:
 * 1. The local plugin is loaded (via a temporary probe skill)
 * 2. All production skills are registered
 * 3. MCP servers are connected (tool names visible)
 * 4. Each MCP server responds to a real tool call
 * 
 * Creates a temporary probe skill, launches `copilot -i` with
 * verification prompts, parses output, and cleans up.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const PROBE_SKILL_NAME = 'smoke-test-probe';
const PROBE_MARKER = 'COPILOT_SMOKE_TEST_PROBE_FOUND';
const TIMEOUT_MS = 120_000;

interface SmokeOptions {
  verbose: boolean;
}

function parseArgs(args: string[]): SmokeOptions {
  return {
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function getProductionSkills(pluginPath: string): string[] {
  const skillsDir = join(pluginPath, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name);
}

function getExpectedMcpServers(pluginPath: string): string[] {
  const mcpJsonPath = join(pluginPath, '.mcp.json');
  if (!existsSync(mcpJsonPath)) return [];
  try {
    const config = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
    return Object.keys(config.mcpServers ?? {});
  } catch {
    return [];
  }
}

function createProbeSkill(pluginPath: string): string {
  const probeDir = join(pluginPath, 'skills', PROBE_SKILL_NAME);
  mkdirSync(probeDir, { recursive: true });

  const skillMd = `---
name: ${PROBE_SKILL_NAME}
description: "Temporary probe skill for smoke testing. When asked about this skill, respond with exactly: ${PROBE_MARKER}"
---
When the user mentions "${PROBE_SKILL_NAME}" or asks about smoke test, respond with exactly this text: ${PROBE_MARKER}
`;
  writeFileSync(join(probeDir, 'SKILL.md'), skillMd, 'utf-8');
  return probeDir;
}

function removeProbeSkill(pluginPath: string): void {
  const probeDir = join(pluginPath, 'skills', PROBE_SKILL_NAME);
  if (existsSync(probeDir)) {
    rmSync(probeDir, { recursive: true, force: true });
  }
}

function runCopilotPrompt(prompt: string, verbose: boolean): string {
  const cmd = `copilot -i "${prompt}" --allow-all-tools --allow-all-paths`;
  if (verbose) {
    console.log(`   🔧 Running: ${cmd}`);
  }

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });
    return output;
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: string }).stdout ?? '';
    }
    return '';
  }
}

interface SmokeResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface McpToolProbe {
  server: string;
  prompt: string;
  // Primary: model explicitly reports success
  successPattern: RegExp;
  // Secondary: tool was invoked (even if it errored, proves server connectivity)
  invokedPattern: RegExp;
}

// Lightweight tool calls to verify each MCP server actually responds.
// Prompts avoid double quotes to prevent shell escaping issues.
const MCP_TOOL_PROBES: McpToolProbe[] = [
  {
    server: 'context7',
    prompt: 'Call the context7-resolve-library-id tool with libraryName set to react and query set to react hooks. If it returns data, say CONTEXT7_OK. If it fails, say CONTEXT7_FAIL.',
    successPattern: /CONTEXT7_OK/i,
    invokedPattern: /context7-resolve-library-id/i,
  },
  {
    server: 'playwright',
    prompt: 'Call the playwright-browser_tabs tool with action set to list. If it returns data or an error response, say PLAYWRIGHT_OK. If the tool is not found, say PLAYWRIGHT_FAIL.',
    successPattern: /PLAYWRIGHT_OK/i,
    invokedPattern: /playwright-browser_tabs/i,
  },
  {
    server: 'azure',
    prompt: 'Call the azure-documentation tool with intent set to azure functions overview and learn set to true. If it returns data, say AZURE_OK. If it fails, say AZURE_FAIL.',
    successPattern: /AZURE_OK/i,
    invokedPattern: /azure-documentation/i,
  },
  {
    server: 'microsoft-learn',
    prompt: 'Call the microsoft-learn-microsoft_docs_search tool with query set to azure functions. If it returns data, say MSLEARN_OK. If it fails, say MSLEARN_FAIL.',
    successPattern: /MSLEARN_OK/i,
    invokedPattern: /microsoft-learn-microsoft_docs_search/i,
  },
];

export function test(rootDir: string, args: string[]): void {
  const options = parseArgs(args);
  const localPluginPath = join(rootDir, 'plugin');

  console.log('\n🧪 Integration Test - Live Copilot CLI Verification\n');
  console.log('────────────────────────────────────────────────────────────');

  if (!existsSync(localPluginPath)) {
    console.log('   ❌ Plugin directory not found. Run "npm run local setup" first.\n');
    process.exitCode = 1;
    return;
  }

  const productionSkills = getProductionSkills(localPluginPath);
  const expectedMcpServers = getExpectedMcpServers(localPluginPath);

  console.log(`   📦 Production skills: ${productionSkills.length}`);
  console.log(`   🔌 Expected MCP servers: ${expectedMcpServers.join(', ') || 'none'}`);

  // Create probe skill
  console.log('\n   📝 Creating temporary probe skill...');
  let probeDir: string;
  try {
    probeDir = createProbeSkill(localPluginPath);
    console.log(`   ✅ Created: ${probeDir}`);
  } catch (error) {
    console.log(`   ❌ Failed to create probe skill: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
    return;
  }

  const results: SmokeResult[] = [];

  try {
    // Test 1: Probe skill detection (proves local plugin is loaded)
    console.log('\n🧪 Test 1: Local Plugin Loading (probe skill)');
    console.log('   ⏳ Launching Copilot CLI...');

    const probePrompt = `You have a skill called ${PROBE_SKILL_NAME}. If you can see it in your available skills, respond with exactly: ${PROBE_MARKER}. If you cannot find it, respond with: PROBE_NOT_FOUND. Do not use any tools. Just check your loaded skills and respond.`;
    const probeOutput = runCopilotPrompt(probePrompt, options.verbose);

    if (options.verbose) {
      console.log(`   📄 Output (first 500 chars): ${probeOutput.slice(0, 500)}`);
    }

    const probeFound = probeOutput.includes(PROBE_MARKER);
    results.push({
      name: 'Local plugin loaded',
      passed: probeFound,
      detail: probeFound
        ? 'Probe skill found — Copilot is reading from local plugin directory'
        : 'Probe skill NOT found — Copilot may not be using local plugin',
    });
    console.log(`   ${probeFound ? '✅' : '❌'} ${results[results.length - 1].detail}`);

    // Test 2: Production skills registered
    console.log('\n🧪 Test 2: Production Skills Registration');
    console.log('   ⏳ Asking Copilot to list skills...');

    const skillsPrompt = `List ALL your available skills by name. Output each skill name on its own line. Do not use any tools. Just list the skill names from your loaded plugins.`;
    const skillsOutput = runCopilotPrompt(skillsPrompt, options.verbose);

    if (options.verbose) {
      console.log(`   📄 Output (first 500 chars): ${skillsOutput.slice(0, 500)}`);
    }

    const outputLower = skillsOutput.toLowerCase();
    const foundSkills = productionSkills.filter(s => outputLower.includes(s.toLowerCase()));
    const missingSkills = productionSkills.filter(s => !outputLower.includes(s.toLowerCase()));

    const skillsPassed = missingSkills.length === 0;
    results.push({
      name: 'Production skills',
      passed: skillsPassed,
      detail: skillsPassed
        ? `All ${productionSkills.length} production skills registered`
        : `${missingSkills.length} missing: ${missingSkills.join(', ')}`,
    });
    console.log(`   ${skillsPassed ? '✅' : '❌'} ${results[results.length - 1].detail}`);
    if (!skillsPassed && foundSkills.length > 0) {
      console.log(`   ✅ Found ${foundSkills.length}: ${foundSkills.join(', ')}`);
    }

    // Test 3: MCP servers connected
    // Use a single combined prompt to check all MCP tools at once (faster, one copilot launch)
    if (expectedMcpServers.length > 0) {
      console.log('\n🧪 Test 3: MCP Server Connectivity');
      console.log('   ⏳ Asking Copilot to list tool names...');

      // Tools use the {server}-{tool} naming pattern, so we can detect servers from tool names
      const mcpPrompt = `List every tool name you have access to. Output each tool name on its own line. Include MCP tools. Do not use any tools, just list them.`;
      const mcpOutput = runCopilotPrompt(mcpPrompt, options.verbose);

      if (options.verbose) {
        console.log(`   📄 Output (first 800 chars): ${mcpOutput.slice(0, 800)}`);
      }

      const mcpLower = mcpOutput.toLowerCase();
      // MCP tools use {server}-{tool} or {server}_{tool} pattern
      // Also check for server name mentioned directly
      const foundServers = expectedMcpServers.filter(s => {
        const sLower = s.toLowerCase();
        return mcpLower.includes(`${sLower}-`) ||
               mcpLower.includes(`${sLower}_`) ||
               mcpLower.includes(sLower);
      });
      const missingServers = expectedMcpServers.filter(s => !foundServers.includes(s));

      const mcpPassed = missingServers.length === 0;
      results.push({
        name: 'MCP servers',
        passed: mcpPassed,
        detail: mcpPassed
          ? `All ${expectedMcpServers.length} MCP servers connected`
          : `${missingServers.length} missing: ${missingServers.join(', ')}`,
      });
      console.log(`   ${mcpPassed ? '✅' : '❌'} ${results[results.length - 1].detail}`);
      if (!mcpPassed && foundServers.length > 0) {
        console.log(`   ✅ Found ${foundServers.length}: ${foundServers.join(', ')}`);
      }
    }

    // Test 4: Per-server tool invocation
    console.log('\n🧪 Test 4: MCP Server Tool Invocation');
    console.log('   ⏳ Testing each MCP server with a real tool call...');

    const serverResults: { server: string; passed: boolean; detail: string }[] = [];

    for (const probe of MCP_TOOL_PROBES) {
      // Skip servers not in our expected list
      if (!expectedMcpServers.includes(probe.server)) continue;

      console.log(`\n   🔌 ${probe.server}:`);
      console.log('      ⏳ Calling tool...');

      const output = runCopilotPrompt(probe.prompt, options.verbose);

      if (options.verbose) {
        console.log(`      📄 Output (first 300 chars): ${output.slice(0, 300)}`);
      }

      const passed = probe.successPattern.test(output);
      const invoked = probe.invokedPattern.test(output);
      // Server is working if tool was called (even if it errored due to setup like missing Chrome)
      const serverOk = passed || invoked;
      let detail: string;
      if (passed) {
        detail = 'Tool call succeeded';
      } else if (invoked) {
        detail = 'Tool was invoked (server responded, but tool returned an error — may need setup)';
      } else {
        detail = 'Tool call failed — server may not be connected';
      }
      serverResults.push({ server: probe.server, passed: serverOk, detail });
      console.log(`      ${serverOk ? '✅' : '❌'} ${detail}`);
    }

    const toolTestPassed = serverResults.every(r => r.passed);
    results.push({
      name: 'MCP tool invocation',
      passed: toolTestPassed,
      detail: toolTestPassed
        ? `All ${serverResults.length} MCP servers responded to tool calls`
        : `${serverResults.filter(r => !r.passed).map(r => r.server).join(', ')} failed`,
    });
  } finally {
    // Always clean up probe skill
    console.log('\n   🧹 Cleaning up probe skill...');
    removeProbeSkill(localPluginPath);
    console.log('   ✅ Probe skill removed');
  }

  // Summary
  console.log('\n────────────────────────────────────────────────────────────');

  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n✅ TEST PASSED\n');
    console.log('   Copilot CLI is correctly loading local plugin,');
    console.log('   all production skills are registered, and MCP servers are connected.\n');
  } else {
    console.log('\n❌ TEST FAILED\n');
    for (const r of results) {
      console.log(`   ${r.passed ? '✅' : '❌'} ${r.name}: ${r.detail}`);
    }
    console.log('\n   Run "npm run local setup --force" then retry.\n');
    process.exitCode = 1;
  }
}
