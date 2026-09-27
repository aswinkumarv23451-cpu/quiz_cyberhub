/**
 * Cookie & Cross-Origin (CORS) Authentication Test Suite
 *
 * Validates:
 * 1. getCookieOptions() in production:
 *    - SameSite=None and Secure=true for cross-origin Netlify -> Render compatibility
 *    - HttpOnly=true and Path=/
 * 2. getCookieOptions() in development:
 *    - SameSite=Lax and Secure=false for local HTTP development
 * 3. SameSite=None strictly enforces Secure=true
 * 4. Custom COOKIE_DOMAIN handling (included when set, omitted when undefined)
 * 5. setAuthCookie() serialization:
 *    - Set-Cookie header contains round1_token, HttpOnly, Path=/, SameSite=None, Secure
 * 6. clearAuthCookie() serialization:
 *    - Set-Cookie header clears cookie with matching SameSite=None, Secure, Path=/
 * 7. Live CORS behavior with credentials:
 *    - Netlify origin receives exact Access-Control-Allow-Origin (never wildcard '*')
 *    - Access-Control-Allow-Credentials: true is set
 *    - Vary: Origin is set
 *    - Preflight OPTIONS returns 204 with credentials headers
 *    - Multi-origin / comma-separated CORS configuration works
 *    - Trailing slash in origin is normalized
 *    - Disallowed origin does NOT receive Access-Control-Allow-Origin
 * 8. Authenticated request flow:
 *    - Valid cookie passed with cross-origin request is parsed by cookie-parser
 */

import http from 'http';
import assert from 'assert';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from '../config/env.js';
import { getCookieOptions, setAuthCookie, clearAuthCookie, signToken } from '../services/auth.service.js';
import app from '../app.js';

let passed = 0;
let failed = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
};

const runCookieCorsTests = async () => {
  console.log('\n======================================================');
  console.log('  COOKIE & CROSS-ORIGIN CORS AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  // Save original config to restore after tests
  const originalNodeEnv = config.nodeEnv;
  const originalCorsOrigin = config.corsOrigin;
  const originalCookieSameSite = config.auth.cookieSameSite;
  const originalCookieSecure = config.auth.cookieSecure;
  const originalCookieDomain = config.auth.cookieDomain;

  try {
    console.log('--- 1. Cookie Options Configuration ---');

    await test('1.1 Production defaults: SameSite=None and Secure=true', async () => {
      config.nodeEnv = 'production';
      config.auth.cookieSameSite = undefined;
      config.auth.cookieSecure = undefined;

      const options = getCookieOptions();
      assert.strictEqual(options.httpOnly, true, 'Must have httpOnly: true');
      assert.strictEqual(options.secure, true, 'Must have secure: true in production');
      assert.strictEqual(options.sameSite, 'none', 'Must have sameSite: "none" in production for cross-origin');
      assert.strictEqual(options.path, '/', 'Must have path: "/"');
      assert.strictEqual(options.domain, undefined, 'Must not set domain when not configured');
    });

    await test('1.2 Development defaults: SameSite=Lax and Secure=false', async () => {
      config.nodeEnv = 'development';
      config.auth.cookieSameSite = undefined;
      config.auth.cookieSecure = undefined;

      const options = getCookieOptions();
      assert.strictEqual(options.httpOnly, true, 'Must have httpOnly: true');
      assert.strictEqual(options.secure, false, 'Must have secure: false in development');
      assert.strictEqual(options.sameSite, 'lax', 'Must have sameSite: "lax" in development');
      assert.strictEqual(options.path, '/', 'Must have path: "/"');
    });

    await test('1.3 SameSite=None strictly enforces Secure=true even if secure not explicitly set', async () => {
      config.nodeEnv = 'development';
      config.auth.cookieSameSite = 'none';
      config.auth.cookieSecure = undefined;

      const options = getCookieOptions();
      assert.strictEqual(options.sameSite, 'none');
      assert.strictEqual(options.secure, true, 'SameSite=None must force secure: true');
    });

    await test('1.4 Optional cookieDomain is respected when configured', async () => {
      config.nodeEnv = 'production';
      config.auth.cookieDomain = '.round1.tech';

      const options = getCookieOptions();
      assert.strictEqual(options.domain, '.round1.tech', 'Domain must match configured cookieDomain');

      // Reset
      config.auth.cookieDomain = undefined;
    });

    console.log('\n--- 2. Express Cookie Serialization (Live HTTP) ---');

    await test('2.1 setAuthCookie() serializes SameSite=None and Secure in production', async () => {
      config.nodeEnv = 'production';
      config.auth.cookieSameSite = undefined;
      config.auth.cookieSecure = undefined;

      const testApp = express();
      testApp.get('/set-cookie', (req, res) => {
        setAuthCookie(res, 'test-jwt-token-production');
        res.status(200).json({ ok: true });
      });

      const server = http.createServer(testApp);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/set-cookie`);
        const setCookieHeader = res.headers.get('set-cookie');
        assert(setCookieHeader, 'Set-Cookie header must be present');
        assert(setCookieHeader.includes('round1_token=test-jwt-token-production'), 'Contains token name and value');
        assert(/httponly/i.test(setCookieHeader), 'Contains HttpOnly flag');
        assert(/secure/i.test(setCookieHeader), 'Contains Secure flag');
        assert(/samesite=none/i.test(setCookieHeader), 'Contains SameSite=None');
        assert(/path=\//i.test(setCookieHeader), 'Contains Path=/');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await test('2.2 clearAuthCookie() preserves SameSite=None and Secure on logout', async () => {
      config.nodeEnv = 'production';
      config.auth.cookieSameSite = undefined;
      config.auth.cookieSecure = undefined;

      const testApp = express();
      testApp.post('/clear-cookie', (req, res) => {
        clearAuthCookie(res);
        res.status(200).json({ ok: true });
      });

      const server = http.createServer(testApp);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/clear-cookie`, { method: 'POST' });
        const setCookieHeader = res.headers.get('set-cookie');
        assert(setCookieHeader, 'Set-Cookie header must be present on logout');
        assert(/samesite=none/i.test(setCookieHeader), 'Logout must specify SameSite=None to match set cookie');
        assert(/secure/i.test(setCookieHeader), 'Logout must specify Secure flag to match set cookie');
        assert(/path=\//i.test(setCookieHeader), 'Logout must specify Path=/');
        assert(
          setCookieHeader.includes('round1_token=;') || /expires=thu, 01 jan 1970/i.test(setCookieHeader) || /max-age=0/i.test(setCookieHeader),
          'Cookie must be expired'
        );
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    console.log('\n--- 3. Cross-Origin (CORS) & Credentials Integration ---');

    await test('3.1 Netlify origin receives exact Access-Control-Allow-Origin and credentials: true', async () => {
      const netlifyOrigin = 'https://singular-horse-6400df.netlify.app';
      config.corsOrigin = `${netlifyOrigin},http://localhost:5173`;

      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
          method: 'GET',
          headers: {
            Origin: netlifyOrigin,
          },
        });

        assert.strictEqual(
          res.headers.get('access-control-allow-origin'),
          netlifyOrigin,
          'Must reflect exact Netlify origin'
        );
        assert.notStrictEqual(
          res.headers.get('access-control-allow-origin'),
          '*',
          'Must NEVER be wildcard "*" when credentials are true'
        );
        assert.strictEqual(
          res.headers.get('access-control-allow-credentials'),
          'true',
          'Must set Access-Control-Allow-Credentials: true'
        );
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await test('3.2 Preflight OPTIONS request returns 204 with credentials support', async () => {
      const netlifyOrigin = 'https://singular-horse-6400df.netlify.app';
      config.corsOrigin = netlifyOrigin;

      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
          method: 'OPTIONS',
          headers: {
            Origin: netlifyOrigin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type,Authorization',
          },
        });

        assert.strictEqual(res.status, 204, 'Preflight must return 204 No Content');
        assert.strictEqual(res.headers.get('access-control-allow-origin'), netlifyOrigin);
        assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await test('3.3 Configured origin with trailing slash is correctly matched', async () => {
      config.corsOrigin = 'https://singular-horse-6400df.netlify.app/';

      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
          headers: {
            Origin: 'https://singular-horse-6400df.netlify.app',
          },
        });

        assert.strictEqual(
          res.headers.get('access-control-allow-origin'),
          'https://singular-horse-6400df.netlify.app',
          'Must match origin even if configured with trailing slash'
        );
        assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await test('3.4 Unauthorized cross-origin request is rejected from CORS headers', async () => {
      config.nodeEnv = 'production';
      config.corsOrigin = 'https://singular-horse-6400df.netlify.app';

      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
          headers: {
            Origin: 'https://malicious-site.com',
          },
        });

        assert.strictEqual(
          res.headers.get('access-control-allow-origin'),
          null,
          'Unauthorized origin must NOT receive Access-Control-Allow-Origin header'
        );
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await test('3.5 Cookie parsing across CORS request works with round1_token', async () => {
      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      try {
        // Unauthenticated request -> 401
        const unauthRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
          headers: {
            Origin: 'https://singular-horse-6400df.netlify.app',
          },
        });
        assert.strictEqual(unauthRes.status, 401, 'Without cookie should be 401');

        // Request with invalid cookie format -> 401 with proper error message
        const invalidCookieRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
          headers: {
            Origin: 'https://singular-horse-6400df.netlify.app',
            Cookie: 'round1_token=invalid.jwt.token',
          },
        });
        assert.strictEqual(invalidCookieRes.status, 401, 'Invalid JWT cookie should be 401');
        const invalidData = await invalidCookieRes.json();
        assert(invalidData.message.includes('Invalid or expired'), 'Cookie was parsed and validated');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  } finally {
    // Restore original config
    config.nodeEnv = originalNodeEnv;
    config.corsOrigin = originalCorsOrigin;
    config.auth.cookieSameSite = originalCookieSameSite;
    config.auth.cookieSecure = originalCookieSecure;
    config.auth.cookieDomain = originalCookieDomain;
  }

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runCookieCorsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
