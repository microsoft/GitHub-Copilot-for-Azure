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

// All deployment skills consolidated into azure-deploy
// Reference guides: ./reference/functions.md, ./reference/static-web-apps.md, 
// ./reference/container-apps.md, ./reference/app-service.md, ./reference/aks.md
const SKILL_ROUTES = {
  FUNCTIONS: 'azure-deploy',
  STATIC_WEB_APPS: 'azure-deploy',
  CONTAINER_APPS: 'azure-deploy',
  APP_SERVICE: 'azure-deploy',
  AKS: 'azure-deploy',
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
