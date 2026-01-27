/**
 * .NET Framework Detection Tests
 * 
 * Tests for detecting .NET frameworks and routing to appropriate Azure services.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('.NET Framework Detection', () => {
  describe('Azure Functions', () => {
    test('detects Azure Functions from csproj with AzureFunctionsVersion', () => {
      const project = {
        files: ['MyFunctions.csproj', 'Function1.cs'],
        contents: {
          'MyFunctions.csproj': `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Sdk.Functions" Version="4.2.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.framework).toBe('Azure Functions (.NET)');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    });
    
    test('detects isolated worker model Functions', () => {
      const project = {
        files: ['FunctionApp.csproj', 'Program.cs'],
        contents: {
          'FunctionApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Exe</OutputType>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="1.20.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.framework).toBe('Azure Functions (.NET)');
    });
  });

  describe('Blazor WebAssembly', () => {
    test('detects Blazor WebAssembly and recommends Static Web Apps', () => {
      const project = {
        files: ['BlazorApp.csproj', 'Program.cs', 'wwwroot/index.html'],
        contents: {
          'BlazorApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="8.0.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.skill).toBe(SKILL_ROUTES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Blazor WebAssembly');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
  });

  describe('ASP.NET Core', () => {
    test('detects ASP.NET Core Web API and recommends App Service', () => {
      const project = {
        files: ['WebApi.csproj', 'Program.cs', 'Controllers/WeatherController.cs'],
        contents: {
          'WebApi.csproj': `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('ASP.NET Core');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects ASP.NET Core MVC application', () => {
      const project = {
        files: ['WebApp.csproj', 'Program.cs', 'Views/Home/Index.cshtml'],
        contents: {
          'WebApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc" Version="2.2.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('ASP.NET Core');
    });
    
    test('detects minimal API ASP.NET Core', () => {
      const project = {
        files: ['MinimalApi.csproj', 'Program.cs'],
        contents: {
          'MinimalApi.csproj': `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`
        }
      };
      
      // Note: Web SDK implies ASP.NET Core
      const result = detectAppType(project);
      
      // Without explicit Microsoft.AspNetCore references, might be lower confidence
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
    });
  });

  describe('Generic .NET', () => {
    test('detects generic .NET console app with low confidence', () => {
      const project = {
        files: ['ConsoleApp.csproj', 'Program.cs'],
        contents: {
          'ConsoleApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
    
    test('detects .NET solution file', () => {
      const project = {
        files: ['MySolution.sln', 'src/WebApp/WebApp.csproj'],
        contents: {}
      };
      
      const result = detectAppType(project);
      
      // Solution without accessible csproj content
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });

  describe('Priority Order', () => {
    test('Functions takes priority over ASP.NET Core', () => {
      const project = {
        files: ['FunctionApp.csproj'],
        contents: {
          'FunctionApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc" Version="2.2.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
    });
    
    test('Blazor WebAssembly takes priority over ASP.NET Core', () => {
      const project = {
        files: ['BlazorApp.csproj'],
        contents: {
          'BlazorApp.csproj': `
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore" Version="8.0.0" />
  </ItemGroup>
</Project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.STATIC_WEB_APPS);
      expect(result.framework).toBe('Blazor WebAssembly');
    });
  });
});
