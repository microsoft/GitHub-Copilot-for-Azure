/**
 * Test Runner
 * 
 * Usage:
 *   node run-tests.js [type] [extra-args...]
 * 
 * Types:
 *   all         - Run all tests (default)
 *   unit        - Run unit tests only
 *   integration - Run integration tests only
 *   verbose     - Run all tests with verbose output
 *   coverage    - Run tests with coverage report
 *   ci          - Run tests in CI mode with reporters
 *   watch       - Run tests in watch mode
 *   skill       - Run tests for a specific skill (requires pattern arg)
 * 
 * Examples:
 *   node run-tests.js                    # Run all tests
 *   node run-tests.js unit               # Run unit tests
 *   node run-tests.js integration        # Run integration tests
 *   node run-tests.js skill azure-ai     # Run tests for azure-ai skill
 *   node run-tests.js unit --verbose     # Run unit tests with verbose flag
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);

// Parse arguments
// The first two args are "node" and path to this script file.
const args = process.argv.slice(2);
const testType = args[0] && !args[0].startsWith("-") ? args[0] : "all";
const extraArgs = args[0] && !args[0].startsWith("-") ? args.slice(1) : args;

// Test type configurations
const testConfigs = {
    all: {
        description: "all tests",
        jestArgs: []
    },
    unit: {
        description: "unit tests",
        jestArgs: ["--testPathIgnorePatterns=\"node_modules|_template|integration\""]
    },
    integration: {
        description: "integration tests",
        jestArgs: [
            "--testMatch=**/*integration*.ts",
            "--testPathIgnorePatterns=\"node_modules|_template\""
        ]
    },
    verbose: {
        description: "all tests (verbose)",
        jestArgs: ["--verbose"]
    },
    coverage: {
        description: "tests with coverage",
        jestArgs: ["--coverage", "--testPathIgnorePatterns=\"node_modules|_template|integration\""]
    },
    ci: {
        description: "tests in CI mode",
        jestArgs: [
            "--ci",
            "--reporters=default",
            "--reporters=jest-junit",
            "--testPathIgnorePatterns=\"node_modules|_template|integration\""
        ]
    },
    watch: {
        description: "tests in watch mode",
        jestArgs: ["--watch"]
    },
    skill: {
        description: "skill-specific tests",
        jestArgs: ["--testPathPattern"],
        requiresPattern: true
    }
};

// Validate test type
if (!testConfigs[testType]) {
    console.error(`Unknown test type: ${testType}`);
    console.error(`Available types: ${Object.keys(testConfigs).join(", ")}`);
    process.exit(1);
}

const config = testConfigs[testType];

// Handle skill type which requires a pattern
if (config.requiresPattern && extraArgs.length === 0) {
    console.error(`Test type "${testType}" requires a pattern argument.`);
    console.error("Example: node run-tests.js skill azure-ai");
    process.exit(1);
}

// Build jest command args
let jestArgs = [...config.jestArgs];

// For skill type, append the pattern to --testPathPattern
if (config.requiresPattern && extraArgs.length > 0) {
    jestArgs = [`--testPathPattern=${extraArgs[0]}`, ...extraArgs.slice(1)];
} else {
    jestArgs = [...jestArgs, ...extraArgs];
}

console.log(`Running ${config.description}${isCI ? " (CI mode)" : ""}...`);
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
    const jestExitCode = code || 0;

    // Show results table if not in CI and not in watch mode
    if (!isCI && testType !== "watch") {
        console.log("\n");
        const results = spawn("node", [path.join(__dirname, "show-test-results.js")], {
            stdio: "inherit",
            cwd: path.resolve(__dirname, "..")
        });

        results.on("error", (err) => {
            console.error("Failed to display results:", err.message);
            process.exit(jestExitCode);
        });

        results.on("close", () => {
            // Always use jest exit code, not results script exit code
            process.exit(jestExitCode);
        });
    } else {
        process.exit(jestExitCode);
    }
});
