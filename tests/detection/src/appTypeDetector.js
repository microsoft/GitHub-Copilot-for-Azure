/**
 * App Type Detector
 * 
 * Detects application type from project structure and recommends Azure services.
 * Based on azure-deploy SKILL.md detection logic.
 */

const {
  HIGH_CONFIDENCE_PATTERNS,
  NODEJS_PATTERNS,
  PYTHON_PATTERNS,
  DOTNET_PATTERNS,
  JAVA_PATTERNS,
  STATIC_PATTERNS,
  MULTI_SERVICE_PATTERNS
} = require('./filePatterns');

const {
  AZURE_SERVICES,
  SKILL_ROUTES,
  CONFIDENCE_LEVELS,
  createRecommendation
} = require('./serviceMapping');

/**
 * Detects application type and recommends Azure service
 * @param {Object} projectStructure - Object representing project files
 * @param {string[]} projectStructure.files - Array of file paths
 * @param {Object} projectStructure.contents - Map of file path to content
 * @param {string[]} [projectStructure.directories] - Array of directory names
 * @returns {ServiceRecommendation} Recommended Azure service
 */
function detectAppType(projectStructure) {
  const { files = [], contents = {}, directories = [] } = projectStructure;
  
  // Phase 1: Check high-confidence Azure configuration files
  const highConfidenceResult = checkHighConfidencePatterns(files, contents);
  if (highConfidenceResult) {
    return highConfidenceResult;
  }
  
  // Phase 2: Check for multi-service architecture
  const multiServiceResult = checkMultiServicePatterns(files, directories);
  if (multiServiceResult) {
    return multiServiceResult;
  }
  
  // Phase 3: Detect by language/framework
  const frameworkResult = detectFramework(files, contents);
  if (frameworkResult) {
    return frameworkResult;
  }
  
  // Phase 4: Check for pure static site
  const staticResult = checkStaticSite(files);
  if (staticResult) {
    return staticResult;
  }
  
  // Low confidence - unable to determine
  return createRecommendation(
    null,
    SKILL_ROUTES.DEPLOY,
    CONFIDENCE_LEVELS.LOW,
    'Unable to determine application type. Please provide more information.'
  );
}

/**
 * Check for high-confidence Azure configuration patterns
 */
function checkHighConfidencePatterns(files, contents) {
  const hasFile = (pattern) => {
    if (Array.isArray(pattern)) {
      return pattern.some(p => files.includes(p));
    }
    return files.includes(pattern);
  };
  
  // Azure Developer CLI project
  if (hasFile(HIGH_CONFIDENCE_PATTERNS.azureYaml)) {
    return createRecommendation(
      AZURE_SERVICES.AZD,
      SKILL_ROUTES.DEPLOY,
      CONFIDENCE_LEVELS.HIGH,
      'Found azure.yaml - project is configured for Azure Developer CLI'
    );
  }
  
  // Azure Functions
  if (hasFile(HIGH_CONFIDENCE_PATTERNS.hostJson) || 
      hasFile(HIGH_CONFIDENCE_PATTERNS.functionJson) ||
      hasFile(HIGH_CONFIDENCE_PATTERNS.functionAppPy)) {
    return createRecommendation(
      AZURE_SERVICES.FUNCTIONS,
      SKILL_ROUTES.FUNCTIONS,
      CONFIDENCE_LEVELS.HIGH,
      'Found Azure Functions configuration file (host.json, function.json, or function_app.py)'
    );
  }
  
  // Static Web Apps
  if (hasFile(HIGH_CONFIDENCE_PATTERNS.staticWebAppConfig) ||
      hasFile(HIGH_CONFIDENCE_PATTERNS.swaCliConfig)) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.HIGH,
      'Found Static Web Apps configuration file'
    );
  }
  
  // Container Apps (Dockerfile)
  if (hasFile(HIGH_CONFIDENCE_PATTERNS.dockerfile) ||
      hasFile(HIGH_CONFIDENCE_PATTERNS.dockerCompose) ||
      hasFile(HIGH_CONFIDENCE_PATTERNS.dockerComposeYaml)) {
    return createRecommendation(
      AZURE_SERVICES.CONTAINER_APPS,
      SKILL_ROUTES.CONTAINER_APPS,
      CONFIDENCE_LEVELS.HIGH,
      'Found Dockerfile or docker-compose.yml - containerized application'
    );
  }
  
  return null;
}

/**
 * Check for multi-service architecture patterns
 */
function checkMultiServicePatterns(files, directories) {
  const serviceDirectories = MULTI_SERVICE_PATTERNS.serviceDirectories;
  const foundServiceDirs = directories.filter(dir => 
    serviceDirectories.some(sd => dir.toLowerCase().includes(sd))
  );
  
  // Check for multiple package.json in subdirectories
  const packageJsonFiles = files.filter(f => 
    f.includes('/') && f.endsWith('package.json')
  );
  
  if (foundServiceDirs.length >= 2 || packageJsonFiles.length >= 2) {
    return createRecommendation(
      AZURE_SERVICES.AZD,
      SKILL_ROUTES.DEPLOY,
      CONFIDENCE_LEVELS.MEDIUM,
      'Detected multi-service architecture - recommend Azure Developer CLI with Infrastructure as Code'
    );
  }
  
  return null;
}

/**
 * Detect framework from files and contents
 */
function detectFramework(files, contents) {
  // Check Node.js
  if (files.includes(NODEJS_PATTERNS.packageJson)) {
    return detectNodeJsFramework(files, contents);
  }
  
  // Check Python
  if (files.includes(PYTHON_PATTERNS.requirementsTxt) || 
      files.includes(PYTHON_PATTERNS.pyprojectToml)) {
    return detectPythonFramework(files, contents);
  }
  
  // Check .NET
  const csprojFile = files.find(f => f.endsWith('.csproj'));
  if (csprojFile || files.find(f => f.endsWith('.sln'))) {
    return detectDotNetFramework(files, contents, csprojFile);
  }
  
  // Check Java
  if (files.includes(JAVA_PATTERNS.pomXml) || 
      files.includes(JAVA_PATTERNS.buildGradle) ||
      files.includes(JAVA_PATTERNS.buildGradleKts)) {
    return detectJavaFramework(files, contents);
  }
  
  return null;
}

/**
 * Detect Node.js framework
 */
function detectNodeJsFramework(files, contents) {
  const hasFile = (pattern) => {
    if (Array.isArray(pattern)) {
      return pattern.some(p => files.includes(p));
    }
    return files.includes(pattern);
  };
  
  const packageJson = contents['package.json'];
  const dependencies = packageJson ? 
    { ...packageJson.dependencies, ...packageJson.devDependencies } : {};
  
  // Next.js
  if (hasFile(NODEJS_PATTERNS.nextConfig)) {
    // Check for static export
    const nextConfigFile = NODEJS_PATTERNS.nextConfig.find(f => files.includes(f));
    const nextConfig = contents[nextConfigFile];
    
    if (nextConfig && typeof nextConfig === 'string' && nextConfig.includes("output: 'export'")) {
      return createRecommendation(
        AZURE_SERVICES.STATIC_WEB_APPS,
        SKILL_ROUTES.STATIC_WEB_APPS,
        CONFIDENCE_LEVELS.MEDIUM,
        'Next.js with static export detected',
        'Next.js (SSG)'
      );
    }
    
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'Next.js with server-side rendering detected',
      'Next.js (SSR)'
    );
  }
  
  // Nuxt
  if (hasFile(NODEJS_PATTERNS.nuxtConfig)) {
    const nuxtConfigFile = NODEJS_PATTERNS.nuxtConfig.find(f => files.includes(f));
    const nuxtConfig = contents[nuxtConfigFile];
    
    if (nuxtConfig && typeof nuxtConfig === 'string' && 
        (nuxtConfig.includes('ssr: false') || nuxtConfig.includes("target: 'static'"))) {
      return createRecommendation(
        AZURE_SERVICES.STATIC_WEB_APPS,
        SKILL_ROUTES.STATIC_WEB_APPS,
        CONFIDENCE_LEVELS.MEDIUM,
        'Nuxt with static generation detected',
        'Nuxt (Static)'
      );
    }
    
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'Nuxt with server-side rendering detected',
      'Nuxt (SSR)'
    );
  }
  
  // Angular
  if (hasFile(NODEJS_PATTERNS.angularJson)) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Angular application detected',
      'Angular'
    );
  }
  
  // Vite (React, Vue, Svelte)
  if (hasFile(NODEJS_PATTERNS.viteConfig)) {
    let framework = 'Vite';
    if (dependencies.react) framework = 'React (Vite)';
    else if (dependencies.vue) framework = 'Vue (Vite)';
    else if (dependencies.svelte) framework = 'Svelte (Vite)';
    
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Vite-based static application detected',
      framework
    );
  }
  
  // Gatsby
  if (hasFile(NODEJS_PATTERNS.gatsbyConfig)) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Gatsby static site generator detected',
      'Gatsby'
    );
  }
  
  // Astro
  if (hasFile(NODEJS_PATTERNS.astroConfig)) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Astro framework detected',
      'Astro'
    );
  }
  
  // NestJS
  if (hasFile(NODEJS_PATTERNS.nestCliJson)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'NestJS backend framework detected',
      'NestJS'
    );
  }
  
  // Express/Fastify/Koa/Hapi (server frameworks)
  const serverFramework = NODEJS_PATTERNS.serverDependencies.find(dep => dependencies[dep]);
  if (serverFramework) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      `${serverFramework} server framework detected`,
      serverFramework.charAt(0).toUpperCase() + serverFramework.slice(1)
    );
  }
  
  // Generic Node.js with no framework detected
  return createRecommendation(
    AZURE_SERVICES.APP_SERVICE,
    SKILL_ROUTES.APP_SERVICE,
    CONFIDENCE_LEVELS.LOW,
    'Node.js project detected, but no specific framework identified'
  );
}

/**
 * Detect Python framework
 */
function detectPythonFramework(files, contents) {
  // Check for function_app.py (Azure Functions v2)
  if (files.includes('function_app.py')) {
    return createRecommendation(
      AZURE_SERVICES.FUNCTIONS,
      SKILL_ROUTES.FUNCTIONS,
      CONFIDENCE_LEVELS.HIGH,
      'Azure Functions Python v2 programming model detected',
      'Azure Functions (Python)'
    );
  }
  
  // Parse requirements.txt or pyproject.toml
  let dependencies = [];
  
  if (contents['requirements.txt']) {
    dependencies = contents['requirements.txt']
      .toLowerCase()
      .split('\n')
      .map(line => line.split('==')[0].split('>=')[0].split('~=')[0].trim());
  }
  
  if (contents['pyproject.toml']) {
    const tomlContent = contents['pyproject.toml'].toLowerCase();
    Object.values(PYTHON_PATTERNS.frameworks).forEach(framework => {
      if (tomlContent.includes(framework)) {
        dependencies.push(framework);
      }
    });
  }
  
  // Azure Functions
  if (dependencies.includes(PYTHON_PATTERNS.frameworks.azureFunctions)) {
    return createRecommendation(
      AZURE_SERVICES.FUNCTIONS,
      SKILL_ROUTES.FUNCTIONS,
      CONFIDENCE_LEVELS.MEDIUM,
      'azure-functions dependency detected',
      'Azure Functions (Python)'
    );
  }
  
  // FastAPI
  if (dependencies.includes(PYTHON_PATTERNS.frameworks.fastapi)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'FastAPI framework detected',
      'FastAPI'
    );
  }
  
  // Flask
  if (dependencies.includes(PYTHON_PATTERNS.frameworks.flask)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'Flask framework detected',
      'Flask'
    );
  }
  
  // Django
  if (dependencies.includes(PYTHON_PATTERNS.frameworks.django)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'Django framework detected',
      'Django'
    );
  }
  
  // Generic Python
  return createRecommendation(
    AZURE_SERVICES.APP_SERVICE,
    SKILL_ROUTES.APP_SERVICE,
    CONFIDENCE_LEVELS.LOW,
    'Python project detected, but no specific framework identified'
  );
}

/**
 * Detect .NET framework
 */
function detectDotNetFramework(files, contents, csprojFile) {
  const csprojContent = csprojFile ? contents[csprojFile] : '';
  
  // Azure Functions
  if (csprojContent && csprojContent.includes(DOTNET_PATTERNS.azureFunctionsVersion)) {
    return createRecommendation(
      AZURE_SERVICES.FUNCTIONS,
      SKILL_ROUTES.FUNCTIONS,
      CONFIDENCE_LEVELS.HIGH,
      'Azure Functions .NET project detected',
      'Azure Functions (.NET)'
    );
  }
  
  // Blazor WebAssembly
  if (csprojContent && csprojContent.includes(DOTNET_PATTERNS.blazorWebAssembly)) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Blazor WebAssembly project detected',
      'Blazor WebAssembly'
    );
  }
  
  // ASP.NET Core
  if (csprojContent && csprojContent.includes(DOTNET_PATTERNS.aspNetCore)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'ASP.NET Core application detected',
      'ASP.NET Core'
    );
  }
  
  // Generic .NET
  return createRecommendation(
    AZURE_SERVICES.APP_SERVICE,
    SKILL_ROUTES.APP_SERVICE,
    CONFIDENCE_LEVELS.LOW,
    '.NET project detected, but no specific framework identified'
  );
}

/**
 * Detect Java framework
 */
function detectJavaFramework(files, contents) {
  let dependencyContent = '';
  
  if (contents['pom.xml']) {
    dependencyContent = contents['pom.xml'].toLowerCase();
  } else if (contents['build.gradle']) {
    dependencyContent = contents['build.gradle'].toLowerCase();
  } else if (contents['build.gradle.kts']) {
    dependencyContent = contents['build.gradle.kts'].toLowerCase();
  }
  
  // Azure Functions
  if (dependencyContent.includes(JAVA_PATTERNS.dependencies.azureFunctions)) {
    return createRecommendation(
      AZURE_SERVICES.FUNCTIONS,
      SKILL_ROUTES.FUNCTIONS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Azure Functions Java project detected',
      'Azure Functions (Java)'
    );
  }
  
  // Spring Boot
  if (dependencyContent.includes(JAVA_PATTERNS.dependencies.springBoot)) {
    return createRecommendation(
      AZURE_SERVICES.APP_SERVICE,
      SKILL_ROUTES.APP_SERVICE,
      CONFIDENCE_LEVELS.MEDIUM,
      'Spring Boot application detected',
      'Spring Boot'
    );
  }
  
  // Generic Java
  return createRecommendation(
    AZURE_SERVICES.APP_SERVICE,
    SKILL_ROUTES.APP_SERVICE,
    CONFIDENCE_LEVELS.LOW,
    'Java project detected, but no specific framework identified'
  );
}

/**
 * Check for pure static site
 */
function checkStaticSite(files) {
  // Has index.html but no package.json or other language files
  if (files.includes(STATIC_PATTERNS.indexHtml) &&
      !files.includes('package.json') &&
      !files.includes('requirements.txt') &&
      !files.find(f => f.endsWith('.csproj')) &&
      !files.includes('pom.xml') &&
      !files.includes('build.gradle')) {
    return createRecommendation(
      AZURE_SERVICES.STATIC_WEB_APPS,
      SKILL_ROUTES.STATIC_WEB_APPS,
      CONFIDENCE_LEVELS.MEDIUM,
      'Pure static HTML site detected',
      'Static HTML'
    );
  }
  
  return null;
}

module.exports = {
  detectAppType,
  checkHighConfidencePatterns,
  checkMultiServicePatterns,
  detectFramework,
  detectNodeJsFramework,
  detectPythonFramework,
  detectDotNetFramework,
  detectJavaFramework,
  checkStaticSite
};
