const fs = require("fs");

// Important: Run this script with the nested tests/ folder as the working directory.
// For example, node ../scripts/generate-skill-invocation-test-summary.js

/**
 * Merges the skill invocation test results for each skill into a summary document.
 */
function main() {
    const summaryFileName = "skill-invocation-test-summary.md";
    
    // Reset the summary file content
    fs.writeFileSync(summaryFileName, "# Skill invocation test summary\n\nEach skill is tested with prompts. Each prompt is run against the agent for 5 times. The result indicates out of 5 runs, how many runs have the skill invoked.\n\n");

    
    const resultFiles = fs.readdirSync(".").filter((fileName) => fileName.startsWith("result-") && fileName.endsWith(".txt"));
    resultFiles.forEach((fileName) => {
        const skillName = fileName.replace("result-", "").replace(".txt", "");
        const resultContent = fs.readFileSync(fileName, "utf-8");
        fs.appendFileSync(summaryFileName, `## ${skillName}\n`);
        fs.appendFileSync(summaryFileName, resultContent + "\n");
    });
}

main();