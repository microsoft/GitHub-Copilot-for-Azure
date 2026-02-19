#!/usr/bin/env node
/**
 * Local Development CLI
 * 
 * Tools for setting up and verifying local plugin development.
 * 
 * Usage:
 *   npm run local setup    # Configure Copilot to use local plugin folder
 *   npm run local verify   # Verify config points to local plugin
 *   npm run local help     # Show help
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setup } from "./commands/setup.js";
import { verify } from "./commands/verify.js";

const COMMANDS = ["setup", "verify", "help"] as const;
type Command = typeof COMMANDS[number];

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../..");
}

function printHelp(): void {
  console.log(`
🔧 Local Development CLI

Usage: npm run local <command> [options]

Commands:
  setup     Configure ~/.copilot/config.json to use local plugin folder
  verify    Verify config is correctly pointing to local plugin
  help      Show this help message

Options:
  --force, -f    Force update even if config already has different values
  --fix          Automatically fix issues found during verification
  --verbose, -v  Show detailed output

Examples:
  npm run local setup             # Configure Copilot to use local plugin
  npm run local setup -- --force  # Force update existing config
  npm run local verify            # Verify config is correct
  npm run local verify -- --fix   # Automatically fix config issues
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
    case "setup":
      setup(rootDir, commandArgs);
      break;
    case "verify":
      verify(rootDir, commandArgs);
      break;
    case "help":
      printHelp();
      break;
  }
}

main();
