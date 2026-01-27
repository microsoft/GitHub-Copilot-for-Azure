import { detectProject, DetectionResult } from '../utils/project-scanner';
import { 
  listProjectFixtures, 
  getProjectPath, 
  loadExpectations,
  validateFixturesHaveExpectations 
} from '../utils/fixture-loader';

describe('Azure Deploy - Service Selection', () => {
  const fixtures = listProjectFixtures();
  const expectations = loadExpectations();

  // Validate test setup
  describe('Test Setup Validation', () => {
    it('should have fixtures defined', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });

    it('should have expectations for all fixtures', () => {
      const validation = validateFixturesHaveExpectations();
      if (!validation.valid) {
        if (validation.missing.length > 0) {
          console.warn('Missing expectations for fixtures:', validation.missing);
        }
        if (validation.extra.length > 0) {
          console.warn('Extra expectations without fixtures:', validation.extra);
        }
      }
      expect(validation.valid).toBe(true);
    });
  });

  // Test each fixture
  describe('Service Detection', () => {
    fixtures.forEach(fixtureName => {
      const expected = expectations[fixtureName];
      
      if (!expected) {
        it.skip(`${fixtureName} - missing expectations`, () => {});
        return;
      }

      it(`should detect ${fixtureName} as ${expected.service}`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);

        expect(result.service).toBe(expected.service);
      });
    });
  });

  // Group tests by Azure service type
  describe('Static Web Apps Detection', () => {
    const swaFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'static-web-apps')
      .map(([name]) => name);

    swaFixtures.forEach(fixtureName => {
      it(`should classify ${fixtureName} as static-web-apps`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.service).toBe('static-web-apps');
      });
    });
  });

  describe('Azure Functions Detection', () => {
    const functionsFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'functions')
      .map(([name]) => name);

    functionsFixtures.forEach(fixtureName => {
      it(`should classify ${fixtureName} as functions`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.service).toBe('functions');
      });
    });
  });

  describe('Container Apps Detection', () => {
    const containerFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'container-apps')
      .map(([name]) => name);

    containerFixtures.forEach(fixtureName => {
      it(`should classify ${fixtureName} as container-apps`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.service).toBe('container-apps');
      });
    });
  });

  describe('App Service Detection', () => {
    const appServiceFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'app-service')
      .map(([name]) => name);

    appServiceFixtures.forEach(fixtureName => {
      it(`should classify ${fixtureName} as app-service`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.service).toBe('app-service');
      });
    });
  });

  describe('Multi-Service (azd) Detection', () => {
    const azdFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'azd-multi-service')
      .map(([name]) => name);

    azdFixtures.forEach(fixtureName => {
      it(`should classify ${fixtureName} as azd-multi-service`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.service).toBe('azd-multi-service');
      });
    });
  });
});
