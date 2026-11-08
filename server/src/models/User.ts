import { Schema, model } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export interface IUser {
  email: string;
  name: string;
  passwordHash: string;
  /** the village the user last had open */
  activeVillageId: Types.ObjectId | null;
  /** legacy single-village fields: moved into the Village collection on first load, then cleared */
  villageExport?: string | null;
  goldPass?: { timeReduction?: number; costReduction?: number };
  potions?: { builder?: number; research?: number; pet?: number };
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    activeVillageId: { type: Schema.Types.ObjectId, ref: 'Village', default: null },
    villageExport: { type: String, default: null },
    goldPass: { timeReduction: Number, costReduction: Number },
    potions: { builder: Number, research: Number, pet: Number },
  },
  { timestamps: true },
);

export const UserModel = model<IUser>('User', userSchema);

export const toProfile = (u: HydratedDocument<IUser>) => ({
  id: u.id as string,
  email: u.email,
  name: u.name,
});