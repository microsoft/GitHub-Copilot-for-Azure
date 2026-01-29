/**
 * Azure Resource Name Validator
 * 
 * Validates Azure resource names against naming constraints.
 * Based on azure-validation/SKILL.md naming rules.
 */

/**
 * Resource naming constraints from Azure
 * @see https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules
 */
const RESOURCE_CONSTRAINTS = {
  storageAccount: {
    name: 'Storage Account',
    minLength: 3,
    maxLength: 24,
    pattern: /^[a-z0-9]+$/,
    patternDescription: 'lowercase letters and numbers only',
    globallyUnique: true
  },
  keyVault: {
    name: 'Key Vault',
    minLength: 3,
    maxLength: 24,
    pattern: /^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z]$/,
    patternDescription: 'alphanumerics and hyphens, must start with letter',
    globallyUnique: true
  },
  containerRegistry: {
    name: 'Container Registry',
    minLength: 5,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9]+$/,
    patternDescription: 'alphanumerics only (no hyphens)',
    globallyUnique: true
  },
  containerApp: {
    name: 'Container App',
    minLength: 2,
    maxLength: 32,
    pattern: /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/,
    patternDescription: 'lowercase letters, numbers, and hyphens',
    globallyUnique: false
  },
  appService: {
    name: 'App Service',
    minLength: 2,
    maxLength: 60,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    patternDescription: 'alphanumerics and hyphens',
    globallyUnique: true
  },
  functionApp: {
    name: 'Function App',
    minLength: 2,
    maxLength: 60,
    pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    patternDescription: 'alphanumerics and hyphens',
    globallyUnique: true
  },
  resourceGroup: {
    name: 'Resource Group',
    minLength: 1,
    maxLength: 90,
    pattern: /^[a-zA-Z0-9._-]+$/,
    patternDescription: 'alphanumerics, hyphens, underscores, and periods',
    globallyUnique: false
  },
  cosmosDb: {
    name: 'Cosmos DB Account',
    minLength: 3,
    maxLength: 44,
    pattern: /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/,
    patternDescription: 'lowercase letters, numbers, and hyphens',
    globallyUnique: true
  }
};

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the name is valid
 * @property {string[]} errors - List of validation errors
 * @property {string[]} warnings - List of warnings
 */

/**
 * Validates a resource name against its constraints
 * @param {string} name - The resource name to validate
 * @param {string} resourceType - The type of resource (e.g., 'storageAccount')
 * @returns {ValidationResult}
 */
function validateResourceName(name, resourceType) {
  const errors = [];
  const warnings = [];
  
  const constraints = RESOURCE_CONSTRAINTS[resourceType];
  if (!constraints) {
    return {
      valid: false,
      errors: [`Unknown resource type: ${resourceType}`],
      warnings: []
    };
  }
  
  // Check if name is provided
  if (!name || typeof name !== 'string') {
    return {
      valid: false,
      errors: ['Resource name is required'],
      warnings: []
    };
  }
  
  // Check minimum length
  if (name.length < constraints.minLength) {
    errors.push(
      `${constraints.name} name must be at least ${constraints.minLength} characters (got ${name.length})`
    );
  }
  
  // Check maximum length
  if (name.length > constraints.maxLength) {
    errors.push(
      `${constraints.name} name must be at most ${constraints.maxLength} characters (got ${name.length})`
    );
  }
  
  // Check pattern
  if (!constraints.pattern.test(name)) {
    errors.push(
      `${constraints.name} name must contain only ${constraints.patternDescription}`
    );
  }
  
  // Add warning for globally unique resources
  if (constraints.globallyUnique && errors.length === 0) {
    warnings.push(
      `${constraints.name} names must be globally unique across Azure`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates multiple resource names at once
 * @param {Object} resources - Object mapping resource names to types
 * @returns {Object} Object mapping resource names to ValidationResults
 */
function validateMultipleResources(resources) {
  const results = {};
  
  for (const [name, resourceType] of Object.entries(resources)) {
    results[name] = validateResourceName(name, resourceType);
  }
  
  return results;
}

/**
 * Suggests a shortened name for resources with strict length limits
 * @param {string} baseName - The base name to shorten
 * @param {string} resourceType - The type of resource
 * @returns {string} A shortened name that fits the constraints
 */
function suggestShortenedName(baseName, resourceType) {
  const constraints = RESOURCE_CONSTRAINTS[resourceType];
  if (!constraints) {
    return baseName;
  }
  
  // Common abbreviations
  const abbreviations = {
    'production': 'prod',
    'development': 'dev',
    'staging': 'stg',
    'storage': 'stor',
    'container': 'ctr',
    'registry': 'reg',
    'keyvault': 'kv',
    'application': 'app',
    'service': 'svc',
    'database': 'db',
    'resource': 'rsc'
  };
  
  let shortened = baseName.toLowerCase();
  
  // Apply abbreviations
  for (const [full, abbr] of Object.entries(abbreviations)) {
    shortened = shortened.replace(new RegExp(full, 'gi'), abbr);
  }
  
  // Remove characters not allowed for storage accounts
  if (resourceType === 'storageAccount') {
    shortened = shortened.replace(/[^a-z0-9]/g, '');
  }
  
  // Truncate to max length
  if (shortened.length > constraints.maxLength) {
    shortened = shortened.substring(0, constraints.maxLength);
  }
  
  return shortened;
}

/**
 * Gets the constraints for a resource type
 * @param {string} resourceType - The type of resource
 * @returns {Object|null} The constraints object or null if not found
 */
function getResourceConstraints(resourceType) {
  return RESOURCE_CONSTRAINTS[resourceType] || null;
}

/**
 * Lists all supported resource types
 * @returns {string[]} Array of supported resource type keys
 */
function listResourceTypes() {
  return Object.keys(RESOURCE_CONSTRAINTS);
}

module.exports = {
  RESOURCE_CONSTRAINTS,
  validateResourceName,
  validateMultipleResources,
  suggestShortenedName,
  getResourceConstraints,
  listResourceTypes
};
