/**
 * Tests for the shared SKILL.md parser
 */

import { describe, it, expect } from "vitest";
import { parseSkillContent } from "../parse-skill.js";

describe("parseSkillContent", () => {
  it("parses valid frontmatter", () => {
    const content = "---\nname: azure-deploy\ndescription: \"Deploy to Azure\"\n---\n\n# Heading";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.name).toBe("azure-deploy");
    expect(result!.data.description).toBe("Deploy to Azure");
    expect(result!.content).toContain("# Heading");
  });

  it("exposes raw YAML source", () => {
    const content = "---\nname: test\ndescription: >-\n  Folded text.\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.raw).toContain("description: >-");
    expect(result!.raw).toContain("name: test");
  });

  it("returns null when file does not start with ---", () => {
    expect(parseSkillContent("# Just markdown")).toBeNull();
  });

  it("returns null when closing --- is missing", () => {
    expect(parseSkillContent("---\nname: test\nno closing")).toBeNull();
  });

  it("returns null for empty frontmatter block", () => {
    expect(parseSkillContent("---\n---\n\n# Body")).toBeNull();
  });

  it("normalises Windows CRLF line-endings", () => {
    const content = "---\r\nname: test\r\ndescription: \"Hello\"\r\n---\r\n\r\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.name).toBe("test");
    expect(result!.raw).not.toContain("\r");
  });

  it("handles single-quoted YAML values", () => {
    const content = "---\nname: 'my-skill'\ndescription: 'A description'\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.name).toBe("my-skill");
    expect(result!.data.description).toBe("A description");
  });

  it("handles escaped quotes in double-quoted strings", () => {
    const content = "---\nname: test\ndescription: \"Say \\\"hello\\\"\"\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.description).toBe("Say \"hello\"");
  });

  it("handles multi-line block scalars", () => {
    const content = "---\nname: test\ndescription: |\n  Line one.\n  Line two.\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.description).toContain("Line one.");
    expect(result!.data.description).toContain("Line two.");
    // raw should preserve the block scalar syntax
    expect(result!.raw).toContain("description: |");
  });

  it("handles folded scalars", () => {
    const content = "---\nname: test\ndescription: >-\n  Folded text\n  continues here.\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    // gray-matter folds into single line
    expect(result!.data.description).toContain("Folded text");
    // raw preserves original syntax
    expect(result!.raw).toContain("description: >-");
  });

  it("returns null for invalid YAML", () => {
    const content = "---\n: : invalid yaml [\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).toBeNull();
  });

  it("preserves additional frontmatter fields", () => {
    const content = "---\nname: test\ndescription: \"Hello\"\ncompatibility: copilot-chat\n---\n\n# Body";
    const result = parseSkillContent(content);
    expect(result).not.toBeNull();
    expect(result!.data.compatibility).toBe("copilot-chat");
  });
});
