#!/usr/bin/env node
/**
 * Token Management CLI
 * 
 * Unified CLI for markdown token counting, validation, comparison, and optimization.
 * 
 * Usage:
 *   npm run tokens count              # Count tokens in all markdown files
 *   npm run tokens check              # Check files against token limits
 *   npm run tokens compare            # Compare tokens between git refs
 *   npm run tokens suggest [path]     # Get optimization suggestions
 *   npm run tokens help               # Show help
 */

import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { count } from './commands/count.js';
import { check } from './commands/check.js';
import { compare } from './commands/compare.js';
import { suggest } from './commands/suggest.js';

const COMMANDS = ['count', 'check', 'compare', 'suggest', 'help'] as const;
type Command = typeof COMMANDS[number];

function getRepoRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '../../..');
}

function printHelp(): void {
  console.log(`
📊 Token Management CLI

Usage: npm run tokens <command> [options]

Commands:
  count     Count tokens in all markdown files
  check     Validate files against token limits
  compare   Compare tokens between git refs
  suggest   Get optimization suggestions (prioritizes files exceeding limits)
  help      Show this help message

Default Scope:
  All commands scan these directories by default:
  - .github/skills
  - plugin/skills
  - .github/agents

Options vary by command. Use --help with any command for details.

Examples:
  npm run tokens count                    # Count tokens in default directories
  npm run tokens count -- --json          # Output as JSON
  npm run tokens check                    # Check default directories
  npm run tokens check -- --markdown      # Output as markdown
  npm run tokens check -- docs/           # Check specific directory
  npm run tokens compare                  # Compare HEAD vs main
  npm run tokens compare -- --base HEAD~1 # Compare vs previous commit
  npm run tokens suggest                  # Analyze default directories (shows exceeded first)
  npm run tokens suggest -- docs/         # Analyze specific directory
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
    case 'count':
      count(rootDir, commandArgs);
      break;
    case 'check':
      check(rootDir, commandArgs);
      break;
    case 'compare':
      compare(rootDir, commandArgs);
      break;
    case 'suggest':
      suggest(rootDir, commandArgs);
      break;
    case 'help':
      printHelp();
      break;
  }
}

main();
