import 'dotenv/config';

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
};

const isProd = process.env.NODE_ENV === 'production';

const jwtSecret = need('JWT_SECRET');
if (jwtSecret.length < 16) throw new Error('JWT_SECRET must be at least 16 characters long.');
if (isProd && jwtSecret.length < 32) {
  console.warn('WARNING: JWT_SECRET is shorter than 32 characters. Use a long random value in production.');
}

const rawOrigin = process.env.CLIENT_ORIGIN;
if (isProd && !rawOrigin) throw new Error('CLIENT_ORIGIN must be set in production.');

const clientOrigins = (rawOrigin ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
for (const origin of clientOrigins) {
  if (origin === '*') throw new Error('CLIENT_ORIGIN must not be "*".');
  try {
    new URL(origin);
  } catch {
    throw new Error(`CLIENT_ORIGIN contains an invalid URL: ${origin}`);
  }
}

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer.');

export const env = {
  mongoUri: need('MONGODB_URI'),
  jwtSecret,
  port,
  clientOrigins,
  isProd,
} as const;