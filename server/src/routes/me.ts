import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { UserModel, toProfile } from '../models/User';
import { migrateLegacy } from '../services/villages';
import { asyncHandler } from '../utils/http';

export const meRouter = Router();
meRouter.use(requireAuth);

const userId = (res: Response): string => res.locals.userId as string;

meRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const user = await UserModel.findById(userId(res));
    if (!user) {
      res.status(401).json({ error: 'Account not found. Please log in again.' });
      return;
    }
    await migrateLegacy(user);
    res.json(toProfile(user));
  }),
);