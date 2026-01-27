/**
 * Tests for Express.js Production Validator
 */

const path = require('path');
const {
  checkTrustProxy,
  checkHealthEndpoint,
  checkCookieConfig,
  checkPortBinding,
  checkHostBinding
} = require('../src/validators/expressProductionValidator');

describe('Express Production Validator', () => {
  
  describe('checkTrustProxy', () => {
    test('passes when trust proxy is set with number', () => {
      const content = `
        const app = express();
        app.set('trust proxy', 1);
      `;
      const result = checkTrustProxy(content);
      expect(result.passed).toBe(true);
    });

    test('passes when trust proxy is set with true', () => {
      const content = `app.set("trust proxy", true);`;
      const result = checkTrustProxy(content);
      expect(result.passed).toBe(true);
    });

    test('passes when trust proxy is set to loopback', () => {
      const content = `app.set('trust proxy', 'loopback');`;
      const result = checkTrustProxy(content);
      expect(result.passed).toBe(true);
    });

    test('fails when trust proxy is missing', () => {
      const content = `
        const app = express();
        app.use(express.json());
        app.listen(3000);
      `;
      const result = checkTrustProxy(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain("trust proxy");
    });

    test('fails when only other settings are present', () => {
      const content = `
        app.set('view engine', 'ejs');
        app.set('port', 3000);
      `;
      const result = checkTrustProxy(content);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkHealthEndpoint', () => {
    test('passes when /health route exists', () => {
      const content = `
        app.get('/health', (req, res) => {
          res.status(200).send('OK');
        });
      `;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(true);
    });

    test('passes when /healthz route exists (k8s convention)', () => {
      const content = `app.get('/healthz', (req, res) => res.sendStatus(200));`;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(true);
    });

    test('passes when /ready route exists', () => {
      const content = `router.get('/ready', healthController.check);`;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(true);
    });

    test('passes when /liveness route exists', () => {
      const content = `app.get('/liveness', (req, res) => res.json({ status: 'ok' }));`;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(true);
    });

    test('fails when no health endpoint exists', () => {
      const content = `
        app.get('/', (req, res) => res.send('Hello'));
        app.get('/api/users', userController.list);
      `;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('/health');
    });

    test('fails with only similar but incorrect routes', () => {
      const content = `
        app.get('/healthy-recipes', recipeController.list);
        app.get('/api/health-data', dataController.get);
      `;
      const result = checkHealthEndpoint(content);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkCookieConfig', () => {
    test('passes when no cookies are used', () => {
      const content = `
        const app = express();
        app.get('/', (req, res) => res.send('Hello'));
      `;
      const result = checkCookieConfig(content);
      expect(result.passed).toBe(true);
    });

    test('passes when cookie config is secure', () => {
      const content = `
        app.use(session({
          cookie: {
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true
          }
        }));
      `;
      const result = checkCookieConfig(content);
      expect(result.passed).toBe(true);
    });

    test('passes with strict sameSite', () => {
      const content = `
        res.cookie('token', value, {
          sameSite: 'strict',
          secure: true
        });
      `;
      const result = checkCookieConfig(content);
      expect(result.passed).toBe(true);
    });

    test('warns when sameSite is missing', () => {
      const content = `
        app.use(session({
          cookie: {
            secure: true,
            httpOnly: true
          }
        }));
      `;
      const result = checkCookieConfig(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('sameSite');
    });

    test('warns when secure is missing', () => {
      const content = `
        res.cookie('session', data, {
          sameSite: 'lax',
          httpOnly: true
        });
      `;
      const result = checkCookieConfig(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('secure');
    });
  });

  describe('checkPortBinding', () => {
    test('passes with process.env.PORT fallback', () => {
      const content = `
        const port = process.env.PORT || 3000;
        app.listen(port);
      `;
      const result = checkPortBinding(content);
      expect(result.passed).toBe(true);
    });

    test('passes with PORT in listen call', () => {
      const content = `app.listen(process.env.PORT || 8080);`;
      const result = checkPortBinding(content);
      expect(result.passed).toBe(true);
    });

    test('passes with direct PORT assignment', () => {
      const content = `
        const port = PORT || 3000;
        server.listen(port);
      `;
      const result = checkPortBinding(content);
      expect(result.passed).toBe(true);
    });

    test('fails with hardcoded port', () => {
      const content = `app.listen(3000);`;
      const result = checkPortBinding(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Hardcoded');
    });

    test('fails with hardcoded port 8080', () => {
      const content = `server.listen(8080, () => console.log('Running'));`;
      const result = checkPortBinding(content);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkHostBinding', () => {
    test('passes with 0.0.0.0 binding', () => {
      const content = `app.listen(port, '0.0.0.0', callback);`;
      const result = checkHostBinding(content);
      expect(result.passed).toBe(true);
    });

    test('passes with no explicit host (default)', () => {
      const content = `app.listen(port, callback);`;
      const result = checkHostBinding(content);
      expect(result.passed).toBe(true);
    });

    test('warns when binding to localhost', () => {
      const content = `app.listen(3000, 'localhost', callback);`;
      const result = checkHostBinding(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('localhost');
    });

    test('warns when binding to 127.0.0.1', () => {
      const content = `server.listen(port, '127.0.0.1');`;
      const result = checkHostBinding(content);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('0.0.0.0');
    });
  });
});
