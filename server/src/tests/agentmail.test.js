import assert from 'assert';
import { config } from '../config/env.js';
import { isEmailConfigured, sendOtpEmail } from '../services/email.service.js';

/**
 * Unit Test Suite for AgentMail Integration
 *
 * Covers:
 *  1-2.  isEmailConfigured gate
 *  3.    Happy-path dispatch (URL, headers, payload)
 *  4.    Inbox ID fallback
 *  5.    Generic non-2xx handling (401)
 *  6.    HTTP 400 — Bad Request (validation error shape)
 *  7.    HTTP 403 — Forbidden (e.g. inbox not owned)
 *  8.    HTTP 404 — Inbox not found
 *  9.    HTTP 429 — Rate Limited
 * 10.    Non-JSON response body (agentmailDetail.rawBody captured)
 * 11.    Network-level failure
 * 12.    Error carries agentmailStatus property on all HTTP errors
 * 13.    Resend provider routing
 * 14.    In-memory test mailbox isolation
 */

// ---------------------------------------------------------------------------
// Helper: build a mock fetch response using .text() (matches updated service)
// ---------------------------------------------------------------------------
const mockFetch = (status, bodyObj, isJson = true) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (isJson ? JSON.stringify(bodyObj) : String(bodyObj)),
});

async function runAgentMailTests() {
  console.log('\n=== AgentMail Integration Test Suite ===\n');

  const origProvider       = config.email.provider;
  const origAgentMailKey   = config.email.agentmailApiKey;
  const origInboxId        = config.email.agentmailInboxId;
  const origResendKey      = config.email.resendApiKey;
  const origFromAddress    = config.email.fromAddress;
  const origFetch          = global.fetch;

  let testsPassed = 0;
  let testsFailed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  \u2713 ${name}`);
      testsPassed++;
    } catch (err) {
      console.error(`  \u2717 ${name}`);
      console.error(`    Error: ${err.message}`);
      testsFailed++;
    }
  };

  // Helper: configure agentmail as the active provider
  const useAgentMail = (apiKey = 'am_live_key', inboxId = 'inbox-test') => {
    config.email.provider        = 'agentmail';
    config.email.agentmailApiKey  = apiKey;
    config.email.agentmailInboxId = inboxId;
    config.nodeEnv               = 'production';
  };

  try {
    // ------------------------------------------------------------------------
    // 1. isEmailConfigured — missing key
    // ------------------------------------------------------------------------
    await test('1. isEmailConfigured returns false when agentmailApiKey is missing', () => {
      config.email.provider        = 'agentmail';
      config.email.agentmailApiKey  = '';
      config.nodeEnv               = 'production';
      assert.strictEqual(isEmailConfigured(), false);
    });

    // ------------------------------------------------------------------------
    // 2. isEmailConfigured — key present
    // ------------------------------------------------------------------------
    await test('2. isEmailConfigured returns true when agentmailApiKey is present', () => {
      config.email.provider        = 'agentmail';
      config.email.agentmailApiKey  = 'am_test_key_12345';
      config.nodeEnv               = 'production';
      assert.strictEqual(isEmailConfigured(), true);
    });

    // ------------------------------------------------------------------------
    // 3. Happy path — URL, headers, payload verified
    // ------------------------------------------------------------------------
    await test('3. sendOtpEmail dispatches POST to AgentMail API with correct headers and payload', async () => {
      useAgentMail('am_live_test_dummy_key', 'test-inbox@agentmail.to');

      let capturedUrl     = null;
      let capturedOptions = null;

      global.fetch = async (url, options) => {
        capturedUrl     = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'msg_agentmail_abc123' }),
        };
      };

      const result = await sendOtpEmail({ to: 'participant@example.com', otp: '849201' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 'msg_agentmail_abc123');

      assert.strictEqual(
        capturedUrl,
        'https://api.agentmail.to/v0/inboxes/test-inbox%40agentmail.to/messages/send'
      );
      assert.strictEqual(capturedOptions.method, 'POST');
      assert.strictEqual(capturedOptions.headers.Authorization, 'Bearer am_live_test_dummy_key');
      assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');

      const body = JSON.parse(capturedOptions.body);
      assert.deepStrictEqual(body.to, ['participant@example.com']);
      assert(body.subject.includes('Round 1'));
      assert(body.text.includes('849201'));
      assert(body.html.includes('849201'));
    });

    // ------------------------------------------------------------------------
    // 4. Inbox-ID fallback to fromAddress
    // ------------------------------------------------------------------------
    await test('4. Falls back to fromAddress when agentmailInboxId is empty', async () => {
      config.email.provider        = 'agentmail';
      config.email.agentmailApiKey  = 'am_live_key';
      config.email.agentmailInboxId = '';
      config.email.fromAddress     = 'noreply@round1.tech';
      config.nodeEnv               = 'production';

      let capturedUrl = null;
      global.fetch = async (url) => {
        capturedUrl = url;
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'msg_default_inbox' }) };
      };

      await sendOtpEmail({ to: 'user@example.com', otp: '654321' });
      assert(capturedUrl.includes('/inboxes/noreply%40round1.tech/messages/send'));
    });

    // ------------------------------------------------------------------------
    // 5. Generic non-2xx (401) — message field captured
    // ------------------------------------------------------------------------
    await test('5. Throws with HTTP status and message on AgentMail 401', async () => {
      useAgentMail('am_error_key', 'inbox-1');
      global.fetch = mockFetch(401, { message: 'Invalid API key provided' });

      let threw = false;
      try {
        await sendOtpEmail({ to: 'user@example.com', otp: '111222' });
      } catch (err) {
        threw = true;
        assert(err.message.includes('AgentMail delivery failed'));
        assert(err.message.includes('401'));
        assert(err.message.includes('Invalid API key'));
        assert.strictEqual(err.agentmailStatus, 401);
        assert.strictEqual(err.agentmailDetail.httpStatus, 401);
        assert.strictEqual(err.agentmailDetail.agentmailMessage, 'Invalid API key provided');
      }
      assert.strictEqual(threw, true, 'Expected sendOtpEmail to throw on 401 error');
    });

    // ------------------------------------------------------------------------
    // 6. HTTP 400 — Bad Request with errors array and code
    // ------------------------------------------------------------------------
    await test('6. HTTP 400 — captures errors array and agentmailCode in diagnostic detail', async () => {
      useAgentMail('am_key_400', 'inbox-400');
      global.fetch = mockFetch(400, {
        error: 'Bad Request',
        errors: ['Field "to" must be a valid email address', 'Field "subject" is required'],
        code: 'VALIDATION_ERROR',
      });

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'badrequest@example.com', otp: '400400' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error to be thrown for HTTP 400');
      assert.strictEqual(caughtErr.agentmailStatus, 400);
      assert.strictEqual(caughtErr.agentmailDetail.httpStatus, 400);
      assert.strictEqual(caughtErr.agentmailDetail.agentmailError, 'Bad Request');
      assert.strictEqual(caughtErr.agentmailDetail.agentmailCode, 'VALIDATION_ERROR');
      assert(Array.isArray(caughtErr.agentmailDetail.agentmailErrors));
      assert.strictEqual(caughtErr.agentmailDetail.agentmailErrors.length, 2);
      assert(caughtErr.message.includes('400'));
    });

    // ------------------------------------------------------------------------
    // 7. HTTP 403 — Forbidden (inbox not owned / plan restriction)
    // ------------------------------------------------------------------------
    await test('7. HTTP 403 — captures forbidden detail and agentmailCode', async () => {
      useAgentMail('am_key_403', 'inbox-403');
      global.fetch = mockFetch(403, {
        error: 'Forbidden',
        detail: 'You do not have permission to send from this inbox',
        code: 'INBOX_ACCESS_DENIED',
      });

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'forbidden@example.com', otp: '403403' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error to be thrown for HTTP 403');
      assert.strictEqual(caughtErr.agentmailStatus, 403);
      assert.strictEqual(caughtErr.agentmailDetail.httpStatus, 403);
      assert.strictEqual(caughtErr.agentmailDetail.agentmailError, 'Forbidden');
      assert.strictEqual(
        caughtErr.agentmailDetail.agentmailDetail,
        'You do not have permission to send from this inbox'
      );
      assert.strictEqual(caughtErr.agentmailDetail.agentmailCode, 'INBOX_ACCESS_DENIED');
      assert(caughtErr.message.includes('403'));
    });

    // ------------------------------------------------------------------------
    // 8. HTTP 404 — Inbox not found (inboxId visible in Render logs)
    // ------------------------------------------------------------------------
    await test('8. HTTP 404 — captures not-found detail with inboxId for fast debugging', async () => {
      useAgentMail('am_key_404', 'nonexistent-inbox@agentmail.to');
      global.fetch = mockFetch(404, { message: 'Inbox not found', code: 'INBOX_NOT_FOUND' });

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'notfound@example.com', otp: '404404' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error to be thrown for HTTP 404');
      assert.strictEqual(caughtErr.agentmailStatus, 404);
      assert.strictEqual(caughtErr.agentmailDetail.httpStatus, 404);
      assert.strictEqual(caughtErr.agentmailDetail.agentmailMessage, 'Inbox not found');
      assert.strictEqual(caughtErr.agentmailDetail.agentmailCode, 'INBOX_NOT_FOUND');
      // inboxId must appear so Render logs identify the misconfigured env var
      assert(caughtErr.agentmailDetail.inboxId.includes('nonexistent-inbox'));
      assert(caughtErr.message.includes('404'));
    });

    // ------------------------------------------------------------------------
    // 9. HTTP 429 — Rate Limited
    // ------------------------------------------------------------------------
    await test('9. HTTP 429 — captures rate-limit error for Render log visibility', async () => {
      useAgentMail('am_key_429', 'inbox-429');
      global.fetch = mockFetch(429, {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Retry after 60 seconds.',
        code: 'RATE_LIMIT_EXCEEDED',
      });

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'ratelimited@example.com', otp: '429429' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error to be thrown for HTTP 429');
      assert.strictEqual(caughtErr.agentmailStatus, 429);
      assert.strictEqual(caughtErr.agentmailDetail.httpStatus, 429);
      assert.strictEqual(caughtErr.agentmailDetail.agentmailError, 'Too Many Requests');
      assert.strictEqual(
        caughtErr.agentmailDetail.agentmailMessage,
        'Rate limit exceeded. Retry after 60 seconds.'
      );
      assert.strictEqual(caughtErr.agentmailDetail.agentmailCode, 'RATE_LIMIT_EXCEEDED');
      assert(caughtErr.message.includes('429'));
    });

    // ------------------------------------------------------------------------
    // 10. Non-JSON body — rawBody captured for opaque 5xx gateway pages
    // ------------------------------------------------------------------------
    await test('10. Non-JSON body is captured in rawBody (<=500 chars) for server logging', async () => {
      useAgentMail('am_key_5xx', 'inbox-5xx');
      global.fetch = mockFetch(503, '<html>Service Unavailable</html>', false);

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'opaque@example.com', otp: '503503' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error for 503 response');
      assert.strictEqual(caughtErr.agentmailStatus, 503);
      assert('rawBody' in caughtErr.agentmailDetail, 'rawBody should be present for non-JSON body');
      assert(caughtErr.agentmailDetail.rawBody.includes('Service Unavailable'));
    });

    // ------------------------------------------------------------------------
    // 11. Network-level failure (fetch throws before HTTP response)
    // ------------------------------------------------------------------------
    await test('11. Network error is caught and rethrown with safe message', async () => {
      useAgentMail('am_key_net', 'inbox-net');
      global.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND api.agentmail.to'); };

      let caughtErr = null;
      try {
        await sendOtpEmail({ to: 'net@example.com', otp: '000111' });
      } catch (err) {
        caughtErr = err;
      }

      assert(caughtErr !== null, 'Expected error for network failure');
      assert(caughtErr.message.includes('AgentMail delivery failed'));
      assert(caughtErr.message.includes('network error'));
    });

    // ------------------------------------------------------------------------
    // 12. Error carries agentmailStatus on all HTTP error status codes
    // ------------------------------------------------------------------------
    await test('12. Thrown error always carries numeric agentmailStatus property', async () => {
      for (const status of [400, 403, 404, 429, 500]) {
        useAgentMail('am_key_status_check', 'inbox-status');
        global.fetch = mockFetch(status, { message: `error for ${status}` });

        let caughtErr = null;
        try {
          await sendOtpEmail({ to: 'status@example.com', otp: '123456' });
        } catch (err) {
          caughtErr = err;
        }

        assert(caughtErr !== null, `Expected error for HTTP ${status}`);
        assert.strictEqual(
          caughtErr.agentmailStatus,
          status,
          `agentmailStatus should be ${status}`
        );
      }
    });

    // ------------------------------------------------------------------------
    // 13. Resend routing takes precedence when EMAIL_PROVIDER=resend
    // ------------------------------------------------------------------------
    await test('13. Routes to Resend when EMAIL_PROVIDER=resend even if AGENTMAIL_API_KEY is present', async () => {
      config.email.provider        = 'resend';
      config.email.agentmailApiKey  = 'am_key';
      config.email.resendApiKey    = 're_key_123';
      config.nodeEnv               = 'production';

      let capturedUrl = null;
      global.fetch = async (url) => {
        capturedUrl = url;
        // Resend branch calls .json() not .text()
        return { ok: true, status: 200, json: async () => ({ id: 're_msg_123' }) };
      };

      const result = await sendOtpEmail({ to: 'resend@test.com', otp: '333444' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(capturedUrl, 'https://api.resend.com/emails');
    });

    // ------------------------------------------------------------------------
    // 14. In-memory test mailbox isolation
    // ------------------------------------------------------------------------
    await test('14. Respects test provider and NODE_ENV=test isolation', async () => {
      config.email.provider = 'test';
      config.nodeEnv        = 'test';

      const result = await sendOtpEmail({ to: 'test@mailbox.com', otp: '999888' });
      assert.strictEqual(result.success, true);
      assert(result.messageId.startsWith('test-'));
    });

  } finally {
    config.email.provider        = origProvider;
    config.email.agentmailApiKey  = origAgentMailKey;
    config.email.agentmailInboxId = origInboxId;
    config.email.resendApiKey    = origResendKey;
    config.email.fromAddress     = origFromAddress;
    global.fetch                 = origFetch;
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('----------------------------------------\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAgentMailTests();
