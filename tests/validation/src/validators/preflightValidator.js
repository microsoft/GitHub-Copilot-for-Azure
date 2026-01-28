/**
 * Preflight Validator
 * 
 * Validates preflight requirements before Azure deployments.
 * Based on azure-deployment-preflight/SKILL.md.
 */

/**
 * Required tools for different deployment scenarios
 */
const REQUIRED_TOOLS = {
  base: ['az'],
  azd: ['az', 'azd'],
  bicep: ['az', 'bicep'],
  container: ['az', 'docker'],
  full: ['az', 'azd', 'bicep', 'docker']
};

/**
 * Tool version commands
 */
const VERSION_COMMANDS = {
  az: 'az --version',
  azd: 'azd version',
  bicep: 'bicep --version',
  docker: 'docker --version'
};

/**
 * Minimum recommended versions
 */
const MIN_VERSIONS = {
  az: '2.76.0',      // For --validation-level support
  azd: '1.0.0',
  bicep: '0.4.0',
  docker: '20.0.0'
};

/**
 * Parses az account show output
 * @param {string} output - JSON output from az account show
 * @returns {Object|null} Parsed account info or null if invalid
 */
function parseAzAccountOutput(output) {
  try {
    const account = JSON.parse(output);
    return {
      loggedIn: true,
      subscriptionId: account.id,
      subscriptionName: account.name,
      tenantId: account.tenantId,
      user: account.user?.name || null,
      isDefault: account.isDefault
    };
  } catch {
    return null;
  }
}

/**
 * Parses azd auth login --check-status output
 * @param {string} output - Output from azd auth login --check-status
 * @returns {Object} Auth status
 */
function parseAzdAuthStatus(output) {
  const loggedIn = output.includes('Logged in') || 
                   output.includes('authenticated') ||
                   !output.includes('not logged in');
  
  return {
    loggedIn,
    message: output.trim()
  };
}

/**
 * Parses version string to comparable format
 * @param {string} versionOutput - Raw version output
 * @returns {string|null} Normalized version string or null
 */
function parseVersion(versionOutput) {
  const match = versionOutput.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Compares two semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  
  return 0;
}

/**
 * Checks if a version meets minimum requirements
 * @param {string} version - The version to check
 * @param {string} minVersion - The minimum required version
 * @returns {boolean} True if version meets requirements
 */
function meetsMinVersion(version, minVersion) {
  return compareVersions(version, minVersion) >= 0;
}

/**
 * Validates tool availability
 * @param {string} tool - Tool name
 * @param {string} versionOutput - Output from version command
 * @returns {Object} Validation result
 */
function validateTool(tool, versionOutput) {
  const version = parseVersion(versionOutput);
  const minVersion = MIN_VERSIONS[tool];
  
  if (!version) {
    return {
      tool,
      installed: false,
      version: null,
      meetsMinVersion: false,
      error: 'Could not parse version'
    };
  }
  
  return {
    tool,
    installed: true,
    version,
    meetsMinVersion: meetsMinVersion(version, minVersion),
    minVersion,
    warning: !meetsMinVersion(version, minVersion) 
      ? `Version ${version} is below recommended ${minVersion}` 
      : null
  };
}

/**
 * Gets required tools for a deployment scenario
 * @param {Object} options - Deployment options
 * @param {boolean} options.isAzd - Is this an azd project
 * @param {boolean} options.hasBicep - Does the project have Bicep files
 * @param {boolean} options.hasDocker - Does the project have Dockerfile
 * @returns {string[]} Array of required tool names
 */
function getRequiredTools(options = {}) {
  const tools = new Set(['az']); // Always need Azure CLI
  
  if (options.isAzd) {
    tools.add('azd');
  }
  
  if (options.hasBicep) {
    tools.add('bicep');
  }
  
  if (options.hasDocker) {
    tools.add('docker');
  }
  
  return Array.from(tools);
}

/**
 * Determines validation level fallback strategy
 * @param {string} error - Error message from validation
 * @returns {Object} Fallback recommendation
 */
function determineValidationFallback(error) {
  const lowerError = error.toLowerCase();
  
  // Permission/RBAC errors
  if (lowerError.includes('authorization') || 
      lowerError.includes('permission') ||
      lowerError.includes('forbidden') ||
      lowerError.includes('rbac')) {
    return {
      shouldFallback: true,
      fallbackLevel: 'ProviderNoRbac',
      reason: 'Insufficient permissions for full RBAC validation'
    };
  }
  
  // Resource provider not registered
  if (lowerError.includes('not registered') || 
      lowerError.includes('register the subscription')) {
    return {
      shouldFallback: false,
      action: 'register',
      reason: 'Resource provider needs to be registered'
    };
  }
  
  // Template errors - no fallback, fix the template
  if (lowerError.includes('template') || 
      lowerError.includes('syntax') ||
      lowerError.includes('invalid')) {
    return {
      shouldFallback: false,
      action: 'fix',
      reason: 'Template has errors that need to be fixed'
    };
  }
  
  return {
    shouldFallback: false,
    reason: 'Unknown error type'
  };
}

/**
 * Parses resource group existence check
 * @param {string} output - Output from az group exists
 * @returns {boolean} True if resource group exists
 */
function parseResourceGroupExists(output) {
  return output.trim().toLowerCase() === 'true';
}

/**
 * Generates preflight report structure
 * @param {Object} results - All preflight check results
 * @returns {Object} Structured report
 */
function generatePreflightReport(results) {
  const { tools = [], auth = {}, bicep = null, resourceGroup = null } = results;
  
  const issues = [];
  const warnings = [];
  
  // Check tools
  for (const tool of tools) {
    if (!tool.installed) {
      issues.push({
        severity: 'error',
        category: 'tools',
        message: `${tool.tool} is not installed`,
        remediation: `Install ${tool.tool} using the appropriate package manager`
      });
    } else if (tool.warning) {
      warnings.push({
        severity: 'warning',
        category: 'tools',
        message: tool.warning,
        remediation: `Update ${tool.tool} to version ${tool.minVersion} or later`
      });
    }
  }
  
  // Check auth
  if (auth.az && !auth.az.loggedIn) {
    issues.push({
      severity: 'error',
      category: 'auth',
      message: 'Not logged in to Azure CLI',
      remediation: 'Run: az login'
    });
  }
  
  if (auth.azd && !auth.azd.loggedIn) {
    issues.push({
      severity: 'error',
      category: 'auth',
      message: 'Not logged in to Azure Developer CLI',
      remediation: 'Run: azd auth login'
    });
  }
  
  // Check resource group
  if (resourceGroup && !resourceGroup.exists) {
    issues.push({
      severity: 'error',
      category: 'resources',
      message: `Resource group '${resourceGroup.name}' does not exist`,
      remediation: `Run: az group create --name ${resourceGroup.name} --location <location>`
    });
  }
  
  // Check bicep validation
  if (bicep && bicep.errors && bicep.errors.length > 0) {
    for (const error of bicep.errors) {
      issues.push({
        severity: error.severity,
        category: 'bicep',
        message: `${error.file}(${error.line},${error.column}): ${error.message}`,
        remediation: 'Fix the Bicep template error'
      });
    }
  }
  
  return {
    status: issues.length === 0 ? 'passed' : 'failed',
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: issues.length,
      totalWarnings: warnings.length,
      toolsChecked: tools.length,
      authChecked: Object.keys(auth).length
    },
    issues,
    warnings,
    details: results
  };
}

module.exports = {
  REQUIRED_TOOLS,
  VERSION_COMMANDS,
  MIN_VERSIONS,
  parseAzAccountOutput,
  parseAzdAuthStatus,
  parseVersion,
  compareVersions,
  meetsMinVersion,
  validateTool,
  getRequiredTools,
  determineValidationFallback,
  parseResourceGroupExists,
  generatePreflightReport
};
