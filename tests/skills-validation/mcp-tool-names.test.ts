/**
 * MCP Tool Name Validation Tests
 *
 * Validates that all Azure MCP tool names referenced in skill markdown files
 * are present in the static snapshot `azure-mcp-tools.json`.
 *
 * Two naming conventions are supported:
 *   - `mcp_azure_mcp_<tool>` — GitHub Copilot MCP tool reference format
 *   - `azure__<tool>`        — Alternative GitHub Copilot MCP tool reference format
 *
 * The tool list is read from a static JSON snapshot so the test is fast,
 * offline, and deterministic. Update the snapshot when new tools are added to
 * the @azure/mcp server (tracked in issue #1933).
 *
 * Run: npm run test:unit -- --testPathPatterns=mcp-tool-names
 *
 * The snapshot is the canonical `tests/fixtures/azure-mcp-tool-names.snapshot.json`,
 * refreshed via `npm run update:mcp-tool-snapshot`.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.resolve(__dirname, "../../plugin/skills");
const SNAPSHOT_PATH = path.resolve(__dirname, "../fixtures/azure-mcp-tool-names.snapshot.json");

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
// Snapshot helpers
// ---------------------------------------------------------------------------

/**
 * Reads the canonical Azure MCP tool name snapshot from
 * `tests/fixtures/azure-mcp-tool-names.snapshot.json` and returns the set of
 * valid tool names. Refresh the snapshot with `npm run update:mcp-tool-snapshot`.
 */
function getAzureMcpToolNamesFromSnapshot(): Set<string> {
  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
  const snapshot = JSON.parse(raw) as { toolNames: string[] };
  if (!Array.isArray(snapshot.toolNames)) {
    throw new Error(
      `azure-mcp-tool-names.snapshot.json is malformed: "toolNames" must be an array`
    );
  }
  return new Set(snapshot.toolNames);
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

  beforeAll(() => {
    validToolNames = getAzureMcpToolNamesFromSnapshot();
    allReferences = findMarkdownFiles(SKILLS_DIR).flatMap(extractToolReferences);
  });

  test("snapshot contains at least one tool", () => {
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
