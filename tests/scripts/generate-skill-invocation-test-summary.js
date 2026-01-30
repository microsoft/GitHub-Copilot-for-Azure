const fs = require("fs");

// Important: Run this script with tests/ folder as the working directory.
// For example, node ./scripts/generate-skill-invocation-test-summary.js

/**
 * Merges the skill invocation test results for each skill into a summary document.
 */
function main() {
    const summaryFileName = "skill-invocation-test-summary.md";
    
    // Reset the summary file content
    fs.writeFileSync(summaryFileName, "# Skill invocation test summary\n\n");
    
    const resultFiles = fs.readdirSync(".").filter((fileName) => fileName.startsWith("result-") && fileName.endsWith(".txt"));
    resultFiles.forEach((fileName) => {
        const skillName = fileName.replace("result-", "").replace(".txt", "");
        const resultContent = fs.readFileSync(fileName, "utf-8");
        fs.appendFileSync(summaryFileName, `## ${skillName}\n`);
        fs.appendFileSync(summaryFileName, resultContent + "\n");
    });
}

main();