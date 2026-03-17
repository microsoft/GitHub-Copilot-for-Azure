import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PluginConfig {
  version: string;
  [key: string]: any;
}

/**
 * Updates both plugin.json files with the specified version
 * @param version - The new version to set
 * @param pluginFiles - Array of paths to plugin.json files (defaults to standard locations)
 */
export function updatePluginVersion(
  version: string, 
  pluginFiles: string[] = [
    "../../plugin/.claude-plugin/plugin.json",
    "../../plugin/.plugin/plugin.json"
  ]
): void {
  console.log(`Updating plugin files to version: ${version}`);

  let hadError = false;

  for (const filePath of pluginFiles) {
    let fd: number | undefined;
    try {
      const fullPath = path.resolve(__dirname, filePath);
      
      // Open file for reading and writing
      fd = fs.openSync(fullPath, "r+");
      
      // Read current content
      const content: string = fs.readFileSync(fd, "utf8");
      const pluginConfig: PluginConfig = JSON.parse(content);
      
      // Update version
      pluginConfig.version = version;
      
      // Prepare new content
      const newContent: string = JSON.stringify(pluginConfig, null, 2) + "\n";
      
      // Truncate and write back with formatted JSON
      fs.ftruncateSync(fd, 0);
      
      // Seek back to the beginning of the file after truncation
      fs.writeSync(fd, newContent, 0);
      
      console.log(`✓ Updated ${filePath} to version ${version}`);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        console.error(`File not found: ${filePath}`);
      } else {
        console.error(`Failed to update ${filePath}:`, err.message);
      }
      hadError = true;
      break; // Stop processing further files if there's an error
    } finally {
      // Always close the file descriptor if it was opened
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch (closeError: unknown) {
          const err = closeError as NodeJS.ErrnoException;
          console.error(`Failed to close file ${filePath}:`, err.message);
        }
      }
    }
  }

  if (hadError) {
    process.exit(1);
  }
}

/**
 * Main function for CLI execution
 */
function main(): void {
  const version: string | undefined = process.argv[2];
  
  if (!version) {
    console.error("Usage: npx tsx update-plugin-version.ts <version>");
    process.exit(1);
  }

  updatePluginVersion(version);
}

// Only run main if this file is executed directly (not imported)
// Convert import.meta.url to file path and compare with resolved argv[1]
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}