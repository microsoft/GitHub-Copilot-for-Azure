/**
 * Azure service mappings based on detection results.
 * Maps detected patterns to recommended Azure services and skills.
 */

const AZURE_SERVICES = {
  FUNCTIONS: 'Azure Functions',
  STATIC_WEB_APPS: 'Static Web Apps',
  CONTAINER_APPS: 'Container Apps',
  APP_SERVICE: 'App Service',
  AZD: 'Azure Developer CLI (azd)'
};

const SKILL_ROUTES = {
  FUNCTIONS: 'azure-function-app-deployment',
  STATIC_WEB_APPS: 'azure-static-web-apps',
  CONTAINER_APPS: 'azure-aca-deployment',
  APP_SERVICE: 'azure-app-service-deployment',
  DEPLOY: 'azure-deploy'
};

const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * Service recommendation result
 * @typedef {Object} ServiceRecommendation
 * @property {string} service - The recommended Azure service
 * @property {string} skill - The skill to route to
 * @property {string} confidence - Confidence level (HIGH, MEDIUM, LOW)
 * @property {string} reason - Explanation for the recommendation
 * @property {string} [framework] - Detected framework (if applicable)
 */

/**
 * Creates a service recommendation object
 */
function createRecommendation(service, skill, confidence, reason, framework = null) {
  const result = { service, skill, confidence, reason };
  if (framework) {
    result.framework = framework;
  }
  return result;
}

module.exports = {
  AZURE_SERVICES,
  SKILL_ROUTES,
  CONFIDENCE_LEVELS,
  createRecommendation
};
