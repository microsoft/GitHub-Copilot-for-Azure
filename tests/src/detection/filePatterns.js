/**
 * File patterns used to detect application types and Azure service recommendations.
 * Based on azure-deploy SKILL.md detection logic.
 */

const HIGH_CONFIDENCE_PATTERNS = {
  // Azure configuration files - highest priority
  azureYaml: 'azure.yaml',
  
  // Azure Functions indicators
  hostJson: 'host.json',
  functionJson: 'function.json',
  localSettingsJson: 'local.settings.json',
  functionAppPy: 'function_app.py',
  
  // Static Web Apps indicators
  staticWebAppConfig: 'staticwebapp.config.json',
  swaCliConfig: 'swa-cli.config.json',
  
  // Container indicators
  dockerfile: 'Dockerfile',
  dockerCompose: 'docker-compose.yml',
  dockerComposeYaml: 'docker-compose.yaml'
};

const NODEJS_PATTERNS = {
  packageJson: 'package.json',
  
  // Framework config files
  nextConfig: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
  nuxtConfig: ['nuxt.config.ts', 'nuxt.config.js'],
  angularJson: 'angular.json',
  viteConfig: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
  gatsbyConfig: 'gatsby-config.js',
  astroConfig: 'astro.config.mjs',
  nestCliJson: 'nest-cli.json',
  
  // Server framework dependencies (in package.json)
  serverDependencies: ['express', 'fastify', 'koa', 'hapi', '@hapi/hapi']
};

const PYTHON_PATTERNS = {
  requirementsTxt: 'requirements.txt',
  pyprojectToml: 'pyproject.toml',
  
  // Framework dependencies (in requirements.txt or pyproject.toml)
  frameworks: {
    flask: 'flask',
    django: 'django',
    fastapi: 'fastapi',
    azureFunctions: 'azure-functions'
  }
};

const DOTNET_PATTERNS = {
  csproj: '*.csproj',
  sln: '*.sln',
  
  // Project type indicators (in .csproj content)
  azureFunctionsVersion: '<AzureFunctionsVersion>',
  blazorWebAssembly: 'Microsoft.AspNetCore.Components.WebAssembly',
  aspNetCore: 'Microsoft.AspNetCore'
};

const JAVA_PATTERNS = {
  pomXml: 'pom.xml',
  buildGradle: 'build.gradle',
  buildGradleKts: 'build.gradle.kts',
  
  // Dependencies (in pom.xml or build.gradle)
  dependencies: {
    azureFunctions: 'azure-functions',
    springBoot: 'spring-boot'
  }
};

const STATIC_PATTERNS = {
  indexHtml: 'index.html'
};

const MULTI_SERVICE_PATTERNS = {
  // Directory names indicating multi-service
  serviceDirectories: ['frontend', 'backend', 'api', 'web', 'packages', 'apps', 'services'],
  
  // Environment files that may contain service references
  envFiles: ['.env', '.env.local', '.env.production']
};

module.exports = {
  HIGH_CONFIDENCE_PATTERNS,
  NODEJS_PATTERNS,
  PYTHON_PATTERNS,
  DOTNET_PATTERNS,
  JAVA_PATTERNS,
  STATIC_PATTERNS,
  MULTI_SERVICE_PATTERNS
};
