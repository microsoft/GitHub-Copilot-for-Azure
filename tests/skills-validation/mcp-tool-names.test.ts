/**
 * MCP Tool Name Validation Tests
 *
 * Validates that all Azure MCP tool names referenced in skill markdown files
 * match the actual tools exposed by the Azure MCP server.
 *
 * Two naming conventions are supported:
 *   - `mcp_azure_mcp_<tool>` — GitHub Copilot MCP tool reference format
 *   - `azure__<tool>`        — Alternative GitHub Copilot MCP tool reference format
 *
 * Run: npm run test:unit -- --testPathPattern=mcp-tool-names
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.resolve(__dirname, "../../plugin/skills");

/** Tool reference found in a markdown file */
interface ToolReference {
  /** The extracted tool name (portion after the prefix) */
  toolName: string;
  /** Absolute path to the markdown file */
  filePath: string;
  /** 1-based line number */
  line: number;
  /** Trimmed source line for context */
  context: string;
}

// ---------------------------------------------------------------------------
// Regex patterns – note the 'g' flag is applied per-line in the scan loop
// ---------------------------------------------------------------------------
// Matches: mcp_azure_mcp_<tool>
const MCP_AZURE_MCP_RE = /mcp_azure_mcp_([a-z][a-z0-9_]*)/g;
// Matches: azure__<tool>
const AZURE_DOUBLE_UNDERSCORE_RE = /azure__([a-z][a-z0-9_]*)/g;

const PATTERNS = [MCP_AZURE_MCP_RE, AZURE_DOUBLE_UNDERSCORE_RE];

// ---------------------------------------------------------------------------
// MCP server helpers
// ---------------------------------------------------------------------------

/**
 * Queries the Azure MCP server via JSON-RPC and returns the set of valid tool
 * names it exposes. The server process is terminated as soon as the list is
 * received.
 */
function getAzureMcpToolNames(): Promise<Set<string>> {
  return new Promise<Set<string>>((resolve, reject) => {
    const serverProcess = spawn("npx", ["-y", "@azure/mcp@latest", "server", "start"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const toolNames = new Set<string>();
    let stdoutBuffer = "";
    let initialized = false;

    serverProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed: { id?: number; result?: { tools?: Array<{ name: string }> } };
        try {
          parsed = JSON.parse(line) as typeof parsed;
        } catch {
          // Skip non-JSON lines (server startup/log output)
          continue;
        }

        if (parsed.id === 1 && !initialized) {
          // Server acknowledged initialization; request the tool list
          initialized = true;
          serverProcess.stdin.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "tools/list",
              params: {},
            }) + "\n",
          );
        } else if (parsed.id === 2 && parsed.result) {
          for (const tool of parsed.result.tools ?? []) {
            if (tool.name) toolNames.add(tool.name);
          }
          // Destroy stdio streams before killing to avoid open-handle warnings
          serverProcess.stdin.destroy();
          serverProcess.stdout.destroy();
          serverProcess.stderr?.destroy();
          serverProcess.kill();
          resolve(toolNames);
        }
      }
    });

    serverProcess.on("error", (err) => reject(err));

    // Send the MCP initialize request
    serverProcess.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-tool-name-validator", version: "1.0" },
        },
      }) + "\n",
    );

    const timeoutHandle = setTimeout(() => {
      serverProcess.kill();
      if (toolNames.size > 0) {
        resolve(toolNames);
      } else {
        reject(new Error("Timed out waiting for Azure MCP server tools/list response"));
      }
    }, 110_000); // slightly below the beforeAll timeout of 120s to allow Jest to report the error

    // Unref the timeout so it doesn't keep the Node.js event loop alive
    timeoutHandle.unref();

    serverProcess.on("close", () => clearTimeout(timeoutHandle));

    // Unref the child process so it doesn't prevent the Jest worker from exiting
    serverProcess.unref();
  });
}

// ---------------------------------------------------------------------------
// Markdown scanning helpers
// ---------------------------------------------------------------------------

/** Recursively collects all *.md file paths under a directory. */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Returns every Azure MCP tool reference found in the given markdown file,
 * including the tool name suffix, file path, line number, and source context.
 */
function extractToolReferences(filePath: string): ToolReference[] {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const refs: ToolReference[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0; // Reset stateful regex
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lineText)) !== null) {
        refs.push({
          toolName: match[1],
          filePath,
          line: i + 1,
          context: lineText.trim(),
        });
      }
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Azure MCP Tool Name Validation", () => {
  let validToolNames: Set<string>;
  let allReferences: ToolReference[];

  beforeAll(async () => {
    validToolNames = await getAzureMcpToolNames();
    allReferences = findMarkdownFiles(SKILLS_DIR).flatMap(extractToolReferences);
  }, 120_000); // Allow up to 2 minutes for the MCP server to start

  test("Azure MCP server exposes at least one tool", () => {
    expect(validToolNames.size).toBeGreaterThan(0);
  });

  test("all Azure MCP tool names referenced in skill markdown files are valid", () => {
    const invalidRefs = allReferences.filter((ref) => !validToolNames.has(ref.toolName));

    // Format invalid references for display in the failure message
    const invalidRefDescriptions = invalidRefs.map((ref) => {
      const rel = path.relative(SKILLS_DIR, ref.filePath);
      return `${rel}:${ref.line} — "${ref.toolName}" is not a valid Azure MCP tool name`;
    });

    expect(invalidRefDescriptions).toHaveLength(0);
  });
});
