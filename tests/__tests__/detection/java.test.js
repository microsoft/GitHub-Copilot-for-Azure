/**
 * Java Framework Detection Tests
 * 
 * Tests for detecting Java frameworks and routing to appropriate Azure services.
 */

const { detectAppType } = require('../../src/detection/appTypeDetector');
const { AZURE_SERVICES, SKILL_ROUTES, CONFIDENCE_LEVELS } = require('../../src/detection/serviceMapping');

describe('Java Framework Detection', () => {
  describe('Azure Functions', () => {
    test('detects Azure Functions from pom.xml dependency', () => {
      const project = {
        files: ['pom.xml', 'src/main/java/Function.java'],
        contents: {
          'pom.xml': `
<project>
  <dependencies>
    <dependency>
      <groupId>com.microsoft.azure.functions</groupId>
      <artifactId>azure-functions-java-library</artifactId>
      <version>3.0.0</version>
    </dependency>
  </dependencies>
</project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.skill).toBe(SKILL_ROUTES.FUNCTIONS);
      expect(result.framework).toBe('Azure Functions (Java)');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects Azure Functions from build.gradle', () => {
      const project = {
        files: ['build.gradle', 'src/main/java/Function.java'],
        contents: {
          'build.gradle': `
plugins {
    id 'java'
    id 'com.microsoft.azure.azurefunctions' version '1.12.0'
}

dependencies {
    implementation 'com.microsoft.azure.functions:azure-functions-java-library:3.0.0'
}
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
      expect(result.framework).toBe('Azure Functions (Java)');
    });
  });

  describe('Spring Boot', () => {
    test('detects Spring Boot from pom.xml parent', () => {
      const project = {
        files: ['pom.xml', 'src/main/java/Application.java'],
        contents: {
          'pom.xml': `
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
  </parent>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.skill).toBe(SKILL_ROUTES.APP_SERVICE);
      expect(result.framework).toBe('Spring Boot');
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.MEDIUM);
    });
    
    test('detects Spring Boot from build.gradle', () => {
      const project = {
        files: ['build.gradle', 'src/main/java/Application.java'],
        contents: {
          'build.gradle': `
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Spring Boot');
    });
    
    test('detects Spring Boot from build.gradle.kts (Kotlin DSL)', () => {
      const project = {
        files: ['build.gradle.kts', 'src/main/kotlin/Application.kt'],
        contents: {
          'build.gradle.kts': `
plugins {
    kotlin("jvm") version "1.9.0"
    id("org.springframework.boot") version "3.2.0"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
}
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.framework).toBe('Spring Boot');
    });
  });

  describe('Generic Java', () => {
    test('detects generic Java Maven project with low confidence', () => {
      const project = {
        files: ['pom.xml', 'src/main/java/App.java'],
        contents: {
          'pom.xml': `
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
</project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
      expect(result.framework).toBeUndefined();
    });
    
    test('detects generic Java Gradle project with low confidence', () => {
      const project = {
        files: ['build.gradle', 'src/main/java/Main.java'],
        contents: {
          'build.gradle': `
plugins {
    id 'java'
    id 'application'
}

mainClassName = 'Main'
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.APP_SERVICE);
      expect(result.confidence).toBe(CONFIDENCE_LEVELS.LOW);
    });
  });

  describe('Priority Order', () => {
    test('Functions takes priority over Spring Boot', () => {
      const project = {
        files: ['pom.xml'],
        contents: {
          'pom.xml': `
<project>
  <dependencies>
    <dependency>
      <groupId>com.microsoft.azure.functions</groupId>
      <artifactId>azure-functions-java-library</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>
`
        }
      };
      
      const result = detectAppType(project);
      
      expect(result.service).toBe(AZURE_SERVICES.FUNCTIONS);
    });
  });
});
