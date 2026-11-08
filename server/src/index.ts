import type { Server } from 'node:http';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { connectDb } from './config/db';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { upgradesRouter } from './routes/upgrades';
import { errorHandler } from './utils/http';
import { villagesRouter } from './routes/villages';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ ok: dbUp });
});

const limiter = (windowMs: number, limit: number, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a bit and try again.' },
  });

app.use('/api', limiter(15 * 60_000, 600));
app.use('/api/auth/login', limiter(15 * 60_000, 10, true)); // only failed logins count
app.use('/api/auth/register', limiter(60 * 60_000, 5));


app.use('/api/auth', authRouter);
app.use('/api/villages', requireAuth, villagesRouter);
app.use('/api/me', meRouter);
app.use('/api/upgrades', requireAuth, upgradesRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});
app.use(errorHandler);

let server: Server | undefined;

const shutdown = (signal: string): void => {
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  if (!server) {
    process.exit(0);
  }
  server?.close(() => {
    void mongoose.disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled rejection', reason);
});

connectDb()
  .then(() => {
    app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
  })
  .catch((err: unknown) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });