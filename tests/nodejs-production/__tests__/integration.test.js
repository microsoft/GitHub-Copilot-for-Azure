/**
 * Integration tests using fixtures
 * 
 * Tests the validators against real project fixtures with expected results
 */

const path = require('path');
const fs = require('fs');
const { validateExpressApp } = require('../src/validators/expressProductionValidator');
const { validateDockerfile } = require('../src/validators/dockerfileValidator');

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'projects');
const expectationsPath = path.join(__dirname, '..', 'fixtures', 'expectations.json');

// Load expectations
const expectations = JSON.parse(fs.readFileSync(expectationsPath, 'utf8'));

describe('Fixture-based Integration Tests', () => {
  
  // Get all fixture directories
  const fixtures = fs.readdirSync(fixturesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  describe('Express Validation', () => {
    fixtures.forEach(fixtureName => {
      const expected = expectations[fixtureName];
      if (!expected || !expected.express) return;

      describe(fixtureName, () => {
        const projectDir = path.join(fixturesDir, fixtureName);
        let result;

        beforeAll(() => {
          result = validateExpressApp(projectDir);
        });

        test(`should ${expected.express.valid ? 'pass' : 'fail'} validation`, () => {
          expect(result.valid).toBe(expected.express.valid);
        });

        if (expected.express.errors && expected.express.errors.length > 0) {
          test('should have expected errors', () => {
            expected.express.errors.forEach(errorSubstring => {
              const hasError = result.errors.some(e => e.includes(errorSubstring));
              expect(hasError).toBe(true);
            });
          });
        }

        if (expected.express.warnings && expected.express.warnings.length > 0) {
          test('should have expected warnings', () => {
            expected.express.warnings.forEach(warningSubstring => {
              const hasWarning = result.warnings.some(w => w.includes(warningSubstring));
              expect(hasWarning).toBe(true);
            });
          });
        }

        if (expected.express.checks) {
          Object.entries(expected.express.checks).forEach(([checkName, shouldPass]) => {
            test(`check: ${checkName} should ${shouldPass ? 'pass' : 'fail'}`, () => {
              expect(result.checks[checkName].passed).toBe(shouldPass);
            });
          });
        }
      });
    });
  });

  describe('Dockerfile Validation', () => {
    fixtures.forEach(fixtureName => {
      const expected = expectations[fixtureName];
      if (!expected || !expected.dockerfile) return;

      describe(fixtureName, () => {
        const projectDir = path.join(fixturesDir, fixtureName);
        let result;

        beforeAll(() => {
          result = validateDockerfile(projectDir);
        });

        test(`should ${expected.dockerfile.valid ? 'pass' : 'fail'} validation`, () => {
          expect(result.valid).toBe(expected.dockerfile.valid);
        });

        if (expected.dockerfile.errors && expected.dockerfile.errors.length > 0) {
          test('should have expected errors', () => {
            expected.dockerfile.errors.forEach(errorSubstring => {
              const hasError = result.errors.some(e => e.includes(errorSubstring));
              expect(hasError).toBe(true);
            });
          });
        }

        if (expected.dockerfile.warnings && expected.dockerfile.warnings.length > 0) {
          test('should have expected warnings', () => {
            expected.dockerfile.warnings.forEach(warningSubstring => {
              const hasWarning = result.warnings.some(w => w.includes(warningSubstring));
              expect(hasWarning).toBe(true);
            });
          });
        }

        if (expected.dockerfile.checks) {
          Object.entries(expected.dockerfile.checks).forEach(([checkName, shouldPass]) => {
            test(`check: ${checkName} should ${shouldPass ? 'pass' : 'fail'}`, () => {
              expect(result.checks[checkName].passed).toBe(shouldPass);
            });
          });
        }
      });
    });
  });
});
