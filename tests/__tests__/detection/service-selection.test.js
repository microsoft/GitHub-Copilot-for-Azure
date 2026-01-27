/**
 * Service Selection Tests (Fixture-based)
 * 
 * Tests that iterate over project fixtures and validate
 * detection against expected results in expectations.json
 */

const { detectProject, normalizeResult } = require('../../utils/project-scanner');
const { 
  listProjectFixtures, 
  getProjectPath, 
  loadExpectations,
  validateFixturesHaveExpectations 
} = require('../../utils/fixture-loader');

describe('Azure Deploy - Service Selection (Fixtures)', () => {
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
        const normalized = normalizeResult(result);

        expect(normalized.service).toBe(expected.service);
      });
    });
  });

  // Group tests by Azure service type
  describe('Static Web Apps Detection', () => {
    const swaFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'static-web-apps')
      .map(([name]) => name);

    swaFixtures.forEach(fixtureName => {
      if (!fixtures.includes(fixtureName)) return;
      
      it(`should classify ${fixtureName} as static-web-apps`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        const normalized = normalizeResult(result);
        expect(normalized.service).toBe('static-web-apps');
      });
    });
  });

  describe('Azure Functions Detection', () => {
    const functionsFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'functions')
      .map(([name]) => name);

    functionsFixtures.forEach(fixtureName => {
      if (!fixtures.includes(fixtureName)) return;
      
      it(`should classify ${fixtureName} as functions`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        const normalized = normalizeResult(result);
        expect(normalized.service).toBe('functions');
      });
    });
  });

  describe('Container Apps Detection', () => {
    const containerFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'container-apps')
      .map(([name]) => name);

    containerFixtures.forEach(fixtureName => {
      if (!fixtures.includes(fixtureName)) return;
      
      it(`should classify ${fixtureName} as container-apps`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        const normalized = normalizeResult(result);
        expect(normalized.service).toBe('container-apps');
      });
    });
  });

  describe('App Service Detection', () => {
    const appServiceFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'app-service')
      .map(([name]) => name);

    appServiceFixtures.forEach(fixtureName => {
      if (!fixtures.includes(fixtureName)) return;
      
      it(`should classify ${fixtureName} as app-service`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        const normalized = normalizeResult(result);
        expect(normalized.service).toBe('app-service');
      });
    });
  });

  describe('Multi-Service (azd) Detection', () => {
    const azdFixtures = Object.entries(expectations)
      .filter(([_, exp]) => exp.service === 'azd')
      .map(([name]) => name);

    azdFixtures.forEach(fixtureName => {
      if (!fixtures.includes(fixtureName)) return;
      
      it(`should classify ${fixtureName} as azd`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        const normalized = normalizeResult(result);
        expect(normalized.service).toBe('azd');
      });
    });
  });

  // Confidence level tests
  describe('Confidence Assessment', () => {
    fixtures.forEach(fixtureName => {
      const expected = expectations[fixtureName];
      if (!expected) return;

      it(`should assess ${fixtureName} with ${expected.confidence} confidence`, () => {
        const projectPath = getProjectPath(fixtureName);
        const result = detectProject(projectPath);
        expect(result.confidence).toBe(expected.confidence);
      });
    });
  });

  // Framework detection tests (where applicable)
  describe('Framework Detection', () => {
    const fixturesWithFramework = Object.entries(expectations)
      .filter(([_, exp]) => exp.framework)
      .map(([name, exp]) => ({ name, expectedFramework: exp.framework }));

    fixturesWithFramework.forEach(({ name, expectedFramework }) => {
      if (!fixtures.includes(name)) return;

      it(`should detect ${name} framework as ${expectedFramework}`, () => {
        const projectPath = getProjectPath(name);
        const result = detectProject(projectPath);
        expect(result.framework).toBe(expectedFramework);
      });
    });
  });
});
