/**
 * Run unit test for skill test related code
 * 
 * Usage:
 *   node run-tests.js [jest-args...]
 * 
 * Examples:
 *   node run-tests.js                                                  # Run all tests
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

// Parse arguments
// The first two args are "node" and path to this script file.
const jestArgs = [...process.argv.slice(2)];

console.log(`Running unit tests${isCI ? " (CI mode)" : ""}...`);
console.log(`jest ${jestArgs.join(" ")}\n`);
console.log("Env:NODE_OPTIONS", process.env.NODE_OPTIONS);

// Set NODE_OPTIONS for ESM support (append to existing if present)
const existingNodeOptions = process.env.NODE_OPTIONS || "";
const env = {
  ...process.env,
  NODE_OPTIONS: existingNodeOptions
    ? `${existingNodeOptions} --experimental-vm-modules`
    : "--experimental-vm-modules"
};

// Run jest
const jest = spawn("npx", ["jest", ...jestArgs], {
  stdio: "inherit",
  shell: true,
  env,
  cwd: path.resolve(__dirname, "..")
});

jest.on("error", (err) => {
  console.error("Failed to start jest:", err.message);
  process.exit(1);
});
