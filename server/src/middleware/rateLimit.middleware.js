/**
 * Rate Limiting Abstraction for Public & High-Risk Endpoints.
 * Uses in-memory sliding window tracking.
 * Can be replaced by a Redis/distributed store adapter in production.
 */
export class InMemoryRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
    this.max = options.max || 10; // 10 attempts per window default
    this.hits = new Map(); // key -> [timestamp, timestamp, ...]
  }

  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];

    // Filter out timestamps older than windowMs
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);
    this.hits.set(key, validTimestamps);

    if (validTimestamps.length >= this.max) {
      return true;
    }

    validTimestamps.push(now);
    this.hits.set(key, validTimestamps);
    return false;
  }

  reset() {
    this.hits.clear();
  }
}

/**
 * Extracts normalized client IP address from request.
 */
export const getClientIp = (req) => {
  let ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
};

// 1. Global rate limiter for public registrations: 15 submissions per 15 minutes per IP
export const registrationRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
});

// 2. Rate limiter for OTP requests: 20 requests per 15 minutes per IP
// (Preserves individual 60-second resend cooldown per account/email)
export const otpRequestRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

// 3. Rate limiter for OTP verifications: 40 requests per 15 minutes per IP
// (Preserves individual 5-attempt invalidation per OTP code)
export const otpVerifyRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
});

// 4. Rate limiter for Quiz submissions (answer / skip): 300 requests per minute per IP
// (Safely supports ~50 concurrent teams sharing a campus NAT / public IP while blocking automated bot floods)
export const quizRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
});

/**
 * Express middleware: IP rate limiting on public registration
 */
export const rateLimitRegistration = (req, res, next) => {
  const clientIp = getClientIp(req);
  if (registrationRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts from this address. Please try again later.',
    });
  }
  next();
};

/**
 * Express middleware: IP rate limiting on login OTP requests
 */
export const rateLimitOtpRequest = (req, res, next) => {
  const clientIp = getClientIp(req);
  if (otpRequestRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many OTP requests from this address. Please try again later.',
    });
  }
  next();
};

/**
 * Express middleware: IP rate limiting on login OTP verification
 */
export const rateLimitOtpVerify = (req, res, next) => {
  const clientIp = getClientIp(req);
  if (otpVerifyRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many verification attempts from this address. Please try again later.',
    });
  }
  next();
};

/**
 * Express middleware: IP rate limiting on quiz submissions
 */
export const rateLimitQuiz = (req, res, next) => {
  const clientIp = getClientIp(req);
  if (quizRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded for quiz submissions. Please wait a moment.',
    });
  }
  next();
};

/**
 * Helper to reset all rate limiters for test isolation
 */
export const resetAllRateLimiters = () => {
  registrationRateLimiter.reset();
  otpRequestRateLimiter.reset();
  otpVerifyRateLimiter.reset();
  quizRateLimiter.reset();
};
