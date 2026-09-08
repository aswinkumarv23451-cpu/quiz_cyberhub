/**
 * Security Headers Middleware for Express.
 * Implements defensive HTTP headers without external dependencies.
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking defense: prevent site from being embedded in iframes
  res.setHeader('X-Frame-Options', 'DENY');

  // Control referrer information sent in HTTP requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Baseline Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Disable legacy buggy XSS filters
  res.setHeader('X-XSS-Protection', '0');

  // Enforce HSTS ONLY when served over HTTPS (or behind an SSL termination proxy)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
};
