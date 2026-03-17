import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Updates both plugin.json files with the specified version
 * @param {string} version - The new version to set
 */
function updatePluginVersion(version) {
  const pluginFiles = [
    '../plugin/.claude-plugin/plugin.json',
    '../plugin/.plugin/plugin.json'
  ];

  console.log(`Updating plugin files to version: ${version}`);

  pluginFiles.forEach(filePath => {
    let fd;
    try {
      const fullPath = path.resolve(__dirname, filePath);
      
      // Open file for reading and writing
      fd = fs.openSync(fullPath, 'r+');
      
      // Read current content
      const content = fs.readFileSync(fd, 'utf8');
      const pluginConfig = JSON.parse(content);
      
      // Update version
      pluginConfig.version = version;
      
      // Prepare new content
      const newContent = JSON.stringify(pluginConfig, null, 2) + '\n';
      
      // Truncate and write back with formatted JSON
      fs.ftruncateSync(fd, 0);
      fs.writeFileSync(fd, newContent, 'utf8');
      
      console.log(`✓ Updated ${filePath} to version ${version}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`File not found: ${filePath}`);
        return;
      }
      console.error(`Failed to update ${filePath}:`, error.message);
      process.exit(1);
    } finally {
      // Always close the file descriptor if it was opened
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch (closeError) {
          console.error(`Failed to close file ${filePath}:`, closeError.message);
        }
      }
    }
  });
}

// Get version from command line argument
const version = process.argv[2];

if (!version) {
  console.error('Usage: node update-plugin-version.js <version>');
  process.exit(1);
}

updatePluginVersion(version);
