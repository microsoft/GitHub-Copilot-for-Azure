/**
 * Update Jest Snapshots
 * 
 * Runs jest --updateSnapshot with proper ESM support via NODE_OPTIONS.
 * 
 * Usage:
 *   node update-snapshots.js [pattern]
 * 
 * Examples:
 *   node update-snapshots.js              # Update all snapshots
 *   node update-snapshots.js azure-ai     # Update snapshots for azure-ai skill
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse arguments - optional pattern to filter which tests to update
const args = process.argv.slice(2);
const jestArgs = ["--updateSnapshot"];

// If a pattern is provided, add it as testPathPattern
if (args.length > 0 && !args[0].startsWith("-")) {
    jestArgs.push(`--testPathPattern=${args[0]}`);
    jestArgs.push(...args.slice(1));
} else {
    jestArgs.push(...args);
}

console.log("Updating snapshots...");
console.log(`jest ${jestArgs.join(" ")}\n`);

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

jest.on("close", (code) => {
    process.exit(code || 0);
});
