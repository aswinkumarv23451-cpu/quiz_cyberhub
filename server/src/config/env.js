import dotenv from 'dotenv';

dotenv.config();

// Parse admin emails into normalized array
const rawAdminEmails = process.env.ADMIN_EMAILS || '';
const adminEmails = rawAdminEmails
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'round1_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min32chars',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    otpHashSecret: process.env.OTP_HASH_SECRET || 'dev_otp_hash_secret_change_in_production_min32chars',
    adminEmails,
    cookieName: 'round1_token',
    cookieMaxAgeMs: 60 * 60 * 1000, // 1 hour
  },
  otp: {
    expiryMinutes: 5,
    maxAttempts: 5,
    cooldownSeconds: 60,
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'test' ? 'test' : 'unconfigured'),
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@round1.tech',
    fromName: process.env.EMAIL_FROM_NAME || 'Round 1 Technology Competition',
  },
};
