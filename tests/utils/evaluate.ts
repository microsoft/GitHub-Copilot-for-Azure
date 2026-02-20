import * as fs from "fs";
import * as path from "path";
import { AgentMetadata, isSkillInvoked } from "./agent-runner";

/**
 * Scans files as text in the given workspace and checks whether there is text content matching the value pattern.
 * node_modules/ folders are always skipped because they are too easy to be accidentally included and usually will clog the execution.
 * @param workspace Path to a directory containing the files of interest.
 * @param valuePattern The value pattern to match the text files
 * @param filePattern If provided, only files whose names match the pattern are considered
 * @returns True if any file contains content matching the value pattern
 */
export function doesWorkspaceFileIncludePattern(workspace: string, valuePattern: RegExp, filePattern?: RegExp): boolean {
    const scanDirectory = (dir: string): boolean => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== "node_modules") {
                if (scanDirectory(fullPath)) return true;
            } else if (entry.isFile()) {
                // Skip if filePattern is provided and doesn't match
                if (filePattern && !entry.name.match(filePattern)) {
                    continue;
                }
                try {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    if (content.match(valuePattern)) {
                        return true;
                    }
                } catch {
                    // Skip files that can't be read as text
                }
            }
        }
        return false;
    };

    return scanDirectory(workspace);
}

export function softCheckSkill(agentMetadata: AgentMetadata, skillName: string): void {
    const isSkillUsed = isSkillInvoked(agentMetadata, skillName);

    if (!isSkillUsed) {
        agentMetadata.testComments.push(`⚠️ ${skillName} skill was expected to be used but was not used.`);
    }
}