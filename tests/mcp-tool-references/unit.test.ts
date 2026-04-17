import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_NAME_PREFIX = "mcp_azure_mcp_";
const TOOL_NAME_PATTERN = /mcp_azure_mcp_[a-z0-9_-]+/g;
// Legacy alias still appears in committed skill markdown while Azure MCP exposes get_azure_bestpractices.
// Remove this mapping once all `mcp_azure_mcp_get_bestpractices` references are migrated in skill docs.
const TOOL_NAME_ALIASES: Record<string, string> = {
  get_bestpractices: "get_azure_bestpractices",
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.resolve(__dirname, "../fixtures/azure-mcp-tool-names.snapshot.json");
const skillsRoot = path.resolve(__dirname, "../../plugin/skills");

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

describe("Azure MCP tool references in skill markdown", () => {
  test("all referenced mcp_azure_mcp_* tool names exist in the snapshot", () => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      toolNames: string[];
    };
    const validToolNames = new Set(snapshot.toolNames);

    expect(validToolNames.size).toBeGreaterThan(0);

    const unknownReferences: string[] = [];

    for (const markdownPath of collectMarkdownFiles(skillsRoot)) {
      const content = readFileSync(markdownPath, "utf8");
      const matches = content.match(TOOL_NAME_PATTERN) ?? [];

      for (const toolReference of matches) {
        const normalizedTool = toolReference.toLowerCase();
        const toolName = normalizedTool.slice(TOOL_NAME_PREFIX.length);
        const resolvedToolName = TOOL_NAME_ALIASES[toolName] ?? toolName;
        if (validToolNames.has(resolvedToolName)) {
          continue;
        }

        const relativePath = path.relative(skillsRoot, markdownPath);
        unknownReferences.push(`${toolReference} (${relativePath})`);
      }
    }

    expect(unknownReferences).toEqual([]);
  });

  test("snapshot file exists and has expected shape", () => {
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      source?: string;
      toolReferenceConvention?: string;
      azureMcpVersion?: string;
      toolNames?: string[];
    };

    expect(typeof snapshot.source).toBe("string");
    expect(snapshot.toolReferenceConvention).toBe(
      "References must match exact tool names from toolNames. Compound forms like <toolName>_* are not supported.",
    );
    expect(typeof snapshot.azureMcpVersion).toBe("string");
    expect(Array.isArray(snapshot.toolNames)).toBe(true);
    expect(snapshot.toolNames?.length).toBeGreaterThan(0);
    expect(statSync(snapshotPath).size).toBeGreaterThan(0);
  });
});
