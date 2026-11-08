import { Router } from 'express';
import type { Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { UserModel } from '../models/User';
import { VillageModel } from '../models/Village';
import { importSchema, planSchema, renameSchema, settingsSchema } from '../schemas';
import { MAX_VILLAGES, migrateLegacy, parseExport, toFull, toPlan, toSummary } from '../services/villages';
import { asyncHandler } from '../utils/http';

export const villagesRouter = Router();

const uid = (res: Response): string => res.locals.userId as string;

/** A village, but only if it belongs to the logged-in user. */
async function owned(res: Response, id: string | undefined) {
  if (!id || !isValidObjectId(id)) return null;
  return VillageModel.findOne({ _id: id, userId: uid(res) });
}

// List the user's villages (without their export data) and which one is open.
villagesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const user = await UserModel.findById(uid(res));
    if (!user) {
      res.status(401).json({ error: 'Account not found. Please log in again.' });
      return;
    }
    await migrateLegacy(user);

    const list = await VillageModel.find({ userId: user._id }).select('-data -plan').sort({ createdAt: 1 });
    let activeId = user.activeVillageId ? String(user.activeVillageId) : null;
    if (!activeId || !list.some((v) => v.id === activeId)) {
      const latest = [...list].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))[0];
      activeId = latest ? (latest.id as string) : null;
      user.activeVillageId = latest ? latest._id : null;
      await user.save();
    }
    res.json({ villages: list.map(toSummary), activeVillageId: activeId });
  }),
);

// Add a village, or update it if this user already has a village with the same tag.
villagesRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const body = importSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.issues[0]?.message ?? 'Invalid input.' });
      return;
    }
    const info = parseExport(body.data.export);
    if (!info.ok) {
      res.status(400).json({ error: info.error });
      return;
    }

    const userId = uid(res);
    let village = await VillageModel.findOne({ userId, tag: info.tag });
    const created = village === null;

    if (village) {
      village.data = body.data.export;
      village.exportedAt = info.exportedAt;
      if (body.data.name) village.name = body.data.name; // keep the existing name unless a new one is given
      await village.save();
    } else {
      if ((await VillageModel.countDocuments({ userId })) >= MAX_VILLAGES) {
        res.status(400).json({ error: `You can save up to ${MAX_VILLAGES} villages. Delete one first.` });
        return;
      }
      village = await VillageModel.create({
        userId,
        tag: info.tag,
        name: body.data.name ?? `Village ${info.tag}`,
        data: body.data.export,
        exportedAt: info.exportedAt,
        goldPass: { timeReduction: 0, costReduction: 0 },
        potions: { builder: 0, research: 0, pet: 0 },
      });
    }

    await UserModel.updateOne({ _id: userId }, { $set: { activeVillageId: village._id } });
    res.status(created ? 201 : 200).json({ village: toFull(village), created });
  }),
);

villagesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    res.json(toFull(village));
  }),
);

villagesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = renameSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.issues[0]?.message ?? 'Invalid name.' });
      return;
    }
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    village.name = body.data.name;
    await village.save();
    res.json(toSummary(village));
  }),
);

villagesRouter.put(
  '/:id/settings',
  asyncHandler(async (req, res) => {
    const body = settingsSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Invalid settings.' });
      return;
    }
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    village.goldPass = body.data.goldPass;
    village.potions = body.data.potions;
    await village.save();
    res.json(toFull(village));
  }),
);

// Save (or overwrite) the village's Hammer Jam plan.
villagesRouter.put(
  '/:id/plan',
  asyncHandler(async (req, res) => {
    const body = planSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'That plan is not valid.' });
      return;
    }
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    village.plan = { ...body.data, savedAt: new Date() };
    village.markModified('plan');
    await village.save();
    res.json(toPlan(village));
  }),
);

villagesRouter.post(
  '/:id/activate',
  asyncHandler(async (req, res) => {
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    await UserModel.updateOne({ _id: uid(res) }, { $set: { activeVillageId: village._id } });
    res.json({ activeVillageId: village.id as string });
  }),
);

villagesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const village = await owned(res, req.params.id);
    if (!village) {
      res.status(404).json({ error: 'Village not found.' });
      return;
    }
    await village.deleteOne();

    const user = await UserModel.findById(uid(res));
    let activeId = user?.activeVillageId ? String(user.activeVillageId) : null;
    if (user && activeId === (village.id as string)) {
      const next = await VillageModel.findOne({ userId: user._id }).select('-data -plan').sort({ updatedAt: -1 });
      user.activeVillageId = next ? next._id : null;
      await user.save();
      activeId = next ? (next.id as string) : null;
    }
    res.json({ activeVillageId: activeId });
  }),
);