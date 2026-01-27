/**
 * Project Scanner
 * 
 * Scans a project directory and detects the application type,
 * recommended Azure service, and confidence level.
 */

const fs = require('fs');
const path = require('path');

const {
  AZURE_SERVICES,
  SKILL_ROUTES,
  CONFIDENCE_LEVELS,
  createRecommendation
} = require('../src/detection/serviceMapping');

/**
 * Recursively get all files in a directory
 * @param {string} dir - Directory path
 * @param {string} baseDir - Base directory for relative paths
 * @returns {string[]} Array of relative file paths
 */
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        files.push(...getAllFiles(fullPath, baseDir));
      }
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

/**
 * Read file content safely
 * @param {string} filePath - Path to file
 * @returns {string|null} File content or null if error
 */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Detect project type from a directory
 * @param {string} projectPath - Path to project directory
 * @returns {Object} Detection result
 */
function detectProject(projectPath) {
  const files = getAllFiles(projectPath);
  const contents = {};
  
  // Read relevant config files
  const configFiles = [
    'package.json', 'requirements.txt', 'pyproject.toml',
    'azure.yaml', 'host.json', 'function.json', 'function_app.py',
    'staticwebapp.config.json', 'swa-cli.config.json',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'nuxt.config.js', 'nuxt.config.ts',
    'angular.json', 'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
    'gatsby-config.js', 'astro.config.mjs', 'nest-cli.json',
    'pom.xml', 'build.gradle', 'build.gradle.kts'
  ];
  
  // Also read .csproj files
  const csprojFiles = files.filter(f => f.endsWith('.csproj'));
  
  for (const file of [...configFiles, ...csprojFiles]) {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      const content = readFileSafe(filePath);
      if (content) {
        // Parse JSON files
        if (file.endsWith('.json')) {
          try {
            contents[file] = JSON.parse(content);
          } catch {
            contents[file] = content;
          }
        } else {
          contents[file] = content;
        }
      }
    }
  }
  
  // Get directory names
  const directories = fs.readdirSync(projectPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name);
  
  // Use the existing detection logic
  const { detectAppType } = require('../src/detection/appTypeDetector');
  
  return detectAppType({
    files,
    contents,
    directories
  });
}

/**
 * Map internal service names to expected format
 * @param {Object} result - Detection result
 * @returns {Object} Normalized result
 */
function normalizeResult(result) {
  const serviceMap = {
    'Azure Functions': 'functions',
    'Static Web Apps': 'static-web-apps',
    'Container Apps': 'container-apps',
    'App Service': 'app-service',
    'Azure Developer CLI (azd)': 'azd'
  };
  
  return {
    service: serviceMap[result.service] || result.service,
    skill: result.skill,
    confidence: result.confidence,
    framework: result.framework,
    reason: result.reason
  };
}

module.exports = {
  detectProject,
  normalizeResult,
  getAllFiles,
  readFileSafe
};
