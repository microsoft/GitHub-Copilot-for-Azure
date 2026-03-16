import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    try {
      const fullPath = path.resolve(__dirname, filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${filePath}`);
        return;
      }

      // Read current content
      const content = fs.readFileSync(fullPath, 'utf8');
      const pluginConfig = JSON.parse(content);
      
      // Update version
      pluginConfig.version = version;
      
      // Write back with formatted JSON
      fs.writeFileSync(fullPath, JSON.stringify(pluginConfig, null, 2) + '\n', 'utf8');
      
      console.log(`✓ Updated ${filePath} to version ${version}`);
    } catch (error) {
      console.error(`Failed to update ${filePath}:`, error.message);
      process.exit(1);
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
console.log('Plugin version update completed successfully!');