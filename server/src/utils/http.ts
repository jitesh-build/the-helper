import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

interface ErrorLike {
  code?: unknown;
  type?: unknown;
  status?: unknown;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const e: ErrorLike = typeof err === 'object' && err !== null ? (err as ErrorLike) : {};

  if (e.code === 11000) {
    res.status(409).json({ error: 'That entry already exists.' });
    return;
  }
  if (e.type === 'entity.too.large') {
    res.status(413).json({ error: 'That is too large to upload.' });
    return;
  }
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request body is not valid JSON.' });
    return;
  }
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ error: 'Bad request.' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};