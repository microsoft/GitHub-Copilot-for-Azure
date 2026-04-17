import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.resolve(__dirname, "../fixtures/azure-mcp-tool-names.snapshot.json");
const skillsRoot = path.resolve(__dirname, "../../plugin/skills");

// Two naming conventions for Azure MCP tool references in skill markdown:
//   mcp_azure_mcp_<tool>  — GitHub Copilot MCP tool reference format
//   azure__<tool>          — Alternative GitHub Copilot MCP tool reference format
const MCP_AZURE_MCP_RE = /mcp_azure_mcp_([a-z][a-z0-9_]*)/g;
const AZURE_DOUBLE_UNDERSCORE_RE = /azure__([a-z][a-z0-9_]*)/g;

// Legacy alias: remove once all `get_bestpractices` references are migrated (see azure-cost skill).
const TOOL_NAME_ALIASES: Record<string, string> = {
  get_bestpractices: "get_azure_bestpractices",
};

interface ToolReference {
  toolName: string;
  filePath: string;
  line: number;
  context: string;
  pattern: string;
}

function collectMarkdownFiles(rootDir: string): string[] {
  const markdownFiles: string[] = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      markdownFiles.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      markdownFiles.push(fullPath);
    }
  }

  return markdownFiles;
}

function extractToolReferences(filePath: string): ToolReference[] {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const refs: ToolReference[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    for (const [pattern, re] of [
      ["mcp_azure_mcp_", MCP_AZURE_MCP_RE],
      ["azure__", AZURE_DOUBLE_UNDERSCORE_RE],
    ] as [string, RegExp][]) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(lineText)) !== null) {
        refs.push({
          toolName: match[1],
          filePath,
          line: i + 1,
          context: lineText.trim(),
          pattern,
        });
      }
    }
  }

  return refs;
}

describe("Azure MCP tool references in skill markdown", () => {
  let validToolNames: Set<string>;
  let snapshotToolNames: string[];
  let allReferences: ToolReference[];

  beforeAll(() => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      source?: string;
      azureMcpVersion?: string;
      toolNames: string[];
    };
    snapshotToolNames = snapshot.toolNames;
    validToolNames = new Set(snapshotToolNames);
    allReferences = collectMarkdownFiles(skillsRoot).flatMap(extractToolReferences);
  });

  test("snapshot file exists and has expected shape", () => {
    const raw = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      source?: string;
      azureMcpVersion?: string;
      toolNames?: string[];
    };

    expect(typeof raw.source).toBe("string");
    expect(typeof raw.azureMcpVersion).toBe("string");
    expect(Array.isArray(raw.toolNames)).toBe(true);
    expect(raw.toolNames?.length).toBeGreaterThan(0);
    expect(statSync(snapshotPath).size).toBeGreaterThan(0);
  });

  test("all referenced mcp_azure_mcp_* and azure__* tool names exist in the snapshot", () => {
    const unknownReferences: string[] = [];

    for (const ref of allReferences) {
      const resolvedToolName = TOOL_NAME_ALIASES[ref.toolName] ?? ref.toolName;

      if (validToolNames.has(resolvedToolName)) {
        continue;
      }

      // Allow namespaced tool references like mcp_azure_mcp_storage_blob_list
      // where "storage" is a valid tool prefix.
      const hasValidNamespacePrefix = snapshotToolNames.some((snapshotToolName) =>
        resolvedToolName.startsWith(`${snapshotToolName}_`),
      );
      if (hasValidNamespacePrefix) {
        continue;
      }

      const relativePath = path.relative(skillsRoot, ref.filePath);
      unknownReferences.push(
        `${ref.pattern}${ref.toolName} (${relativePath}:${ref.line})`,
      );
    }

    expect(unknownReferences).toEqual([]);
  });
});
