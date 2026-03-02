#!/usr/bin/env node

/**
 * Quality Report Generator
 *
 * Post-processes raw test outputs (JUnit XML, token-usage.json, agent-metadata)
 * into a single skill-quality-report.json contract file.
 *
 * This is the "Layer 2" processor — sits between raw pipeline outputs and the
 * reporting dashboard. The dashboard reads only this JSON, doing zero processing.
 *
 * Usage:
 *   node generate-quality-report.js                  # Process most recent test run
 *   node generate-quality-report.js --run <run-dir>  # Process a specific test run
 *   node generate-quality-report.js --junit <path>   # Use a specific JUnit XML
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_PATH = path.resolve(__dirname, "../reports");
const TEST_RUN_PREFIX = "test-run-";
const CONTRACT_VERSION = "1.0";

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let runDir = null;
  let junitPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run" && i + 1 < args.length) runDir = args[++i];
    if (args[i] === "--junit" && i + 1 < args.length) junitPath = args[++i];
  }

  return { runDir, junitPath };
}

// ─── Find Most Recent Test Run ───────────────────────────────────────────────

function getMostRecentTestRun() {
  if (!fs.existsSync(REPORTS_PATH)) return null;
  const entries = fs.readdirSync(REPORTS_PATH, { withFileTypes: true });
  const testRuns = entries
    .filter(e => e.isDirectory() && e.name.startsWith(TEST_RUN_PREFIX))
    .map(e => e.name)
    .sort()
    .reverse();
  return testRuns.length > 0 ? testRuns[0] : null;
}

// ─── JUnit XML Parser (regex-based, matches existing show-test-results.js) ──

function extractAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function parseJunitXml(xmlPath) {
  if (!fs.existsSync(xmlPath)) return null;
  const xml = fs.readFileSync(xmlPath, "utf-8");

  const result = {
    totalTests: 0,
    failures: 0,
    errors: 0,
    time: 0,
    suites: [],
  };

  const headerMatch = xml.match(/<testsuites[^>]*>/);
  if (headerMatch) {
    const attrs = headerMatch[0];
    result.totalTests = parseInt(extractAttr(attrs, "tests") || "0", 10);
    result.failures = parseInt(extractAttr(attrs, "failures") || "0", 10);
    result.errors = parseInt(extractAttr(attrs, "errors") || "0", 10);
    result.time = parseFloat(extractAttr(attrs, "time") || "0");
  }

  const suiteRegex = /<testsuite(?!s)[^>]*>[\s\S]*?<\/testsuite>/g;
  let suiteMatch;
  while ((suiteMatch = suiteRegex.exec(xml)) !== null) {
    const suiteXml = suiteMatch[0];
    const suiteAttrsMatch = suiteXml.match(/<testsuite[^>]*>/);
    if (!suiteAttrsMatch) continue;

    const sa = suiteAttrsMatch[0];
    const suite = {
      name: extractAttr(sa, "name") || "Unknown",
      tests: parseInt(extractAttr(sa, "tests") || "0", 10),
      failures: parseInt(extractAttr(sa, "failures") || "0", 10),
      time: parseFloat(extractAttr(sa, "time") || "0"),
      testcases: [],
    };

    const tcRegex = /<testcase[^>]*>[\s\S]*?<\/testcase>|<testcase[^/]*\/>/g;
    let tcMatch;
    while ((tcMatch = tcRegex.exec(suiteXml)) !== null) {
      const tcXml = tcMatch[0];
      const tcAttrs = tcXml.match(/<testcase[^>]*>/)?.[0];
      if (!tcAttrs) continue;

      const tc = {
        classname: extractAttr(tcAttrs, "classname") || "",
        name: extractAttr(tcAttrs, "name") || "Unknown",
        time: parseFloat(extractAttr(tcAttrs, "time") || "0"),
        status: "passed",
        failure: null,
      };

      const failMatch = tcXml.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
      if (failMatch) {
        tc.status = "failed";
        tc.failure = failMatch[1].trim().substring(0, 500);
      }
      const errMatch = tcXml.match(/<error[^>]*>([\s\S]*?)<\/error>/);
      if (errMatch) {
        tc.status = "error";
        tc.failure = errMatch[1].trim().substring(0, 500);
      }
      if (tcXml.includes("<skipped")) tc.status = "skipped";

      suite.testcases.push(tc);
    }
    result.suites.push(suite);
  }
  return result;
}

// ─── Token Data Loader ───────────────────────────────────────────────────────

function loadTokenSummary(testRunPath) {
  const summaryPath = path.join(testRunPath, "token-summary.json");
  if (!fs.existsSync(summaryPath)) return [];
  return JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
}

// eslint-disable-next-line no-unused-vars
function loadPerTestTokenUsage(testRunPath) {
  const result = {};
  if (!fs.existsSync(testRunPath)) return result;

  const subdirs = fs.readdirSync(testRunPath, { withFileTypes: true })
    .filter(e => e.isDirectory());

  for (const dir of subdirs) {
    const tokenFile = path.join(testRunPath, dir.name, "token-usage.json");
    if (fs.existsSync(tokenFile)) {
      result[dir.name] = JSON.parse(fs.readFileSync(tokenFile, "utf-8"));
    }
  }
  return result;
}

// ─── Skill Area Extraction ───────────────────────────────────────────────────

/**
 * Extract skill area from test directory name or JUnit classname.
 * Handles both formats:
 *   Directory: "microsoft-foundry_deploy-model_-_Integration_Tests_..." → "microsoft-foundry/deploy-model"
 *   JUnit:     "microsoft-foundry_deploy-model - Integration Tests ›..." → "microsoft-foundry/deploy-model"
 *   JUnit:     "microsoft-foundry_ - Integration Tests" → "microsoft-foundry"
 */
function extractSkillArea(name) {
  // Try JUnit classname format first: "skill_sub - Integration Tests..."
  const match = name.match(/^(.+?)\s*-\s*Integration Tests/);
  if (match) {
    let skillPart = match[1].trim();
    // "microsoft-foundry_deploy-model" → "microsoft-foundry/deploy-model"
    // "microsoft-foundry_" → "microsoft-foundry"
    skillPart = skillPart.replace(/_$/, ""); // trailing underscore
    return skillPart.replace(/_/g, "/");
  }

  // Try directory name format: "skill_sub_-_Integration_Tests_..."
  const integrationIdx = name.indexOf("_-_Integration_Tests");
  if (integrationIdx !== -1) {
    const skillPart = name.substring(0, integrationIdx);
    return skillPart.replace(/_/g, "/");
  }

  // Fallback
  const parts = name.split("_");
  return parts[0];
}

/**
 * Extract test case name from directory name.
 * e.g. "..._Tests_skill-invocation_invokes_skill_for_simple_model_deployment_prompt"
 * → "invokes skill for simple model deployment prompt"
 */
// eslint-disable-next-line no-unused-vars
function extractTestCase(dirName) {
  const marker = "_-_Integration_Tests_";
  const idx = dirName.indexOf(marker);
  if (idx === -1) return dirName;

  const afterMarker = dirName.substring(idx + marker.length);
  // Replace underscores with spaces and clean up
  return afterMarker.replace(/_/g, " ");
}

// ─── Tool Call Extraction from Markdown ──────────────────────────────────────

/**
 * Parse agent-metadata markdown files to extract tool calls sequence.
 * Returns array of { tool, args, reasoning } objects.
 */
function extractToolCalls(testRunPath, dirName) {
  const dirPath = path.join(testRunPath, dirName);
  if (!fs.existsSync(dirPath)) return [];

  const mdFiles = fs.readdirSync(dirPath)
    .filter(f => f.startsWith("agent-metadata-") && f.endsWith(".md"))
    .sort();

  const toolCalls = [];

  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(path.join(dirPath, mdFile), "utf-8");

    // Extract tool invocations from code blocks
    // Two formats in agent-metadata:
    //   1. skill invocation: ```\nskill: microsoft-foundry\n```
    //   2. tool invocation:  ```\ntool: view\narguments: {...}\nresponse: ...\n```
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    for (const block of codeBlocks) {
      const inner = block.replace(/```/g, "").trim();
      if (inner.startsWith("skill:")) {
        toolCalls.push({
          tool: "skill",
          args: inner.replace("skill:", "").trim(),
          source: mdFile,
        });
      } else if (inner.startsWith("tool:")) {
        // Parse tool: name\narguments: {...}\nresponse/error: ...
        const toolMatch = inner.match(/^tool:\s*(.+)/);
        if (toolMatch) {
          const toolName = toolMatch[1].trim();
          let args = "";
          let response = "";
          const argsMatch = inner.match(/arguments:\s*(\{[\s\S]*?\})/);
          if (argsMatch) {
            try {
              const parsed = JSON.parse(argsMatch[1]);
              args = Object.entries(parsed).map(([k,v]) => `${k}: ${typeof v === "string" ? v.substring(0, 80) : v}`).join(", ");
            } catch { args = argsMatch[1].substring(0, 100); }
          }
          const respMatch = inner.match(/(?:response|error):\s*([\s\S]*?)$/);
          if (respMatch) response = respMatch[1].trim().substring(0, 200);
          toolCalls.push({
            tool: toolName,
            args,
            response,
            source: mdFile,
          });
        }
      }
    }

    // Extract reasoning blocks
    const reasoningMatch = content.match(/> \*\*Reasoning:\*\*\n([\s\S]*?)(?=\n[^>]|\n$)/);
    if (reasoningMatch) {
      const lastCall = toolCalls[toolCalls.length - 1];
      if (lastCall) {
        lastCall.reasoning = reasoningMatch[1].replace(/^> /gm, "").trim();
      }
    }
  }

  return toolCalls;
}

// ─── Build Area Summaries ────────────────────────────────────────────────────

function buildAreaSummaries(junit, tokenEntries) {
  const areaMap = new Map();

  // Process JUnit test cases
  if (junit) {
    for (const suite of junit.suites) {
      for (const tc of suite.testcases) {
        const area = extractSkillArea(tc.classname.split(" › ")[0] || suite.name);
        if (!areaMap.has(area)) {
          areaMap.set(area, {
            name: area,
            tests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalLLMCalls: 0,
            totalDurationMs: 0,
            testDetails: [],
          });
        }
        const entry = areaMap.get(area);
        entry.tests++;
        if (tc.status === "passed") entry.passed++;
        else if (tc.status === "failed" || tc.status === "error") entry.failed++;
        else if (tc.status === "skipped") entry.skipped++;

        entry.testDetails.push({
          name: tc.name,
          status: tc.status,
          time: tc.time,
          failure: tc.failure,
        });
      }
    }
  }

  // Merge token data
  for (const tokenEntry of tokenEntries) {
    const area = extractSkillArea(tokenEntry.testName);
    if (!areaMap.has(area)) {
      areaMap.set(area, {
        name: area,
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalLLMCalls: 0,
        totalDurationMs: 0,
        testDetails: [],
      });
    }
    const entry = areaMap.get(area);
    entry.totalInputTokens += tokenEntry.inputTokens || 0;
    entry.totalOutputTokens += tokenEntry.outputTokens || 0;
    entry.totalLLMCalls += tokenEntry.apiCallCount || 0;
    entry.totalDurationMs += tokenEntry.totalApiDurationMs || 0;
  }

  // Compute derived metrics
  const areas = [];
  for (const [, entry] of areaMap) {
    const totalTests = entry.tests || 1;
    areas.push({
      name: entry.name,
      tests: entry.tests,
      passed: entry.passed,
      failed: entry.failed,
      skipped: entry.skipped,
      passRate: Math.round((entry.passed / totalTests) * 100 * 10) / 10,
      avgInputTokens: Math.round(entry.totalInputTokens / totalTests),
      avgOutputTokens: Math.round(entry.totalOutputTokens / totalTests),
      totalInputTokens: entry.totalInputTokens,
      totalOutputTokens: entry.totalOutputTokens,
      avgLLMCalls: Math.round((entry.totalLLMCalls / totalTests) * 10) / 10,
      totalLLMCalls: entry.totalLLMCalls,
      avgDurationMs: Math.round(entry.totalDurationMs / totalTests),
      testDetails: entry.testDetails,
    });
  }

  return areas.sort((a, b) => a.passRate - b.passRate);
}

// ─── Build Token Usage Per Test ──────────────────────────────────────────────

function buildTokenUsage(tokenEntries) {
  return tokenEntries.map(entry => ({
    testName: entry.testName,
    prompt: entry.prompt,
    timestamp: entry.timestamp,
    model: entry.model,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    cacheReadTokens: entry.cacheReadTokens || 0,
    cacheWriteTokens: entry.cacheWriteTokens || 0,
    llmCalls: entry.apiCallCount,
    durationMs: entry.totalApiDurationMs,
    perCall: (entry.perCallUsage || []).map((call, i) => ({
      call: i + 1,
      model: call.model,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      durationMs: call.durationMs,
      initiator: call.initiator,
    })),
  }));
}

// ─── Expected Path Definitions ───────────────────────────────────────────────

/**
 * Expected execution paths per skill area.
 * Each entry defines the ideal sequence of tool calls the agent should make.
 * Used for side-by-side comparison in the trace viewer.
 */
const EXPECTED_PATHS = {
  // Derived from passing test traces — each path reflects the common
  // tool-call sequence observed across successful test executions.
  "microsoft-foundry/deploy-model": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog deployment intent" },
      { tool: "view", label: "📖 Read skill doc\ndeploy-model SKILL.md" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nList/check resources" },
      { tool: "powershell", label: "💻 powershell\naz cognitiveservices deploy" },
    ],
    endLabel: "⬜ EXPECTED END\nModel deployed",
  },
  "microsoft-foundry/quota": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog quota check" },
      { tool: "view", label: "📖 Read skill doc\nquota SKILL.md" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nQuery Foundry resources" },
      { tool: "azure-quota", label: "📊 azure-quota\nRetrieve quota data" },
    ],
    endLabel: "⬜ EXPECTED END\nQuota info returned",
  },
  "microsoft-foundry/resource/create": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog resource creation" },
      { tool: "view", label: "📖 Read skill doc\nresource/create SKILL.md" },
      { tool: "powershell", label: "💻 powershell\naz group create" },
      { tool: "powershell", label: "💻 powershell\naz cognitiveservices create" },
    ],
    endLabel: "⬜ EXPECTED END\nResource created",
  },
  "microsoft-foundry/capacity": {
    steps: [
      { tool: "report_intent", label: "📋 report_intent\nLog capacity check" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nQuery Foundry resources" },
      { tool: "azure-quota", label: "📊 azure-quota\nCheck capacity/quota" },
      { tool: "azure-extension_cli_generate", label: "🔧 cli_generate\nGenerate CLI command" },
    ],
    endLabel: "⬜ EXPECTED END\nCapacity report shown",
  },
  "microsoft-foundry/customize-deployment": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog customization" },
      { tool: "view", label: "📖 Read skill doc\ncustomize-deployment SKILL.md" },
      { tool: "view", label: "📖 Read references\nDeployment config docs" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nApply custom settings" },
    ],
    endLabel: "⬜ EXPECTED END\nDeployment customized",
  },
  "microsoft-foundry/deploy-model-optimal-region": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog region search" },
      { tool: "view", label: "📖 Read skill doc\noptimal-region SKILL.md" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nCheck region availability" },
      { tool: "powershell", label: "💻 powershell\nDeploy to optimal region" },
      { tool: "azure-quota", label: "📊 azure-quota\nVerify region capacity" },
    ],
    endLabel: "⬜ EXPECTED END\nDeployed to best region",
  },
  "microsoft-foundry/create": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog agent creation" },
      { tool: "view", label: "📖 Read skill doc\ncreate agent SKILL.md" },
      { tool: "powershell", label: "💻 powershell\nSetup agent resources" },
    ],
    endLabel: "⬜ EXPECTED END\nAgent created",
  },
  "microsoft-foundry/foundry-agent": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog agent task" },
      { tool: "view", label: "📖 Read skill doc\nfoundry-agent SKILL.md" },
      { tool: "azure-foundry", label: "🏗️ azure-foundry\nManage agent resources" },
      { tool: "powershell", label: "💻 powershell\nExecute agent operation" },
    ],
    endLabel: "⬜ EXPECTED END\nAgent task complete",
  },
  "microsoft-foundry/observe": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog agent observe" },
      { tool: "view", label: "📖 Read skill doc\nobserve SKILL.md" },
      { tool: "powershell", label: "💻 powershell\nQuery agent metrics" },
    ],
    endLabel: "⬜ EXPECTED END\nAgent observability shown",
  },
  "microsoft-foundry": {
    steps: [
      { tool: "skill", args: "microsoft-foundry", label: "🔧 skill:\nmicrosoft-foundry" },
      { tool: "report_intent", label: "📋 report_intent\nLog skill routing" },
      { tool: "view", label: "📖 Read skill doc\nmicrosoft-foundry SKILL.md" },
      { tool: "view", label: "📖 Read sub-skill doc\nSub-skill reference" },
      { tool: "powershell", label: "💻 powershell\nExecute Azure operation" },
    ],
    endLabel: "⬜ EXPECTED END\nOperation complete",
  },
};

/**
 * Build expected path nodes and edges for a skill area.
 * Returns { nodes: [], edges: [] } with Cytoscape-ready data.
 */
function buildExpectedPath(skillArea) {
  const expectedDef = EXPECTED_PATHS[skillArea];
  if (!expectedDef) return null;

  const nodes = [];
  const edges = [];
  let prevId = "start"; // share start node with actual

  for (let i = 0; i < expectedDef.steps.length; i++) {
    const step = expectedDef.steps[i];
    const llmId = `el${i + 1}`;
    const stepId = `e${i + 1}`;

    // LLM call node
    nodes.push({
      id: llmId,
      label: `🤖 LLM Call #${i + 1}\nAnalyze & route`,
      type: "expected_llm",
      detail: { desc: `Expected: LLM decides to call ${step.tool}` },
    });
    edges.push({ source: prevId, target: llmId, type: "expected" });

    // Tool call node
    nodes.push({
      id: stepId,
      label: step.label,
      type: "expected",
      step: i + 1,
      detail: { tool: step.tool, args: step.args || "", desc: step.label.replace(/\n/g, " ") },
    });
    edges.push({ source: llmId, target: stepId, type: "expected" });

    prevId = stepId;
  }

  // End expected
  const endLlmId = `el${expectedDef.steps.length + 1}`;
  nodes.push({
    id: endLlmId,
    label: `🤖 LLM Call #${expectedDef.steps.length + 1}\nGenerate response`,
    type: "expected_llm",
    detail: { desc: "Expected: LLM generates final response to user" },
  });
  edges.push({ source: prevId, target: endLlmId, type: "expected" });

  nodes.push({
    id: "end_exp",
    label: expectedDef.endLabel,
    type: "endOk",
    shape: "ellipse",
    detail: { desc: "Expected outcome" },
  });
  edges.push({ source: endLlmId, target: "end_exp", type: "expected" });

  return { nodes, edges, stepCount: expectedDef.steps.length };
}

// ─── Build Execution Traces ──────────────────────────────────────────────────

/**
 * Build execution trace data for each test subdirectory.
 * Extracts tool call sequence from agent-metadata markdown files
 * and pairs with token data for each LLM call.
 */
function buildTraces(testRunPath, tokenEntries) {
  const traces = {};

  // Group token entries by testName
  const tokenByTest = new Map();
  for (const entry of tokenEntries) {
    if (!tokenByTest.has(entry.testName)) {
      tokenByTest.set(entry.testName, []);
    }
    tokenByTest.get(entry.testName).push(entry);
  }

  for (const [testName, entries] of tokenByTest) {
    // Use the last entry (most recent run) for this test
    const latestEntry = entries[entries.length - 1];
    const toolCalls = extractToolCalls(testRunPath, testName);

    // Build Cytoscape-ready nodes
    const nodes = [];
    const edges = [];

    // Start node
    nodes.push({
      id: "start",
      label: `🟢 START\n${(latestEntry.prompt || "").substring(0, 40)}`,
      type: "start",
      shape: "ellipse",
      detail: { prompt: latestEntry.prompt },
    });

    // Build actual path nodes from perCallUsage + tool calls
    const perCall = latestEntry.perCallUsage || [];
    let prevNodeId = "start";

    for (let i = 0; i < perCall.length; i++) {
      const call = perCall[i];
      const llmNodeId = `llm${i + 1}`;
      const toolCall = toolCalls[i]; // May not align 1:1

      // LLM call node
      nodes.push({
        id: llmNodeId,
        label: `🤖 LLM Call #${i + 1}\n${call.inputTokens.toLocaleString()}↓ ${call.outputTokens.toLocaleString()}↑`,
        type: "llmcall",
        detail: {
          desc: `LLM inference call #${i + 1}`,
          tokens: { in: call.inputTokens, out: call.outputTokens },
          durationMs: call.durationMs,
          model: call.model,
        },
      });

      edges.push({
        source: prevNodeId,
        target: llmNodeId,
        type: "llmcall",
        label: `${call.inputTokens.toLocaleString()} in`,
      });

      // If there's a corresponding tool call, add it
      if (toolCall) {
        const toolNodeId = `t${i + 1}`;
        nodes.push({
          id: toolNodeId,
          label: `🔧 ${toolCall.tool}\n${toolCall.args.substring(0, 30)}`,
          type: "matched",
          detail: {
            tool: toolCall.tool,
            args: toolCall.args,
            reasoning: toolCall.reasoning,
          },
        });
        edges.push({
          source: llmNodeId,
          target: toolNodeId,
          type: "matched",
          label: `${call.outputTokens.toLocaleString()} out`,
        });
        prevNodeId = toolNodeId;
      } else {
        prevNodeId = llmNodeId;
      }
    }

    // End node
    const endNodeId = "end_act";
    nodes.push({
      id: endNodeId,
      label: `⬜ END\n${perCall.length} LLM calls`,
      type: "endOk",
      shape: "ellipse",
      detail: {
        totalTokens: {
          in: latestEntry.inputTokens,
          out: latestEntry.outputTokens,
          apiCalls: latestEntry.apiCallCount,
        },
      },
    });
    edges.push({ source: prevNodeId, target: endNodeId, type: "matched" });

    traces[testName] = {
      prompt: latestEntry.prompt,
      model: latestEntry.model,
      summary: {
        inputTokens: latestEntry.inputTokens,
        outputTokens: latestEntry.outputTokens,
        apiCalls: latestEntry.apiCallCount,
        durationMs: latestEntry.totalApiDurationMs,
      },
      nodes,
      edges,
    };

    // Add expected path and compute path adherence if available
    const skillArea = extractSkillArea(testName);
    const expectedPath = buildExpectedPath(skillArea);
    if (expectedPath) {
      traces[testName].expectedNodes = expectedPath.nodes;
      traces[testName].expectedEdges = expectedPath.edges;
      traces[testName].expectedSteps = expectedPath.stepCount;

      // Compute path adherence: compare actual tool calls vs expected steps
      const actualTools = nodes.filter(n => n.type === "matched").map(n => ({
        tool: n.detail.tool,
        args: n.detail.args || "",
      }));
      const expectedSteps = expectedPath.nodes
        .filter(n => n.type === "expected")
        .map(n => ({ tool: n.detail.tool, args: n.detail.args || "" }));

      let matched = 0, deviated = 0, extra = 0;
      const matchedExpectedIdx = new Set();

      for (let ai = 0; ai < actualTools.length; ai++) {
        const at = actualTools[ai];
        // Find matching expected step (in order, not yet matched)
        let found = false;
        for (let ei = 0; ei < expectedSteps.length; ei++) {
          if (matchedExpectedIdx.has(ei)) continue;
          const et = expectedSteps[ei];
          if (at.tool === et.tool && (et.args === "" || at.args.includes(et.args))) {
            matched++;
            matchedExpectedIdx.add(ei);
            found = true;
            // Update node type to 'matched'
            nodes[nodes.findIndex(n => n.id === `t${ai + 1}`)].type = "matched";
            break;
          }
        }
        if (!found) {
          // Check if tool exists in expected but wrong order/args → deviated
          const anyMatch = expectedSteps.some(et => at.tool === et.tool);
          if (anyMatch) {
            deviated++;
            const nodeIdx = nodes.findIndex(n => n.id === `t${ai + 1}`);
            if (nodeIdx >= 0) {
              nodes[nodeIdx].type = "deviated";
              nodes[nodeIdx].label = nodes[nodeIdx].label.replace("🔧", "❌");
            }
            // Update edge type too
            const edgeIdx = edges.findIndex(e => e.target === `t${ai + 1}`);
            if (edgeIdx >= 0) edges[edgeIdx].type = "deviated";
          } else {
            extra++;
            const nodeIdx = nodes.findIndex(n => n.id === `t${ai + 1}`);
            if (nodeIdx >= 0) {
              nodes[nodeIdx].type = "extra";
              nodes[nodeIdx].label = nodes[nodeIdx].label.replace("🔧", "⚡");
            }
            const edgeIdx = edges.findIndex(e => e.target === `t${ai + 1}`);
            if (edgeIdx >= 0) edges[edgeIdx].type = "extra";
          }
        }
      }

      const skipped = expectedSteps.length - matchedExpectedIdx.size;
      const adherence = expectedSteps.length > 0
        ? Math.round((matched / expectedSteps.length) * 100)
        : 0;

      // Update end node based on adherence
      const endNode = nodes.find(n => n.id === "end_act");
      if (endNode) {
        if (adherence >= 70) {
          endNode.type = "endOk";
          endNode.label = `🟢 END\n${adherence}% adherence`;
        } else if (adherence >= 40) {
          endNode.type = "endWarn";
          endNode.label = `🟡 END\n${adherence}% adherence`;
        } else {
          endNode.type = "endBad";
          endNode.label = `🔴 END\n${adherence}% adherence`;
        }
      }

      traces[testName].pathAdherence = {
        expected: expectedSteps.length,
        actual: actualTools.length,
        matched,
        deviated,
        extra,
        skipped,
        adherence,
      };
    }
  }

  return traces;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const { runDir, junitPath } = parseArgs(process.argv);

  // Resolve test run directory
  let testRunName = runDir;
  if (!testRunName) {
    testRunName = getMostRecentTestRun();
    if (!testRunName) {
      console.error("❌ No test runs found in", REPORTS_PATH);
      process.exit(1);
    }
  }
  const testRunPath = path.join(REPORTS_PATH, testRunName);
  console.log(`📂 Processing test run: ${testRunName}`);

  // Parse JUnit XML
  const resolvedJunit = junitPath || path.join(REPORTS_PATH, "junit.xml");
  console.log(`📋 Reading JUnit XML: ${resolvedJunit}`);
  const junit = parseJunitXml(resolvedJunit);

  // Load token data
  console.log("🔢 Loading token data...");
  const tokenEntries = loadTokenSummary(testRunPath);
  console.log(`   Found ${tokenEntries.length} token entries`);

  // Build report sections
  console.log("📊 Building area summaries...");
  const areas = buildAreaSummaries(junit, tokenEntries);

  console.log("💬 Building token usage details...");
  const tokenUsage = buildTokenUsage(tokenEntries);

  console.log("🔀 Building execution traces...");
  const traces = buildTraces(testRunPath, tokenEntries);

  // Compute global summary
  const totalTests = junit ? junit.totalTests : areas.reduce((s, a) => s + a.tests, 0);
  const totalPassed = areas.reduce((s, a) => s + a.passed, 0);
  const totalFailed = areas.reduce((s, a) => s + a.failed, 0);
  const totalInputTokens = areas.reduce((s, a) => s + a.totalInputTokens, 0);
  const totalOutputTokens = areas.reduce((s, a) => s + a.totalOutputTokens, 0);
  const totalLLMCalls = areas.reduce((s, a) => s + a.totalLLMCalls, 0);

  // Build the contract
  const report = {
    version: CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    testRun: testRunName,
    model: tokenEntries.length > 0 ? tokenEntries[0].model : "unknown",

    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      passRate: totalTests > 0 ? Math.round((totalPassed / totalTests) * 100 * 10) / 10 : 0,
      totalInputTokens,
      totalOutputTokens,
      totalLLMCalls,
      avgTokensPerTest: totalTests > 0
        ? Math.round((totalInputTokens + totalOutputTokens) / totalTests)
        : 0,
      totalDurationSec: junit ? Math.round(junit.time) : 0,
    },

    areas,
    tokenUsage,
    traces,
  };

  // Write output
  const outputPath = path.join(testRunPath, "skill-quality-report.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n✅ Report generated: ${outputPath}`);
  console.log(`   Version: ${CONTRACT_VERSION}`);
  console.log(`   Tests: ${totalTests} (${totalPassed} passed, ${totalFailed} failed)`);
  console.log(`   Areas: ${areas.length}`);
  console.log(`   Traces: ${Object.keys(traces).length}`);
  console.log(`   Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`   Total LLM calls: ${totalLLMCalls}`);
}

main();
