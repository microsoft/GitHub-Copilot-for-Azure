/**
 * Dockerfile Validator for Node.js Production
 * 
 * Validates Dockerfiles for Node.js application production best practices
 * based on the azure-nodejs-production skill requirements.
 * 
 * Checks for:
 * - NODE_ENV=production environment variable
 * - HEALTHCHECK instruction
 * - Non-root user
 * - Proper base image
 */

const fs = require('fs');
const path = require('path');

/**
 * Validation result structure
 * @typedef {Object} DockerValidationResult
 * @property {boolean} valid - Whether all checks passed
 * @property {string[]} errors - List of validation errors
 * @property {string[]} warnings - List of validation warnings
 * @property {Object} checks - Individual check results
 */

/**
 * Validates a Dockerfile for Node.js production best practices
 * @param {string} projectDir - Path to the project directory
 * @returns {DockerValidationResult}
 */
function validateDockerfile(projectDir) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    checks: {
      hasDockerfile: { passed: false, message: '' },
      nodeEnvProduction: { passed: false, message: '' },
      healthcheck: { passed: false, message: '' },
      nonRootUser: { passed: false, message: '' },
      properBaseImage: { passed: false, message: '' }
    }
  };

  // Find Dockerfile
  const dockerfilePath = findDockerfile(projectDir);
  
  if (!dockerfilePath) {
    result.checks.hasDockerfile = { passed: false, message: 'No Dockerfile found' };
    result.warnings.push('No Dockerfile found in project');
    // Not having a Dockerfile isn't necessarily an error
    return result;
  }

  result.checks.hasDockerfile = { passed: true, message: `Found: ${path.basename(dockerfilePath)}` };

  let content;
  try {
    content = fs.readFileSync(dockerfilePath, 'utf8');
  } catch (err) {
    result.valid = false;
    result.errors.push(`Cannot read Dockerfile: ${err.message}`);
    return result;
  }

  // Check NODE_ENV=production
  result.checks.nodeEnvProduction = checkNodeEnvProduction(content);
  if (!result.checks.nodeEnvProduction.passed) {
    result.errors.push(result.checks.nodeEnvProduction.message);
  }

  // Check HEALTHCHECK
  result.checks.healthcheck = checkHealthcheck(content);
  if (!result.checks.healthcheck.passed) {
    result.warnings.push(result.checks.healthcheck.message);
  }

  // Check non-root user
  result.checks.nonRootUser = checkNonRootUser(content);
  if (!result.checks.nonRootUser.passed) {
    result.warnings.push(result.checks.nonRootUser.message);
  }

  // Check base image
  result.checks.properBaseImage = checkBaseImage(content);
  if (!result.checks.properBaseImage.passed) {
    result.warnings.push(result.checks.properBaseImage.message);
  }

  // Set overall validity
  result.valid = result.errors.length === 0;

  return result;
}

/**
 * Find Dockerfile in project directory
 */
function findDockerfile(projectDir) {
  const candidates = ['Dockerfile', 'dockerfile', 'Dockerfile.prod', 'Dockerfile.production'];
  
  for (const name of candidates) {
    const fullPath = path.join(projectDir, name);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  return null;
}

/**
 * Check for NODE_ENV=production
 */
function checkNodeEnvProduction(content) {
  // Match: ENV NODE_ENV=production or ENV NODE_ENV production
  const nodeEnvRegex = /ENV\s+NODE_ENV[=\s]+production/i;
  
  // Also check ARG with default
  const argRegex = /ARG\s+NODE_ENV=production/i;
  
  if (nodeEnvRegex.test(content) || argRegex.test(content)) {
    return { passed: true, message: 'NODE_ENV=production is set' };
  }
  
  return { 
    passed: false, 
    message: 'Missing NODE_ENV=production. Add: ENV NODE_ENV=production' 
  };
}

/**
 * Check for HEALTHCHECK instruction
 */
function checkHealthcheck(content) {
  // Normalize line continuations for multi-line HEALTHCHECK instructions
  const normalizedContent = content.replace(/\\\n\s*/g, ' ');
  
  // Match: HEALTHCHECK CMD or HEALTHCHECK --interval=30s ... CMD
  // Handles both --option=value and --option value formats
  const healthcheckRegex = /^HEALTHCHECK\s+(?:--[\w-]+=?\S*\s+)*(?:CMD|NONE)/im;
  
  if (healthcheckRegex.test(normalizedContent)) {
    return { passed: true, message: 'HEALTHCHECK instruction present' };
  }
  
  return { 
    passed: false, 
    message: 'Missing HEALTHCHECK instruction. Add: HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1' 
  };
}

/**
 * Check for non-root user
 */
function checkNonRootUser(content) {
  // Match: USER node, USER appuser, USER 1000, etc (not USER root)
  const userRegex = /^USER\s+(?!root)(\w+|\d+)/im;
  
  if (userRegex.test(content)) {
    return { passed: true, message: 'Running as non-root user' };
  }
  
  // Check if using official node image (has node user)
  const nodeImageRegex = /FROM\s+node:/i;
  if (nodeImageRegex.test(content)) {
    return { 
      passed: false, 
      message: 'Running as root. Add: USER node (node image includes this user)' 
    };
  }
  
  return { 
    passed: false, 
    message: 'No USER instruction found. Consider running as non-root user' 
  };
}

/**
 * Check for proper base image (Alpine preferred for smaller size)
 */
function checkBaseImage(content) {
  // Check FROM line
  const fromRegex = /^FROM\s+(\S+)/im;
  const match = content.match(fromRegex);
  
  if (!match) {
    return { passed: false, message: 'No FROM instruction found' };
  }
  
  const image = match[1].toLowerCase();
  
  // Check for Alpine or slim variants (recommended)
  if (image.includes('alpine') || image.includes('slim')) {
    return { passed: true, message: 'Using optimized base image' };
  }
  
  // Check for explicit version (good practice)
  if (image.includes(':') && !image.endsWith(':latest')) {
    return { passed: true, message: 'Base image has explicit version' };
  }
  
  // Using :latest is not ideal
  if (image.endsWith(':latest') || !image.includes(':')) {
    return { 
      passed: false, 
      message: 'Consider using specific version and slim/alpine variant (e.g., node:20-alpine)' 
    };
  }
  
  return { passed: true, message: 'Base image is specified' };
}

module.exports = {
  validateDockerfile,
  findDockerfile,
  checkNodeEnvProduction,
  checkHealthcheck,
  checkNonRootUser,
  checkBaseImage
};
