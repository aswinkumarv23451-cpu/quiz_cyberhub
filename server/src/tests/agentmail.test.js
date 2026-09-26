import assert from 'assert';
import { config } from '../config/env.js';
import { isEmailConfigured, sendOtpEmail } from '../services/email.service.js';

/**
 * Unit Test Suite for AgentMail Integration
 */
async function runAgentMailTests() {
  console.log('\n=== AgentMail Integration Test Suite ===\n');

  const origProvider = config.email.provider;
  const origAgentMailKey = config.email.agentmailApiKey;
  const origInboxId = config.email.agentmailInboxId;
  const origResendKey = config.email.resendApiKey;
  const origFetch = global.fetch;

  let testsPassed = 0;
  let testsFailed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      testsPassed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      testsFailed++;
    }
  };

  try {
    // --------------------------------------------------------------------------
    // Test 1: isEmailConfigured validates AGENTMAIL_API_KEY
    // --------------------------------------------------------------------------
    await test('1. isEmailConfigured returns false when agentmailApiKey is missing', () => {
      config.email.provider = 'agentmail';
      config.email.agentmailApiKey = '';
      config.nodeEnv = 'production';
      assert.strictEqual(isEmailConfigured(), false);
    });

    await test('2. isEmailConfigured returns true when agentmailApiKey is present', () => {
      config.email.provider = 'agentmail';
      config.email.agentmailApiKey = 'am_test_key_12345';
      config.nodeEnv = 'production';
      assert.strictEqual(isEmailConfigured(), true);
    });

    // --------------------------------------------------------------------------
    // Test 3: AgentMail HTTPS dispatch constructs proper URL and payload
    // --------------------------------------------------------------------------
    await test('3. sendOtpEmail dispatches POST to AgentMail API with correct headers and payload', async () => {
      config.email.provider = 'agentmail';
      config.email.agentmailApiKey = 'am_live_test_dummy_key';
      config.email.agentmailInboxId = 'test-inbox@agentmail.to';
      config.nodeEnv = 'production';

      let capturedUrl = null;
      let capturedOptions = null;

      global.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'msg_agentmail_abc123' }),
        };
      };

      const result = await sendOtpEmail({
        to: 'participant@example.com',
        otp: '849201',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 'msg_agentmail_abc123');

      // Verify endpoint format
      assert.strictEqual(
        capturedUrl,
        'https://api.agentmail.to/v0/inboxes/test-inbox%40agentmail.to/messages/send'
      );
      assert.strictEqual(capturedOptions.method, 'POST');

      // Verify Authorization Bearer
      assert.strictEqual(
        capturedOptions.headers.Authorization,
        'Bearer am_live_test_dummy_key'
      );
      assert.strictEqual(
        capturedOptions.headers['Content-Type'],
        'application/json'
      );

      // Verify payload
      const body = JSON.parse(capturedOptions.body);
      assert.deepStrictEqual(body.to, ['participant@example.com']);
      assert(body.subject.includes('Round 1'));
      assert(body.text.includes('849201'));
      assert(body.html.includes('849201'));
    });

    // --------------------------------------------------------------------------
    // Test 4: Default inbox fallback when AGENTMAIL_INBOX_ID is not provided
    // --------------------------------------------------------------------------
    await test('4. Falls back to fromAddress or default when agentmailInboxId is empty', async () => {
      config.email.provider = 'agentmail';
      config.email.agentmailApiKey = 'am_live_key';
      config.email.agentmailInboxId = '';
      config.email.fromAddress = 'noreply@round1.tech';
      config.nodeEnv = 'production';

      let capturedUrl = null;
      global.fetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'msg_default_inbox' }),
        };
      };

      await sendOtpEmail({
        to: 'user@example.com',
        otp: '654321',
      });

      assert(capturedUrl.includes('/inboxes/noreply%40round1.tech/messages/send'));
    });

    // --------------------------------------------------------------------------
    // Test 5: AgentMail API error handling
    // --------------------------------------------------------------------------
    await test('5. Rejects with error message when AgentMail returns non-200', async () => {
      config.email.provider = 'agentmail';
      config.email.agentmailApiKey = 'am_error_key';
      config.email.agentmailInboxId = 'inbox-1';
      config.nodeEnv = 'production';

      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key provided' }),
      });

      let threw = false;
      try {
        await sendOtpEmail({ to: 'user@example.com', otp: '111222' });
      } catch (err) {
        threw = true;
        assert(err.message.includes('AgentMail delivery failed'));
        assert(err.message.includes('Invalid API key'));
      }
      assert.strictEqual(threw, true, 'Expected sendOtpEmail to throw on 401 error');
    });

    // --------------------------------------------------------------------------
    // Test 6: Fallback to Resend when provider is resend
    // --------------------------------------------------------------------------
    await test('6. Routes to Resend when EMAIL_PROVIDER=resend even if AGENTMAIL_API_KEY is present', async () => {
      config.email.provider = 'resend';
      config.email.agentmailApiKey = 'am_key';
      config.email.resendApiKey = 're_key_123';
      config.nodeEnv = 'production';

      let capturedUrl = null;
      global.fetch = async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 're_msg_123' }),
        };
      };

      const result = await sendOtpEmail({ to: 'resend@test.com', otp: '333444' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(capturedUrl, 'https://api.resend.com/emails');
    });

    // --------------------------------------------------------------------------
    // Test 7: In-memory test mailbox isolation
    // --------------------------------------------------------------------------
    await test('7. Respects test provider and NODE_ENV=test isolation', async () => {
      config.email.provider = 'test';
      config.nodeEnv = 'test';

      const result = await sendOtpEmail({ to: 'test@mailbox.com', otp: '999888' });
      assert.strictEqual(result.success, true);
      assert(result.messageId.startsWith('test-'));
    });

  } finally {
    config.email.provider = origProvider;
    config.email.agentmailApiKey = origAgentMailKey;
    config.email.agentmailInboxId = origInboxId;
    config.email.resendApiKey = origResendKey;
    global.fetch = origFetch;
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('----------------------------------------\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAgentMailTests();
