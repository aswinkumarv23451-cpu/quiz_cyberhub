/**
 * Rate Limiting Abstraction for Public Registration Endpoints.
 * Can be replaced by a Redis/distributed store adapter in production.
 */
class InMemoryRateLimiter {
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

// Global rate limiter for registrations: 15 submissions per 15 minutes per IP
export const registrationRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
});

/**
 * Express middleware to enforce IP rate limiting on public registration
 */
export const rateLimitRegistration = (req, res, next) => {
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  if (registrationRateLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts from this address. Please try again later.',
    });
  }

  next();
};
