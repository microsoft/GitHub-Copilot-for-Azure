#!/usr/bin/env node
/**
 * Vally CLI
 *
 * Unified CLI for Vally evaluation framework operations.
 *
 * Usage:
 *   npm run vally validate-stimulus    # Validate evaluation stimuli
 *   npm run vally help                 # Show help
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateStimulus } from "./validate-stimulus.js";

const COMMANDS = ["validate-stimulus", "help"] as const;
type Command = typeof COMMANDS[number];

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../..");
}

function printHelp(): void {
  console.log(`
🔬 Vally CLI

Usage: npm run vally <command> [options]

Commands:
  validate-stimulus   Validate evaluation stimuli (placeholder)
  help                Show this help message

Examples:
  npm run vally validate-stimulus
  npm run vally help
`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = (args[0] ?? "help") as Command;
  const commandArgs = args.slice(1);
  const rootDir = getRepoRoot();

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${COMMANDS.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "validate-stimulus":
      validateStimulus(rootDir, commandArgs);
      break;
    case "help":
      printHelp();
      break;
  }
}

main();