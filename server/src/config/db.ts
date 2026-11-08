import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err: unknown) => console.error('MongoDB error', err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10_000 });
  console.log('MongoDB connected');
}