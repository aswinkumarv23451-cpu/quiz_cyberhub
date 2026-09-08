import { config } from '../config/env.js';

/**
 * Global error handling middleware.
 * Sanitizes internal details and stack traces in production to prevent information leakage.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Multer upload errors gracefully
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'Payment proof exceeds the maximum allowed size of 5 MB.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error. Please ensure the file meets all upload requirements.';
  }

  // Production error sanitization: mask internal 500 errors to prevent schema/query leakage
  const isProduction = config.nodeEnv === 'production';
  if (isProduction && statusCode === 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && config.nodeEnv === 'development' && { stack: err.stack }),
  });
};
