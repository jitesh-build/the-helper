import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

export const signToken = (userId: string): string =>
  jwt.sign({ sub: userId }, env.jwtSecret, { algorithm: 'HS256', expiresIn: '30d' });

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Please log in.' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('bad token');
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};