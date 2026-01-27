import { detectProject } from '../utils/project-scanner';
import { 
  listProjectFixtures, 
  getProjectPath, 
  loadExpectations 
} from '../utils/fixture-loader';

describe('Azure Deploy - Confidence Assessment', () => {
  const fixtures = listProjectFixtures();
  const expectations = loadExpectations();

  describe('HIGH Confidence Detection', () => {
    const highConfidenceFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.confidence === 'HIGH')
      .map(([name]) => name);

    highConfidenceFixtures.forEach(fixtureName => {
      it(`should detect ${fixtureName} with HIGH confidence`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        
        expect(result.confidence).toBe('HIGH');
      });
    });

    it('HIGH confidence should be for Azure config files', () => {
      // Azure config files (azure.yaml, host.json, function.json, Dockerfile) = HIGH confidence
      const highConfidenceServices = highConfidenceFixtures.map(name => {
        const result = detectProject(getProjectPath(name));
        return { name, service: result.service, reason: result.reason };
      });

      highConfidenceServices.forEach(({ name, reason }) => {
        expect(reason).toMatch(
          /azure\.yaml|host\.json|function\.json|function_app\.py|Dockerfile|docker-compose|AzureFunctionsVersion/i
        );
      });
    });
  });

  describe('MEDIUM Confidence Detection', () => {
    const mediumConfidenceFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.confidence === 'MEDIUM')
      .map(([name]) => name);

    mediumConfidenceFixtures.forEach(fixtureName => {
      it(`should detect ${fixtureName} with MEDIUM confidence`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        
        expect(result.confidence).toBe('MEDIUM');
      });
    });

    it('MEDIUM confidence should be for framework detection', () => {
      // Framework detection (React, Vue, Flask, etc.) = MEDIUM confidence
      const mediumConfidenceResults = mediumConfidenceFixtures.map(name => {
        const result = detectProject(getProjectPath(name));
        return { name, framework: result.framework };
      });

      // All MEDIUM confidence should have a framework detected
      mediumConfidenceResults.forEach(({ name, framework }) => {
        expect(framework).toBeDefined();
      });
    });
  });

  describe('Confidence Priority', () => {
    it('should prioritize Azure config over framework detection', () => {
      // functions-node has both host.json (HIGH) and package.json with @azure/functions (MEDIUM)
      // Should return HIGH confidence from host.json
      const result = detectProject(getProjectPath('functions-node'));
      expect(result.confidence).toBe('HIGH');
      expect(result.reason).toContain('host.json');
    });

    it('should prioritize Dockerfile over framework dependencies', () => {
      // docker-node has both Dockerfile (HIGH) and package.json with express (MEDIUM)
      // Should return HIGH confidence from Dockerfile
      const result = detectProject(getProjectPath('docker-node'));
      expect(result.confidence).toBe('HIGH');
      expect(result.reason).toContain('Dockerfile');
    });
  });
});
