import { z } from 'zod';

export const kindSchema = z.enum(['builder', 'lab', 'pet']);
export const groupSchema = z.enum(['army', 'defense', 'hero', 'resource', 'other', 'troop', 'spell', 'siege', 'pet']);
export const resourceSchema = z.enum(['gold', 'elixir', 'darkElixir']);
export const reductionSchema = z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20)]);

const potionTypeSchema = z.enum(['builder', 'research', 'pet']);

export const planSchema = z.object({
  queue: z
    .array(
      z.object({
        uid: z.string().min(1).max(64),
        entityId: z.number().int().positive(),
        name: z.string().min(1).max(120),
        level: z.number().int().min(1),
        kind: kindSchema,
        resource: resourceSchema,
        baseMinutes: z.number().int().positive(),
        baseCost: z.number().int().nonnegative(),
      }),
    )
    .max(300),
  blocks: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        type: potionTypeSchema,
        startMs: z.number().finite(),
        count: z.number().int().min(1).max(1000),
      }),
    )
    .max(300),
  useGoblins: z.boolean(),
  /** the village data the plan was made against, used to warn when newer data no longer matches */
  basedOn: z.object({
    exportedAt: z.number().finite().nullable(),
    builderCount: z.number().int().min(0).max(20),
    jobs: z.array(z.string().max(40)).max(60),
  }),
});

export const upgradeInputSchema = z.object({
  entityId: z.number().int().positive(),
  name: z.string().min(1).max(120),
  group: groupSchema,
  level: z.number().int().min(1),
  kind: kindSchema,
  resource: resourceSchema,
  baseMinutes: z.number().int().positive(),
  baseCost: z.number().int().nonnegative(),
});

export const searchSchema = z.object({
  q: z.string().max(80).optional(),
  kind: kindSchema.optional(),
  group: groupSchema.optional(),
  resource: resourceSchema.optional(),
  /** the (entity, level) pairs the player can upgrade to right now */
  available: z
    .array(z.object({ entityId: z.number().int().positive(), level: z.number().int().min(1) }))
    .max(1500),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Please enter a name.').max(40),
  email: z.string().trim().email('Please enter a valid email.').max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email.').max(120),
  password: z.string().min(1, 'Please enter your password.').max(100),
});

const potionCount = z.number().int().min(0).max(100_000);

/** Gold Pass perks and potion stock belong to one Clash of Clans account, i.e. one village. */
export const settingsSchema = z.object({
  goldPass: z.object({ timeReduction: reductionSchema, costReduction: reductionSchema }),
  potions: z.object({ builder: potionCount, research: potionCount, pet: potionCount }),
});

const villageName = z.string().trim().min(1, 'Please enter a name.').max(40, 'Keep the name under 40 characters.');

export const importSchema = z.object({
  export: z.string().min(2).max(600_000),
  name: villageName.optional(),
});

export const renameSchema = z.object({ name: villageName });

export type UpgradeInput = z.infer<typeof upgradeInputSchema>;
export type PlanInput = z.infer<typeof planSchema>;