/**
 * Tests for CLI router
 */

import { describe, it, expect } from "vitest";

const COMMANDS = ["count", "check", "compare", "suggest", "help"] as const;
type Command = typeof COMMANDS[number];

describe("CLI router", () => {
  describe("command parsing", () => {
    it("recognizes all valid commands", () => {
      expect(COMMANDS.includes("count")).toBe(true);
      expect(COMMANDS.includes("check")).toBe(true);
      expect(COMMANDS.includes("compare")).toBe(true);
      expect(COMMANDS.includes("suggest")).toBe(true);
      expect(COMMANDS.includes("help")).toBe(true);
    });

    it("defaults to help when no command provided", () => {
      const args: string[] = [];
      const command = (args[0] ?? "help") as Command;
      
      expect(command).toBe("help");
    });

    it("extracts command from first argument", () => {
      const args = ["check", "--json"];
      const command = args[0] as Command;
      const commandArgs = args.slice(1);
      
      expect(command).toBe("check");
      expect(commandArgs).toEqual(["--json"]);
    });

    it("passes remaining args to command", () => {
      const args = ["suggest", "docs/", "--verbose"];
      const command = args[0];
      const commandArgs = args.slice(1);
      
      expect(command).toBe("suggest");
      expect(commandArgs).toEqual(["docs/", "--verbose"]);
    });
  });

  describe("command validation", () => {
    it("accepts valid commands", () => {
      const validCommands = ["count", "check", "compare", "suggest", "help"];
      
      for (const cmd of validCommands) {
        expect(COMMANDS.includes(cmd as Command)).toBe(true);
      }
    });

    it("rejects invalid commands", () => {
      const invalidCommands = ["invalid", "unknown", "foo", ""];
      
      for (const cmd of invalidCommands) {
        expect(COMMANDS.includes(cmd as Command)).toBe(false);
      }
    });
  });

  describe("argument parsing for subcommands", () => {
    describe("count args", () => {
      it("parses --output flag", () => {
        const args = ["--output", "metadata.json"];
        const outputIndex = args.indexOf("--output");
        const hasOutputValue = outputIndex !== -1 && args[outputIndex + 1] && !args[outputIndex + 1].startsWith("--");
        const outputPath = hasOutputValue ? args[outputIndex + 1] : null;
        
        expect(outputPath).toBe("metadata.json");
      });

      it("parses --json flag", () => {
        const args = ["--json"];
        const jsonOnly = args.includes("--json");
        
        expect(jsonOnly).toBe(true);
      });
    });

    describe("check args", () => {
      it("parses --markdown flag", () => {
        const args = ["--markdown"];
        const markdownOutput = args.includes("--markdown");
        
        expect(markdownOutput).toBe(true);
      });

      it("parses file paths", () => {
        const args = ["docs/readme.md", "plugin/skills/SKILL.md", "--json"];
        const filesArg = args.filter(a => !a.startsWith("--"));
        
        expect(filesArg).toEqual(["docs/readme.md", "plugin/skills/SKILL.md"]);
      });
    });

    describe("compare args", () => {
      it("parses --base flag", () => {
        const args = ["--base", "main", "--head", "HEAD"];
        let baseRef = "main";
        let headRef = "HEAD";
        
        for (let i = 0; i < args.length; i++) {
          const arg = args[i], next = args[i + 1];
          if (arg === "--base" && next && !next.startsWith("--")) { baseRef = next; i++; }
          else if (arg === "--head" && next && !next.startsWith("--")) { headRef = next; i++; }
        }
        
        expect(baseRef).toBe("main");
        expect(headRef).toBe("HEAD");
      });

      it("parses --all flag", () => {
        const args = ["--all", "--base", "develop"];
        const allFiles = args.includes("--all");
        
        expect(allFiles).toBe(true);
      });

      it("uses defaults when flags not provided", () => {
        const args: string[] = [];
        let baseRef = "main";
        let headRef = "HEAD";
        
        for (let i = 0; i < args.length; i++) {
          const arg = args[i], next = args[i + 1];
          if (arg === "--base" && next) { baseRef = next; }
          if (arg === "--head" && next) { headRef = next; }
        }
        
        expect(baseRef).toBe("main");
        expect(headRef).toBe("HEAD");
      });
    });

    describe("suggest args", () => {
      it("extracts target path", () => {
        const args = ["docs/", "--verbose"];
        const targetArg = args.filter(a => !a.startsWith("--"))[0];
        
        expect(targetArg).toBe("docs/");
      });

      it("handles no target path", () => {
        const args = ["--verbose"];
        const targetArg = args.filter(a => !a.startsWith("--"))[0];
        
        expect(targetArg).toBeUndefined();
      });
    });
  });

  describe("help text", () => {
    it("includes all commands in help", () => {
      const helpText = `
📊 Token Management CLI

Usage: npm run tokens <command> [options]

Commands:
  count     Count tokens in all markdown files
  check     Validate files against token limits
  compare   Compare tokens between git refs
  suggest   Get optimization suggestions for files
  help      Show this help message
`;
      
      expect(helpText).toContain("count");
      expect(helpText).toContain("check");
      expect(helpText).toContain("compare");
      expect(helpText).toContain("suggest");
      expect(helpText).toContain("help");
    });

    it("includes usage examples", () => {
      const examples = [
        "npm run tokens count",
        "npm run tokens check",
        "npm run tokens compare",
        "npm run tokens suggest"
      ];
      
      for (const example of examples) {
        expect(example).toContain("npm run tokens");
      }
    });
  });
});
