import * as fs from "fs";
import * as path from "path";

/**
 * Scans files as text in the given workspace and check if there is text content matching the value pattern.
 * node_modules/ folders are always skipped because they are too easy to be accidentally included and usually will clog the execution.
 * @param workspace Path to a directory containing the files of interest.
 * @param valuePattern The value pattern to match the text files
 * @param filePattern If presented, only files whose name matches the pattern is considered
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
                if (filePattern && !filePattern.test(entry.name)) {
                    continue;
                }
                try {
                    const content = fs.readFileSync(fullPath, "utf-8");
                    if (valuePattern.test(content)) {
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