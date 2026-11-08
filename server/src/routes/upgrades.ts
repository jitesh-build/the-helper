import { Router } from 'express';
import { UpgradeModel } from '../models/Upgrade';
import { searchSchema } from '../schemas';
import { asyncHandler } from '../utils/http';

export const upgradesRouter = Router();

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

upgradesRouter.post(
  '/search',
  asyncHandler(async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid filters.' });
      return;
    }
    const { kind, group, resource, q, available } = parsed.data;
    if (available.length === 0) {
      res.json([]);
      return;
    }

    const filter: Record<string, unknown> = {
      $or: available.map((a) => ({ entityId: a.entityId, level: a.level })),
    };
    if (kind) filter.kind = kind;
    if (group) filter.group = group;
    if (resource) filter.resource = resource;
    if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };

    const docs = await UpgradeModel.find(filter).sort({ name: 1, level: 1 }).limit(300).lean();
    res.json(docs);
  }),
);