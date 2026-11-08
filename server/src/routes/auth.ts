import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { signToken } from '../middleware/auth';
import { UserModel, toProfile } from '../models/User';
import { loginSchema, registerSchema } from '../schemas';
import { asyncHandler } from '../utils/http';

export const authRouter = Router();

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
      return;
    }
    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    if (await UserModel.exists({ email })) {
      res.status(409).json({ error: 'That email is already registered.' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ email, name, passwordHash });
    res.status(201).json({ token: signToken(user.id as string), user: toProfile(user) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
      return;
    }
    const user = await UserModel.findOne({ email: parsed.data.email.toLowerCase() });
    const matches = await bcrypt.compare(parsed.data.password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !matches) {
      res.status(401).json({ error: 'Wrong email or password.' });
      return;
    }
    res.json({ token: signToken(user.id as string), user: toProfile(user) });
  }),
);