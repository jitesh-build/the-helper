import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import type { PlanInput } from '../schemas';

export type StoredPlan = PlanInput & { savedAt: Date };

export interface IVillage {
  userId: Types.ObjectId;
  /** Clash of Clans village tag, normalised (e.g. "#GU0L0QQUY"). Unique per user. */
  tag: string;
  name: string;
  /** the raw village export JSON exactly as pasted */
  data: string;
  /** export time in ms, taken from the export's own timestamp */
  exportedAt: number | null;
  goldPass: { timeReduction: number; costReduction: number };
  potions: { builder: number; research: number; pet: number };
  /** the saved Hammer Jam plan (null until the user saves one) */
  plan: StoredPlan | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const villageSchema = new Schema<IVillage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tag: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    data: { type: String, required: true },
    exportedAt: { type: Number, default: null },
    goldPass: {
      timeReduction: { type: Number, default: 0 },
      costReduction: { type: Number, default: 0 },
    },
    potions: {
      builder: { type: Number, default: 0 },
      research: { type: Number, default: 0 },
      pet: { type: Number, default: 0 },
    },
    plan: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// one village per Clash of Clans tag per user
villageSchema.index({ userId: 1, tag: 1 }, { unique: true });

export const VillageModel = model<IVillage>('Village', villageSchema);