import { Schema, model } from 'mongoose';
import type { UpgradeInput } from '../schemas';

const upgradeSchema = new Schema<UpgradeInput>(
  {
    entityId: { type: Number, required: true }, // the game's ID, same as "data" in the village export
    name: { type: String, required: true, trim: true },
    group: {
      type: String,
      enum: ['army', 'defense', 'hero', 'resource', 'other', 'troop', 'spell', 'siege', 'pet'],
      required: true,
    },
    level: { type: Number, required: true, min: 1 }, // the level you are upgrading TO
    kind: { type: String, enum: ['builder', 'lab', 'pet'], required: true },
    resource: { type: String, enum: ['gold', 'elixir', 'darkElixir'], required: true },
    baseMinutes: { type: Number, required: true, min: 1 },
    baseCost: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

upgradeSchema.index({ entityId: 1, level: 1 }, { unique: true });
upgradeSchema.index({ kind: 1, group: 1, resource: 1 });

export const UpgradeModel = model<UpgradeInput>('Upgrade', upgradeSchema);