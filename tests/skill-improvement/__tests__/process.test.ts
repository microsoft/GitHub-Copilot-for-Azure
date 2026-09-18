import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  commandName,
  resolveProcessLaunch,
  runProcess,
} from "../process.ts";
import { describe, test, expect, } from "vitest";

describe("runProcess", () => {
  test.each(["npm", "npx"])(
    "runs %s through the platform command wrapper",
    async command => {
      const result = await runProcess(commandName(command), ["--version"], {
        cwd: os.tmpdir(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    }
  );

  test("launches Windows npm through Node with literal metacharacter arguments", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "npm argv safety "));
    const npmBin = path.join(root, "node_modules", "npm", "bin");
    const outputFile = path.join(root, "captured arguments.json");
    const sideEffectFile = path.join(root, "injected side effect.txt");
    const sideEffectScript = path.join(root, "write side effect.js");
    const cliPath = path.join(npmBin, "npm-cli.js");
    const literalArguments = [
      "path with spaces",
      "ampersand&value",
      "pipe|value",
      "percent%PATH%",
      "caret^value",
      "quote\"value",
      `& "${process.execPath}" "${sideEffectScript}"`,
    ];

    fs.mkdirSync(npmBin, { recursive: true });
    fs.writeFileSync(
      cliPath,
      [
        'const fs = require("node:fs");',
        "const [outputFile, ...args] = process.argv.slice(2);",
        "fs.writeFileSync(outputFile, JSON.stringify(args));",
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      sideEffectScript,
      `require("node:fs").writeFileSync(${JSON.stringify(sideEffectFile)}, "injected");`,
      "utf8"
    );

    try {
      const launch = resolveProcessLaunch(
        "npm.cmd",
        [outputFile, ...literalArguments],
        {
          platform: "win32",
          nodeExecutable: process.execPath,
          nodeInstallDirectory: root,
        }
      );
      const result = await runProcess(launch.command, launch.args, { cwd: root });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(fs.readFileSync(outputFile, "utf8"))).toEqual(
        literalArguments
      );
      expect(fs.existsSync(sideEffectFile)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("fails explicitly when the Windows npm JavaScript CLI is unavailable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "missing npm cli "));
    try {
      expect(() => resolveProcessLaunch("npx.cmd", [], {
        platform: "win32",
        nodeExecutable: process.execPath,
        nodeInstallDirectory: root,
      })).toThrow("Unable to resolve npx.cmd JavaScript CLI");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
