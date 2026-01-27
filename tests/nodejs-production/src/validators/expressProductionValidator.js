/**
 * Express.js Production Validator
 * 
 * Validates Express.js applications for Azure production best practices based on
 * the azure-nodejs-production skill requirements.
 * 
 * Checks for:
 * - Trust proxy configuration (required behind Azure load balancers)
 * - Health check endpoint (/health)
 * - Cookie security settings (sameSite, secure, httpOnly)
 * - Port binding (process.env.PORT, 0.0.0.0)
 * - Environment detection (NODE_ENV)
 */

const fs = require('fs');
const path = require('path');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether all checks passed
 * @property {string[]} errors - List of validation errors
 * @property {string[]} warnings - List of validation warnings
 * @property {Object} checks - Individual check results
 */

/**
 * Validates an Express.js application for production readiness
 * @param {string} projectDir - Path to the project directory
 * @returns {ValidationResult}
 */
function validateExpressApp(projectDir) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    checks: {
      trustProxy: { passed: false, message: '' },
      healthEndpoint: { passed: false, message: '' },
      cookieConfig: { passed: false, message: '' },
      portBinding: { passed: false, message: '' },
      hostBinding: { passed: false, message: '' }
    }
  };

  // Find all JS/TS files that might contain Express app code
  const appFiles = findAppFiles(projectDir);
  
  if (appFiles.length === 0) {
    result.valid = false;
    result.errors.push('No JavaScript/TypeScript files found');
    return result;
  }

  // Read and combine all app file contents for analysis
  const combinedContent = appFiles.map(f => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  }).join('\n');

  // Check trust proxy
  result.checks.trustProxy = checkTrustProxy(combinedContent);
  if (!result.checks.trustProxy.passed) {
    result.errors.push(result.checks.trustProxy.message);
  }

  // Check health endpoint
  result.checks.healthEndpoint = checkHealthEndpoint(combinedContent);
  if (!result.checks.healthEndpoint.passed) {
    result.errors.push(result.checks.healthEndpoint.message);
  }

  // Check cookie configuration
  result.checks.cookieConfig = checkCookieConfig(combinedContent);
  if (!result.checks.cookieConfig.passed && result.checks.cookieConfig.message) {
    result.warnings.push(result.checks.cookieConfig.message);
  }

  // Check port binding
  result.checks.portBinding = checkPortBinding(combinedContent);
  if (!result.checks.portBinding.passed) {
    result.errors.push(result.checks.portBinding.message);
  }

  // Check host binding
  result.checks.hostBinding = checkHostBinding(combinedContent);
  if (!result.checks.hostBinding.passed) {
    result.warnings.push(result.checks.hostBinding.message);
  }

  // Set overall validity (only errors affect validity, not warnings)
  result.valid = result.errors.length === 0;

  return result;
}

/**
 * Find all JavaScript/TypeScript files that might contain Express app code
 */
function findAppFiles(projectDir) {
  const files = [];
  const extensions = ['.js', '.ts', '.mjs', '.cjs'];
  
  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }
  
  scanDir(projectDir);
  return files;
}

/**
 * Check for trust proxy configuration
 * Required for Express apps behind Azure load balancers/App Gateway
 */
function checkTrustProxy(content) {
  // Match: app.set('trust proxy', 1) or app.set("trust proxy", true) etc
  const trustProxyRegex = /app\.set\s*\(\s*['"]trust\s*proxy['"]\s*,\s*(?:1|true|'loopback'|"loopback")/i;
  
  // Also check for express.json with trust proxy in options
  const enableTrustProxy = /enable\s*['"]?trust\s*proxy['"]?\s*:\s*true/i;
  
  if (trustProxyRegex.test(content) || enableTrustProxy.test(content)) {
    return { passed: true, message: 'Trust proxy is configured' };
  }
  
  return { 
    passed: false, 
    message: "Missing 'trust proxy' configuration. Add: app.set('trust proxy', 1)" 
  };
}

/**
 * Check for health endpoint
 * Required for Azure App Service health checks
 */
function checkHealthEndpoint(content) {
  // Match: app.get('/health', ...) or router.get('/health', ...)
  const healthRouteRegex = /(?:app|router)\.get\s*\(\s*['"]\/health['"]/i;
  
  // Also check for /healthz (Kubernetes convention)
  const healthzRouteRegex = /(?:app|router)\.get\s*\(\s*['"]\/healthz?['"]/i;
  
  // Check for readiness/liveness probes
  const probeRegex = /(?:app|router)\.get\s*\(\s*['"]\/(?:ready|readiness|liveness|alive)['"]/i;
  
  if (healthRouteRegex.test(content) || healthzRouteRegex.test(content) || probeRegex.test(content)) {
    return { passed: true, message: 'Health endpoint is configured' };
  }
  
  return { 
    passed: false, 
    message: "Missing health check endpoint. Add: app.get('/health', (req, res) => res.status(200).send('OK'))" 
  };
}

/**
 * Check cookie configuration for security
 * sameSite should be 'lax' or 'strict', secure should be conditional on production
 */
function checkCookieConfig(content) {
  // Check if cookies or sessions are used
  const usesCookies = /cookie|session/i.test(content);
  
  if (!usesCookies) {
    return { passed: true, message: 'No cookie/session usage detected' };
  }
  
  // Check for sameSite configuration
  const sameSiteRegex = /sameSite\s*:\s*['"](?:lax|strict|none)['"]/i;
  const secureCookieRegex = /secure\s*:\s*(?:true|process\.env\.NODE_ENV\s*===?\s*['"]production['"])/i;
  
  const hasSameSite = sameSiteRegex.test(content);
  const hasSecure = secureCookieRegex.test(content);
  
  if (hasSameSite && hasSecure) {
    return { passed: true, message: 'Cookie configuration looks secure' };
  }
  
  const issues = [];
  if (!hasSameSite) issues.push("sameSite: 'lax'");
  if (!hasSecure) issues.push("secure: process.env.NODE_ENV === 'production'");
  
  return { 
    passed: false, 
    message: `Cookie security settings missing: ${issues.join(', ')}` 
  };
}

/**
 * Check for proper port binding using environment variable
 */
function checkPortBinding(content) {
  // Match: process.env.PORT || 3000, PORT || 3000, etc
  const portEnvRegex = /(?:process\.env\.)?PORT\s*\|\|?\s*\d+/;
  
  // Match: const port = process.env.PORT
  const portAssignRegex = /(?:const|let|var)\s+port\s*=\s*(?:process\.env\.)?PORT/i;
  
  // Match: listen(process.env.PORT
  const listenPortRegex = /\.listen\s*\(\s*(?:process\.env\.)?PORT/;
  
  if (portEnvRegex.test(content) || portAssignRegex.test(content) || listenPortRegex.test(content)) {
    return { passed: true, message: 'Port binding uses environment variable' };
  }
  
  // Check if there's a hardcoded port
  const hardcodedPortRegex = /\.listen\s*\(\s*\d{4}/;
  if (hardcodedPortRegex.test(content)) {
    return { 
      passed: false, 
      message: 'Hardcoded port detected. Use: process.env.PORT || 3000' 
    };
  }
  
  return { 
    passed: false, 
    message: 'Port binding not found. Use: app.listen(process.env.PORT || 3000)' 
  };
}

/**
 * Check for proper host binding (0.0.0.0 not localhost)
 */
function checkHostBinding(content) {
  // Check for localhost binding (problematic in containers)
  const localhostRegex = /\.listen\s*\([^)]*['"](?:localhost|127\.0\.0\.1)['"]/;
  
  if (localhostRegex.test(content)) {
    return { 
      passed: false, 
      message: "Binding to localhost detected. Use '0.0.0.0' for container compatibility" 
    };
  }
  
  // Check for proper 0.0.0.0 binding
  const properHostRegex = /\.listen\s*\([^)]*['"]0\.0\.0\.0['"]/;
  
  if (properHostRegex.test(content)) {
    return { passed: true, message: 'Host binding is container-compatible' };
  }
  
  // No explicit host is usually OK (defaults vary)
  return { passed: true, message: 'No explicit host binding (may be OK)' };
}

module.exports = {
  validateExpressApp,
  findAppFiles,
  checkTrustProxy,
  checkHealthEndpoint,
  checkCookieConfig,
  checkPortBinding,
  checkHostBinding
};
