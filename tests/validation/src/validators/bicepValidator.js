/**
 * Bicep File Validator
 * 
 * Detects and validates Bicep files, target scopes, and parameter files.
 * Based on azure-deployment-preflight/SKILL.md detection logic.
 */

const fs = require('fs');
const path = require('path');

/**
 * Target scope to CLI command mapping
 */
const SCOPE_COMMANDS = {
  resourceGroup: 'az deployment group what-if',
  subscription: 'az deployment sub what-if',
  managementGroup: 'az deployment mg what-if',
  tenant: 'az deployment tenant what-if'
};

/**
 * Required parameters for each scope
 */
const SCOPE_REQUIRED_PARAMS = {
  resourceGroup: ['--resource-group'],
  subscription: ['--location'],
  managementGroup: ['--location', '--management-group-id'],
  tenant: ['--location']
};

/**
 * Detects the target scope from Bicep file content
 * @param {string} content - The Bicep file content
 * @returns {string} The target scope (default: 'resourceGroup')
 */
function detectTargetScope(content) {
  const match = content.match(/targetScope\s*=\s*['"](\w+)['"]/);
  if (match) {
    return match[1];
  }
  return 'resourceGroup'; // Default scope
}

/**
 * Gets the CLI command for a given scope
 * @param {string} scope - The target scope
 * @returns {string|null} The CLI command or null if unknown scope
 */
function getCommandForScope(scope) {
  return SCOPE_COMMANDS[scope] || null;
}

/**
 * Gets required parameters for a given scope
 * @param {string} scope - The target scope
 * @returns {string[]} Array of required parameter flags
 */
function getRequiredParamsForScope(scope) {
  return SCOPE_REQUIRED_PARAMS[scope] || [];
}

/**
 * Finds parameter files for a given Bicep file
 * @param {string} bicepFilePath - Path to the Bicep file
 * @param {string[]} existingFiles - Array of existing file paths to search
 * @returns {Object} Object with found parameter files
 */
function findParameterFiles(bicepFilePath, existingFiles) {
  const baseName = path.basename(bicepFilePath, '.bicep');
  const dirPath = path.dirname(bicepFilePath);
  
  const result = {
    bicepparam: null,
    json: null,
    found: false
  };
  
  // Look for .bicepparam file (preferred)
  const bicepparamFile = `${baseName}.bicepparam`;
  const bicepparamPath = path.join(dirPath, bicepparamFile);
  if (existingFiles.includes(bicepparamPath) || existingFiles.includes(bicepparamFile)) {
    result.bicepparam = bicepparamPath;
    result.found = true;
  }
  
  // Look for .parameters.json file
  const jsonParamFile = `${baseName}.parameters.json`;
  const jsonParamPath = path.join(dirPath, jsonParamFile);
  if (existingFiles.includes(jsonParamPath) || existingFiles.includes(jsonParamFile)) {
    result.json = jsonParamPath;
    result.found = true;
  }
  
  // Look for generic parameters.json
  const genericParamPath = path.join(dirPath, 'parameters.json');
  if (!result.json && (existingFiles.includes(genericParamPath) || existingFiles.includes('parameters.json'))) {
    result.json = genericParamPath;
    result.found = true;
  }
  
  return result;
}

/**
 * Detects if a project is an azd project
 * @param {string[]} files - Array of file paths in the project
 * @returns {boolean} True if azure.yaml is found
 */
function isAzdProject(files) {
  return files.some(f => 
    f === 'azure.yaml' || 
    f.endsWith('/azure.yaml') || 
    f.endsWith('\\azure.yaml')
  );
}

/**
 * Finds all Bicep files in a list of files
 * @param {string[]} files - Array of file paths
 * @returns {string[]} Array of Bicep file paths
 */
function findBicepFiles(files) {
  return files.filter(f => f.endsWith('.bicep'));
}

/**
 * Parses Bicep build error output
 * @param {string} output - The error output from bicep build
 * @returns {Object[]} Array of parsed errors
 */
function parseBicepErrors(output) {
  const errors = [];
  const errorPattern = /([^(]+)\((\d+),(\d+)\)\s*:\s*(Error|Warning)\s+(\w+):\s*(.+)/g;
  
  let match;
  while ((match = errorPattern.exec(output)) !== null) {
    errors.push({
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4].toLowerCase(),
      code: match[5],
      message: match[6].trim()
    });
  }
  
  return errors;
}

/**
 * Validates Bicep file content for common issues
 * @param {string} content - The Bicep file content
 * @returns {Object} Validation result with warnings
 */
function validateBicepContent(content) {
  const warnings = [];
  const errors = [];
  
  // Check for hardcoded secrets (simple heuristic)
  if (/password\s*=\s*['"][^'"]+['"]/i.test(content)) {
    warnings.push({
      type: 'security',
      message: 'Possible hardcoded password detected. Use Key Vault references or secure parameters.'
    });
  }
  
  // Check for missing secure decorator on sensitive parameters
  const paramMatches = content.matchAll(/param\s+(\w*(?:password|secret|key|token)\w*)\s+string/gi);
  for (const match of paramMatches) {
    const paramName = match[1];
    // Check if @secure() decorator is present before this param
    const beforeParam = content.substring(0, match.index);
    const lastDecorator = beforeParam.lastIndexOf('@secure()');
    const lastParam = beforeParam.lastIndexOf('param ');
    
    // Warn if no @secure() before this param, or if there's another param between @secure and this one
    if (lastDecorator === -1 || lastDecorator < lastParam) {
      warnings.push({
        type: 'security',
        message: `Parameter '${paramName}' may contain sensitive data. Consider adding @secure() decorator.`
      });
    }
  }
  
  // Check for deprecated API versions (example)
  if (/2019-01-01|2018-\d{2}-\d{2}/g.test(content)) {
    warnings.push({
      type: 'deprecation',
      message: 'Older API versions detected. Consider updating to newer API versions.'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Analyzes a Bicep file and returns comprehensive information
 * @param {string} filePath - Path to the Bicep file
 * @param {string} content - The Bicep file content
 * @param {string[]} projectFiles - All files in the project
 * @returns {Object} Analysis result
 */
function analyzeBicepFile(filePath, content, projectFiles) {
  const scope = detectTargetScope(content);
  const paramFiles = findParameterFiles(filePath, projectFiles);
  const validation = validateBicepContent(content);
  
  return {
    path: filePath,
    targetScope: scope,
    command: getCommandForScope(scope),
    requiredParams: getRequiredParamsForScope(scope),
    parameterFiles: paramFiles,
    validation,
    isAzd: isAzdProject(projectFiles)
  };
}

module.exports = {
  SCOPE_COMMANDS,
  SCOPE_REQUIRED_PARAMS,
  detectTargetScope,
  getCommandForScope,
  getRequiredParamsForScope,
  findParameterFiles,
  isAzdProject,
  findBicepFiles,
  parseBicepErrors,
  validateBicepContent,
  analyzeBicepFile
};
