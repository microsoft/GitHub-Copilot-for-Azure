#!/usr/bin/env node
/**
 * Local Development CLI
 * 
 * Tools for setting up and verifying local plugin development.
 * 
 * Usage:
 *   npm run local setup    # Create symlink from installed-plugins to local repo
 *   npm run local verify   # Verify files match between local and installed
 *   npm run local help     # Show help
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup } from './commands/setup.js';
import { verify } from './commands/verify.js';

const COMMANDS = ['setup', 'verify', 'help'] as const;
type Command = typeof COMMANDS[number];

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '../../..');
}

function printHelp(): void {
  console.log(`
🔧 Local Development CLI

Usage: npm run local <command> [options]

Commands:
  setup     Create symlink from ~/.copilot/installed-plugins to local repo
  verify    Verify local files match installed plugin (content comparison)
  help      Show this help message

Examples:
  npm run local setup             # Set up symlink for local development
  npm run local verify            # Verify files are in sync
  npm run local verify -- --fix   # Re-create symlink if verification fails
`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = (args[0] ?? 'help') as Command;
  const commandArgs = args.slice(1);
  const rootDir = getRepoRoot();

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${COMMANDS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case 'setup':
      setup(rootDir, commandArgs);
      break;
    case 'verify':
      verify(rootDir, commandArgs);
      break;
    case 'help':
      printHelp();
      break;
  }
}

main();
