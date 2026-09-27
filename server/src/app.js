import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { securityHeaders } from './middleware/securityHeaders.middleware.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import registrationRoutes from './routes/registration.routes.js';
import adminRoutes from './routes/admin.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Disable Express technology fingerprinting
app.disable('x-powered-by');

// Trust reverse proxy (Render, Cloudflare, AWS ELB) for secure cookie and client IP handling
app.set('trust proxy', 1);

// Enforce standard defensive HTTP security headers
app.use(securityHeaders);

// Helper to normalize allowed CORS origins (handles comma-separated list, trims whitespace and trailing slashes)
const parseCorsOrigins = (rawOrigin) => {
  if (!rawOrigin) return ['http://localhost:5173'];
  const origins = typeof rawOrigin === 'string' ? rawOrigin.split(',') : [rawOrigin];
  return origins
    .map((o) => (typeof o === 'string' ? o.trim().replace(/\/+$/, '') : o))
    .filter(Boolean);
};

// Configure CORS with explicit configured origin and credentials support for HttpOnly cookies
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, or same-origin)
      if (!origin) return callback(null, true);

      const allowedOrigins = parseCorsOrigins(config.corsOrigin);
      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (config.nodeEnv !== 'production' &&
          (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('http://127.0.0.1:')))
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware for parsing JSON requests with explicit size limit (prevents payload memory exhaustion)
app.use(express.json({ limit: '500kb' }));

// Middleware for parsing cookies
app.use(cookieParser());

// API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quiz', quizRoutes);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Global Error Handler (sanitizes production errors and formats status codes)
app.use(errorHandler);

export default app;
