import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDb } from '../config/db';
import { UpgradeModel } from '../models/Upgrade';
import { upgradeInputSchema } from '../schemas';

async function main(): Promise<void> {
  const file = process.argv[2] ?? path.resolve(__dirname, '../../data/seed.json');
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const rows = z.array(upgradeInputSchema).parse(raw);

  await connectDb();
  await UpgradeModel.deleteMany({}); // the catalog is read-only and fully rebuilt from game data
  await UpgradeModel.insertMany(rows, { ordered: false });
  console.log(`Seeded ${rows.length} upgrades`);
  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});