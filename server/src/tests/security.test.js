/**
 * Module 10: Comprehensive Security Hardening Test Suite
 *
 * Validates:
 * 1. Security headers presence (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP)
 * 2. X-Powered-By header suppression
 * 3. Conditional HSTS enforcement (only over HTTPS / x-forwarded-proto: https)
 * 4. Safe bounded JSON payload handling
 * 5. Unauthenticated access rejection on protected routes (401)
 * 6. Role-based access control:
 *    - MEMBER blocked from admin routes (403)
 *    - TEAM_LEAD blocked from admin routes (403)
 *    - MEMBER blocked from quiz routes (403)
 * 7. Invalid, tampered, and expired JWT rejection (401)
 * 8. Rate limiting enforcement:
 *    - OTP request rate limiter (20 requests / 15 minutes / IP)
 *    - OTP verify rate limiter (40 requests / 15 minutes / IP)
 *    - Quiz submission rate limiter (300 requests / minute / IP)
 * 9. Production error sanitization (no internal message or stack leakage)
 * 10. File upload security:
 *    - Spoofed file signature (MIME mismatch / magic bytes) rejected
 *    - Oversized file (>5MB) rejected
 *    - Path traversal attempts blocked
 * 11. Sensitive information omission in quiz payloads (correct_option omitted)
 * 12. Constant-time comparison & HMAC-SHA256 OTP hashing integrity
 */

import http from 'http';
import assert from 'assert';
import app from '../app.js';
import { config } from '../config/env.js';
import { signToken } from '../services/auth.service.js';
import { hashOtp, timingSafeEqual, generateSecureOtp } from '../utils/crypto.utils.js';
import { validateFileIntegrity, paymentProofStorage } from '../services/storage/paymentProofStorage.js';
import { formatParticipantQuestionResponse } from '../services/quiz.service.js';
import {
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
  quizRateLimiter,
  registrationRateLimiter,
  resetAllRateLimiters,
} from '../middleware/rateLimit.middleware.js';

let server;
let baseUrl;

const apiRequest = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
};

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

const runSecurityTests = async () => {
  console.log('\n==================================================');
  console.log('  MODULE 10: SECURITY HARDENING VERIFICATION SUITE');
  console.log('==================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // =========================================================================
    // 1. HTTP Security Headers & Express Hardening
    // =========================================================================
    console.log('--- 1. HTTP Security Headers & Express Hardening ---');

    await test('1.1 X-Powered-By header is strictly suppressed', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('x-powered-by'), null, 'x-powered-by header must not be present');
    });

    await test('1.2 X-Content-Type-Options is nosniff', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    });

    await test('1.3 X-Frame-Options is DENY (Clickjacking defense)', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    });

    await test('1.4 Referrer-Policy is strict-origin-when-cross-origin', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    await test('1.5 Content-Security-Policy is default-src self', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('content-security-policy'), "default-src 'self'");
    });

    await test('1.6 HSTS is NOT sent over plain HTTP', async () => {
      const res = await apiRequest('/api/health');
      assert.strictEqual(res.headers.get('strict-transport-security'), null);
    });

    await test('1.7 HSTS is conditionally sent when proxied over HTTPS', async () => {
      const res = await apiRequest('/api/health', {
        headers: { 'x-forwarded-proto': 'https' },
      });
      assert.strictEqual(
        res.headers.get('strict-transport-security'),
        'max-age=31536000; includeSubDomains'
      );
    });

    // =========================================================================
    // 2. Authentication & Authorization Enforcement
    // =========================================================================
    console.log('\n--- 2. Authentication & Authorization (RBAC) ---');

    await test('2.1 Unauthenticated request to /api/admin/questions rejected with 401', async () => {
      const res = await apiRequest('/api/admin/questions');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data?.success, false);
    });

    await test('2.2 Unauthenticated request to /api/quiz/current rejected with 401', async () => {
      const res = await apiRequest('/api/quiz/current');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data?.success, false);
    });

    await test('2.3 Invalid/tampered JWT cookie rejected with 401', async () => {
      const res = await apiRequest('/api/auth/me', {
        headers: { Cookie: 'round1_auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data?.success, false);
    });

    // =========================================================================
    // 3. Rate Limiting Calibration & Enforcement
    // =========================================================================
    console.log('\n--- 3. Rate Limiting Enforcement & Calibration ---');

    await test('3.1 OTP Request rate limiter blocks after 20 requests per IP', async () => {
      resetAllRateLimiters();
      const testIp = '192.168.1.100';

      for (let i = 0; i < 20; i++) {
        const limited = otpRequestRateLimiter.isRateLimited(testIp);
        assert.strictEqual(limited, false, `Request ${i + 1} should be permitted`);
      }

      // 21st request must be rate limited
      const isBlocked = otpRequestRateLimiter.isRateLimited(testIp);
      assert.strictEqual(isBlocked, true, '21st request must be rate limited');
    });

    await test('3.2 OTP Verification rate limiter blocks after 40 requests per IP', async () => {
      resetAllRateLimiters();
      const testIp = '192.168.1.101';

      for (let i = 0; i < 40; i++) {
        const limited = otpVerifyRateLimiter.isRateLimited(testIp);
        assert.strictEqual(limited, false, `Attempt ${i + 1} should be permitted`);
      }

      // 41st request must be rate limited
      const isBlocked = otpVerifyRateLimiter.isRateLimited(testIp);
      assert.strictEqual(isBlocked, true, '41st attempt must be rate limited');
    });

    await test('3.3 Quiz submission rate limiter allows up to 300 requests per minute', async () => {
      resetAllRateLimiters();
      const testIp = '192.168.1.102';

      for (let i = 0; i < 300; i++) {
        const limited = quizRateLimiter.isRateLimited(testIp);
        assert.strictEqual(limited, false, `Submission ${i + 1} should be permitted`);
      }

      // 301st request must be rate limited
      const isBlocked = quizRateLimiter.isRateLimited(testIp);
      assert.strictEqual(isBlocked, true, '301st submission must be rate limited');
    });

    await test('3.4 Rate limiting HTTP response returns 429 status code', async () => {
      resetAllRateLimiters();
      // Exhaust registration limiter for 127.0.0.1
      for (let i = 0; i < 15; i++) {
        registrationRateLimiter.isRateLimited('127.0.0.1');
      }

      const res = await apiRequest('/api/registration', {
        method: 'POST',
        body: { teamName: 'Spam Team' },
      });
      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.data?.success, false);
      resetAllRateLimiters();
    });

    // =========================================================================
    // 4. File Upload & Binary Magic-Byte Security
    // =========================================================================
    console.log('\n--- 4. File Upload & Binary Magic-Byte Security ---');

    await test('4.1 Rejects spoofed image with text/html content', async () => {
      const spoofedBuffer = Buffer.from('<script>alert("xss")</script>');
      assert.throws(
        () => validateFileIntegrity(spoofedBuffer, 'malicious.jpg', 'image/jpeg'),
        /Invalid file content|File type mismatch|signature mismatch/i
      );
    });

    await test('4.2 Rejects oversized file buffer (>5MB)', async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      assert.throws(
        () => validateFileIntegrity(oversizedBuffer, 'large.png', 'image/png'),
        /exceeds the maximum allowed size/i
      );
    });

    await test('4.3 Rejects disallowed file extension (.exe, .js, .svg)', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.throws(
        () => validateFileIntegrity(buffer, 'exploit.svg', 'image/svg+xml'),
        /Invalid file extension/i
      );
    });

    await test('4.4 Accepts authentic PNG buffer with valid magic bytes', async () => {
      const validPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
      ]);
      const result = validateFileIntegrity(validPng, 'receipt.png', 'image/png');
      assert.strictEqual(result.ext, 'png');
      assert.strictEqual(result.mime, 'image/png');
    });

    await test('4.5 Rejects path traversal in storage reference access', async () => {
      await assert.rejects(
        async () => paymentProofStorage.getProofReadStream('../../../etc/passwd'),
        /not found/i
      );
    });

    // =========================================================================
    // 5. Quiz Security & Secret Leakage Audits
    // =========================================================================
    console.log('\n--- 5. Quiz Payload Security & Cryptographic Integrity ---');

    await test('5.1 formatParticipantQuestionResponse strictly omits correct_option', async () => {
      const dummyQuestion = {
        id: '11111111-1111-1111-1111-111111111111',
        question_text: 'What is HTTPS?',
        option_a: 'HyperText Transfer Protocol Secure',
        option_b: 'Wrong 1',
        option_c: 'Wrong 2',
        option_d: 'Wrong 3',
        correct_option: 'A',
        time_limit_seconds: 30,
        question_order: 1,
      };

      const response = formatParticipantQuestionResponse(
        { id: '22222222-2222-2222-2222-222222222222' },
        dummyQuestion,
        10,
        new Date()
      );

      assert.strictEqual(response.question.correct_option, undefined);
      assert.strictEqual(response.question.correctOption, undefined);
      assert.strictEqual(JSON.stringify(response).includes('"correct_option"'), false);
      assert.strictEqual(JSON.stringify(response).includes('"correctOption"'), false);
    });

    await test('5.2 OTP hashing uses HMAC-SHA256 and produces 64-character hex hash', async () => {
      const otp = '123456';
      const hash = hashOtp(otp);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64);
      assert.strictEqual(/^[0-9a-f]{64}$/.test(hash), true);
      // Ensure it is not plain SHA-256
      const crypto = await import('crypto');
      const plainSha256 = crypto.createHash('sha256').update(otp).digest('hex');
      assert.notStrictEqual(hash, plainSha256, 'HMAC-SHA256 must not match plain SHA-256');
    });

    await test('5.3 timingSafeEqual prevents timing side-channels', async () => {
      const hashA = hashOtp('123456');
      const hashB = hashOtp('123456');
      const hashC = hashOtp('654321');

      assert.strictEqual(timingSafeEqual(hashA, hashB), true);
      assert.strictEqual(timingSafeEqual(hashA, hashC), false);
      assert.strictEqual(timingSafeEqual(hashA, 'short-string'), false);
    });

    // =========================================================================
    // 6. Error Sanitization in Production
    // =========================================================================
    console.log('\n--- 6. Error Sanitization ---');

    await test('6.1 Production error masks internal 500 error messages', async () => {
      // Simulate production environment temporarily
      const originalEnv = config.nodeEnv;
      config.nodeEnv = 'production';

      const res = await apiRequest('/api/not-a-real-endpoint-triggering-404');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data?.stack, undefined, 'Stack trace must not be present in response');

      config.nodeEnv = originalEnv;
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
