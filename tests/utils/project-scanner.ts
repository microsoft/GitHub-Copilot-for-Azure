import * as fs from 'fs';
import * as path from 'path';

export type AzureService = 
  | 'static-web-apps' 
  | 'functions' 
  | 'container-apps' 
  | 'app-service' 
  | 'azd-multi-service';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DetectionResult {
  service: AzureService;
  confidence: Confidence;
  framework?: string;
  reason: string;
}

export interface FilePattern {
  path: string;
  contains?: string;
}

/**
 * Check if a file exists in the project directory
 */
export function fileExists(projectPath: string, fileName: string): boolean {
  return fs.existsSync(path.join(projectPath, fileName));
}

/**
 * Check if a file contains specific content
 */
export function fileContains(projectPath: string, fileName: string, content: string): boolean {
  const filePath = path.join(projectPath, fileName);
  if (!fs.existsSync(filePath)) return false;
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return fileContent.includes(content);
}

/**
 * Read and parse a JSON file from the project
 */
export function readJsonFile<T>(projectPath: string, fileName: string): T | null {
  const filePath = path.join(projectPath, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Check for Azure configuration files (HIGH confidence signals)
 */
export function detectAzureConfig(projectPath: string): DetectionResult | null {
  // azd project
  if (fileExists(projectPath, 'azure.yaml')) {
    return {
      service: 'azd-multi-service',
      confidence: 'HIGH',
      reason: 'Found azure.yaml - azd-configured project'
    };
  }

  // Azure Functions
  if (fileExists(projectPath, 'host.json') || fileExists(projectPath, 'function.json')) {
    return {
      service: 'functions',
      confidence: 'HIGH',
      reason: 'Found host.json or function.json - Azure Functions project'
    };
  }

  // Check for function.json in subdirectories (common pattern)
  if (fs.existsSync(projectPath)) {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (fileExists(path.join(projectPath, entry.name), 'function.json')) {
          return {
            service: 'functions',
            confidence: 'HIGH',
            reason: `Found function.json in ${entry.name}/ - Azure Functions project`
          };
        }
      }
    }
  }

  // Python Functions v2
  if (fileExists(projectPath, 'function_app.py')) {
    return {
      service: 'functions',
      confidence: 'HIGH',
      reason: 'Found function_app.py - Azure Functions Python v2 project'
    };
  }

  // Static Web Apps config
  if (fileExists(projectPath, 'staticwebapp.config.json') || 
      fileExists(projectPath, 'swa-cli.config.json')) {
    return {
      service: 'static-web-apps',
      confidence: 'HIGH',
      reason: 'Found staticwebapp.config.json or swa-cli.config.json'
    };
  }

  // Containerized app
  if (fileExists(projectPath, 'Dockerfile') || fileExists(projectPath, 'docker-compose.yml')) {
    return {
      service: 'container-apps',
      confidence: 'HIGH',
      reason: 'Found Dockerfile or docker-compose.yml - containerized application'
    };
  }

  return null;
}

/**
 * Detect Node.js/JavaScript/TypeScript frameworks
 */
export function detectNodeFramework(projectPath: string): DetectionResult | null {
  const packageJson = readJsonFile<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(projectPath, 'package.json');

  if (!packageJson) return null;

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Next.js detection
  if (deps['next']) {
    // Check for static export config
    const nextConfigFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
    for (const configFile of nextConfigFiles) {
      if (fileContains(projectPath, configFile, "output: 'export'") ||
          fileContains(projectPath, configFile, 'output: "export"')) {
        return {
          service: 'static-web-apps',
          confidence: 'MEDIUM',
          framework: 'nextjs-static',
          reason: 'Next.js with output: export - static site'
        };
      }
    }
    // SSR Next.js
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'nextjs-ssr',
      reason: 'Next.js without static export - server-side rendering'
    };
  }

  // Nuxt detection
  if (deps['nuxt']) {
    if (fileContains(projectPath, 'nuxt.config.ts', 'ssr: false') ||
        fileContains(projectPath, 'nuxt.config.js', 'ssr: false') ||
        fileContains(projectPath, 'nuxt.config.ts', "target: 'static'") ||
        fileContains(projectPath, 'nuxt.config.js', "target: 'static'")) {
      return {
        service: 'static-web-apps',
        confidence: 'MEDIUM',
        framework: 'nuxt-static',
        reason: 'Nuxt with static target or SSR disabled'
      };
    }
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'nuxt-ssr',
      reason: 'Nuxt with SSR enabled'
    };
  }

  // Angular
  if (fileExists(projectPath, 'angular.json')) {
    return {
      service: 'static-web-apps',
      confidence: 'MEDIUM',
      framework: 'angular',
      reason: 'Angular project detected'
    };
  }

  // Vite-based projects (React, Vue, Svelte)
  if (deps['vite']) {
    let framework = 'vite';
    if (deps['react']) framework = 'react-vite';
    else if (deps['vue']) framework = 'vue-vite';
    else if (deps['svelte']) framework = 'svelte-vite';

    return {
      service: 'static-web-apps',
      confidence: 'MEDIUM',
      framework,
      reason: `Vite-based ${framework} project`
    };
  }

  // Gatsby
  if (deps['gatsby']) {
    return {
      service: 'static-web-apps',
      confidence: 'MEDIUM',
      framework: 'gatsby',
      reason: 'Gatsby static site'
    };
  }

  // Astro
  if (deps['astro']) {
    return {
      service: 'static-web-apps',
      confidence: 'MEDIUM',
      framework: 'astro',
      reason: 'Astro static site'
    };
  }

  // NestJS (backend framework)
  if (fileExists(projectPath, 'nest-cli.json') || deps['@nestjs/core']) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'nestjs',
      reason: 'NestJS backend framework'
    };
  }

  // Express/Fastify/Koa/Hapi (backend frameworks)
  const backendFrameworks = ['express', 'fastify', 'koa', 'hapi', '@hapi/hapi'];
  for (const framework of backendFrameworks) {
    if (deps[framework]) {
      return {
        service: 'app-service',
        confidence: 'MEDIUM',
        framework,
        reason: `${framework} backend framework detected`
      };
    }
  }

  // Azure Functions Node.js
  if (deps['@azure/functions']) {
    return {
      service: 'functions',
      confidence: 'MEDIUM',
      framework: 'azure-functions-node',
      reason: 'Azure Functions Node.js SDK detected'
    };
  }

  // Generic static site with no framework
  if (packageJson && !Object.keys(deps).length) {
    return {
      service: 'static-web-apps',
      confidence: 'LOW',
      framework: 'static',
      reason: 'No framework dependencies - likely static site'
    };
  }

  return null;
}

/**
 * Detect Python frameworks
 */
export function detectPythonFramework(projectPath: string): DetectionResult | null {
  // Check requirements.txt
  const reqPath = path.join(projectPath, 'requirements.txt');
  let requirements = '';
  if (fs.existsSync(reqPath)) {
    requirements = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
  }

  // Check pyproject.toml
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  let pyproject = '';
  if (fs.existsSync(pyprojectPath)) {
    pyproject = fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase();
  }

  const deps = requirements + pyproject;

  if (!deps) return null;

  // Azure Functions Python
  if (deps.includes('azure-functions')) {
    return {
      service: 'functions',
      confidence: 'MEDIUM',
      framework: 'azure-functions-python',
      reason: 'Azure Functions Python SDK detected'
    };
  }

  // Flask
  if (deps.includes('flask')) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'flask',
      reason: 'Flask web framework detected'
    };
  }

  // Django
  if (deps.includes('django')) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'django',
      reason: 'Django web framework detected'
    };
  }

  // FastAPI
  if (deps.includes('fastapi')) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'fastapi',
      reason: 'FastAPI web framework detected'
    };
  }

  return null;
}

/**
 * Detect .NET frameworks
 */
export function detectDotNetFramework(projectPath: string): DetectionResult | null {
  // Find .csproj files
  if (!fs.existsSync(projectPath)) return null;
  
  const files = fs.readdirSync(projectPath);
  const csprojFile = files.find(f => f.endsWith('.csproj'));
  
  if (!csprojFile) return null;
  
  const csprojContent = fs.readFileSync(path.join(projectPath, csprojFile), 'utf-8');

  // Azure Functions
  if (csprojContent.includes('<AzureFunctionsVersion>')) {
    return {
      service: 'functions',
      confidence: 'HIGH',
      framework: 'azure-functions-dotnet',
      reason: 'Azure Functions .NET project (AzureFunctionsVersion in csproj)'
    };
  }

  // Blazor WebAssembly
  if (csprojContent.includes('Microsoft.AspNetCore.Components.WebAssembly')) {
    return {
      service: 'static-web-apps',
      confidence: 'MEDIUM',
      framework: 'blazor-wasm',
      reason: 'Blazor WebAssembly project'
    };
  }

  // ASP.NET Core
  if (csprojContent.includes('Microsoft.AspNetCore') || 
      csprojContent.includes('Sdk="Microsoft.NET.Sdk.Web"')) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'aspnetcore',
      reason: 'ASP.NET Core web application'
    };
  }

  return null;
}

/**
 * Detect Java frameworks
 */
export function detectJavaFramework(projectPath: string): DetectionResult | null {
  // Check pom.xml
  const pomPath = path.join(projectPath, 'pom.xml');
  let pomContent = '';
  if (fs.existsSync(pomPath)) {
    pomContent = fs.readFileSync(pomPath, 'utf-8');
  }

  // Check build.gradle
  const gradlePath = path.join(projectPath, 'build.gradle');
  let gradleContent = '';
  if (fs.existsSync(gradlePath)) {
    gradleContent = fs.readFileSync(gradlePath, 'utf-8');
  }

  const deps = pomContent + gradleContent;

  if (!deps) return null;

  // Azure Functions Java
  if (deps.includes('azure-functions')) {
    return {
      service: 'functions',
      confidence: 'MEDIUM',
      framework: 'azure-functions-java',
      reason: 'Azure Functions Java detected'
    };
  }

  // Spring Boot
  if (deps.includes('spring-boot')) {
    return {
      service: 'app-service',
      confidence: 'MEDIUM',
      framework: 'spring-boot',
      reason: 'Spring Boot application detected'
    };
  }

  return null;
}

/**
 * Detect plain HTML/static site
 */
export function detectStaticSite(projectPath: string): DetectionResult | null {
  if (fileExists(projectPath, 'index.html')) {
    // No package.json or requirements.txt = pure static
    if (!fileExists(projectPath, 'package.json') && 
        !fileExists(projectPath, 'requirements.txt')) {
      return {
        service: 'static-web-apps',
        confidence: 'MEDIUM',
        framework: 'static-html',
        reason: 'Plain HTML site (index.html without build system)'
      };
    }
  }
  return null;
}

/**
 * Main detection function - runs all detectors in priority order
 */
export function detectProject(projectPath: string): DetectionResult {
  // Priority 1: Azure configuration files (HIGH confidence)
  const azureConfig = detectAzureConfig(projectPath);
  if (azureConfig) return azureConfig;

  // Priority 2: Framework-specific detection (MEDIUM confidence)
  const nodeFramework = detectNodeFramework(projectPath);
  if (nodeFramework) return nodeFramework;

  const pythonFramework = detectPythonFramework(projectPath);
  if (pythonFramework) return pythonFramework;

  const dotnetFramework = detectDotNetFramework(projectPath);
  if (dotnetFramework) return dotnetFramework;

  const javaFramework = detectJavaFramework(projectPath);
  if (javaFramework) return javaFramework;

  // Priority 3: Static site fallback
  const staticSite = detectStaticSite(projectPath);
  if (staticSite) return staticSite;

  // Fallback: Unknown
  return {
    service: 'app-service',
    confidence: 'LOW',
    reason: 'Could not determine project type - defaulting to App Service'
  };
}
